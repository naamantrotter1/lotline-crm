/**
 * lib/mentions.js
 *
 * Utility functions for @mention parsing, rendering, and validation.
 * Used by the Activity feed composer, Thread message composer, API save
 * endpoints, and the mentions inbox.
 *
 * Mention format in Markdown:
 *   @[Display Name](00000000-0000-0000-0000-000000000000)
 *
 * The token is readable as plain text when rendered without parsing,
 * portable across export formats, and unambiguous to parse.
 */

import { supabase } from './supabase';

// UUID v4 pattern — used in the mention regex
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// Full mention token pattern
const MENTION_PATTERN = `@\\[([^\\]]+)\\]\\((${UUID_RE})\\)`;

/**
 * Extract all @[Display Name](user-id) mentions from a markdown body.
 *
 * @param {string} markdown
 * @returns {{ display_name: string, user_id: string, raw: string, index: number }[]}
 *
 * @example
 * extractMentions('Hey @[Alice Smith](abc-123), check this out')
 * // → [{ display_name: 'Alice Smith', user_id: 'abc-123', raw: '@[Alice Smith](abc-123)', index: 4 }]
 */
export function extractMentions(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];

  const re = new RegExp(MENTION_PATTERN, 'gi');
  const results = [];
  let match;

  while ((match = re.exec(markdown)) !== null) {
    results.push({
      display_name: match[1],
      user_id:      match[2],
      raw:          match[0],
      index:        match.index,
    });
  }

  return results;
}

/**
 * Parse a markdown body into alternating text/mention segments for rendering.
 * Consumers map over the returned array and render:
 *   - { type: 'text', content }      → plain string node
 *   - { type: 'mention', userId, displayName, raw } → <MentionChip>
 *
 * @param {string} markdown
 * @param {Record<string, { first_name?: string, full_name?: string, name?: string }>} [usersById]
 *   Optional profile map to resolve a fresher display name (falls back to
 *   the name embedded in the token).
 * @returns {{ type: 'text'|'mention', content: string, userId?: string, displayName?: string }[]}
 */
export function parseMentionSegments(markdown, usersById = {}) {
  if (!markdown) return [{ type: 'text', content: '' }];

  const re = new RegExp(MENTION_PATTERN, 'gi');
  const segments = [];
  let last = 0;
  let match;

  while ((match = re.exec(markdown)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: markdown.slice(last, match.index) });
    }

    const userId = match[2];
    const user   = usersById[userId];
    const displayName = user
      ? (user.first_name || user.name || user.full_name || match[1])
      : match[1];

    segments.push({ type: 'mention', content: match[0], userId, displayName });
    last = match.index + match[0].length;
  }

  if (last < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(last) });
  }

  return segments;
}

/**
 * Strip mention tokens and return plain text suitable for notification previews.
 * @[Alice Smith](uuid) → @Alice Smith
 *
 * @param {string} markdown
 * @returns {string}
 */
export function mentionsToPlainText(markdown) {
  if (!markdown) return '';
  return markdown.replace(new RegExp(MENTION_PATTERN, 'gi'), '@$1');
}

/**
 * Truncate a markdown body to `maxLen` characters (plain text, mentions resolved)
 * for use in notification body previews.
 *
 * @param {string} markdown
 * @param {number} [maxLen=140]
 * @returns {string}
 */
export function mentionPreview(markdown, maxLen = 140) {
  const plain = mentionsToPlainText(markdown);
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + '…' : plain;
}

/**
 * Validate extracted mentions against active org membership.
 * Fetches membership from Supabase — requires an authenticated session.
 *
 * Returns:
 *   valid   — unique user IDs confirmed as active org members (includes self,
 *             so the chip renders; self-notifications are suppressed at fire time)
 *   invalid — entries with a rejection reason
 *
 * @param {ReturnType<typeof extractMentions>} extracted
 * @param {string} orgId
 * @returns {Promise<{ valid: string[]; invalid: { user_id: string; reason: string }[] }>}
 */
export async function validateMentions(extracted, orgId) {
  if (!extracted.length || !orgId || !supabase) return { valid: [], invalid: [] };

  const userIds = [...new Set(extracted.map(m => m.user_id))];

  const { data: members, error } = await supabase
    .from('memberships')
    .select('user_id, status')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('user_id', userIds);

  if (error) {
    console.error('validateMentions', error);
    return {
      valid:   [],
      invalid: extracted.map(m => ({ user_id: m.user_id, reason: 'membership_lookup_failed' })),
    };
  }

  const activeSet = new Set((members || []).map(m => m.user_id));
  const valid   = [];
  const invalid = [];

  for (const m of extracted) {
    if (!activeSet.has(m.user_id)) {
      invalid.push({
        user_id: m.user_id,
        reason:  'User is not an active member of this org.',
      });
    } else if (!valid.includes(m.user_id)) {
      valid.push(m.user_id);
    }
  }

  return { valid, invalid };
}

/**
 * Check whether JV partner org members can be mentioned on a JV-shared deal.
 *
 * A partner-org member is eligible only if the JV's permissions_on_partner
 * (from the host's perspective) explicitly grants 'thread.reply' or
 * 'comment.create'. All other partner users are filtered out of autocomplete
 * and rejected at save time.
 *
 * @param {string[]}     userIds        - candidate user IDs from the partner org
 * @param {object|null}  jvPermissions  - permissions_on_partner JSONB from JvContext
 * @returns {{ allowed: string[]; denied: string[] }}
 */
export function validateJvMentions(userIds, jvPermissions) {
  const hasAccess = jvPermissions &&
    (jvPermissions['thread.reply'] || jvPermissions['comment.create']);

  if (!hasAccess) {
    return { allowed: [], denied: userIds };
  }
  return { allowed: userIds, denied: [] };
}

/**
 * Build the markdown token string for a single mention.
 *
 * @param {string} displayName
 * @param {string} userId
 * @returns {string}   e.g. '@[Alice Smith](uuid)'
 */
export function buildMentionToken(displayName, userId) {
  return `@[${displayName}](${userId})`;
}
