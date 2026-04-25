/**
 * Single source of truth for all capability definitions.
 *
 * HOW TO ADD A NEW CAPABILITY
 * 1. Add an entry to CAPABILITIES below with the roles that can perform it.
 * 2. Use can('your.capability') in UI components to show/hide actions.
 * 3. Add canUser(orgRole, 'your.capability') in the relevant API handler.
 * 4. Done — no other files need to change.
 *
 * ROLE HIERARCHY (per organization, from memberships.role)
 *   owner    — full access including billing, org deletion, ownership transfer
 *   admin    — full data access + team management; no billing/deletion
 *   operator — create/edit/delete deals & investor data; no team/billing
 *   viewer   — read-only across all data; no mutations
 *
 * NOTE: 'realtor' (agent) and 'investor' roles live in profiles.role, NOT
 * memberships.role. They are handled separately via isAgent / isInvestor.
 */

/** @type {Record<string, string[]>} */
export const CAPABILITIES = {
  // ── Deals ──────────────────────────────────────────────
  'deal.view':              ['owner','admin','operator','viewer'],
  'deal.create':            ['owner','admin','operator'],
  'deal.edit':              ['owner','admin','operator'],
  'deal.delete':            ['owner','admin'],
  'deal.archive':           ['owner','admin'],

  // ── Investors / capital ────────────────────────────────
  'investor.view':          ['owner','admin','operator','viewer'],
  'investor.create':        ['owner','admin','operator'],
  'investor.edit':          ['owner','admin','operator'],
  'investor.delete':        ['owner','admin'],

  'investor_portal.view':   ['owner','admin','operator','viewer'],
  'investor_portal.invite': ['owner','admin','operator'],

  'capital_stack.view':     ['owner','admin','operator','viewer'],
  'capital_stack.edit':     ['owner','admin','operator'],

  'capital_call.issue':     ['owner','admin','operator'],

  'distribution.view':      ['owner','admin','operator','viewer'],
  'distribution.record':    ['owner','admin','operator'],

  'draw_schedule.view':     ['owner','admin','operator','viewer'],
  'draw_schedule.edit':     ['owner','admin','operator'],

  // ── Team management ────────────────────────────────────
  'team.view':              ['owner','admin'],
  'team.invite':            ['owner','admin'],
  'team.remove':            ['owner','admin'],
  'team.change_role':       ['owner','admin'],
  'team.disable':           ['owner','admin'],
  'team.transfer_ownership':['owner'],

  // ── Billing ────────────────────────────────────────────
  'billing.view':           ['owner'],
  'billing.manage':         ['owner'],

  // ── Org settings ───────────────────────────────────────
  'org.settings.update':    ['owner','admin'],
  'org.delete':             ['owner'],

  // ── Audit & exports ────────────────────────────────────
  'audit_log.view':         ['owner','admin'],
  'data.export':            ['owner','admin'],

  // ── Contacts ──────────────────────────────────────────────
  'contact.view':      ['owner','admin','operator','viewer'],
  'contact.create':    ['owner','admin','operator'],
  'contact.update':    ['owner','admin','operator'],
  'contact.delete':    ['owner','admin'],
  'contact.bulk_edit': ['owner','admin','operator'],
  'contact.export':    ['owner','admin'],
  'contact.merge':     ['owner','admin'],

  // ── Workflows ──────────────────────────────────────────────────────────────
  'workflow.view':          ['owner','admin','operator','viewer'],
  'workflow.manage':        ['owner','admin','operator'],
  'workflow.publish':       ['owner','admin'],
  'workflow.run':           ['owner','admin','operator'],

  // ── SMS ────────────────────────────────────────────────────────────────────
  'sms.view':               ['owner','admin','operator','viewer'],
  'sms.send':               ['owner','admin','operator'],
  'sms.manage':             ['owner','admin'],

  // ── Voice ──────────────────────────────────────────────────────────────────
  'voice.view':             ['owner','admin','operator','viewer'],
  'voice.call':             ['owner','admin','operator'],
  'voice.manage':           ['owner','admin'],

  // ── Calendar ───────────────────────────────────────────────────────────────
  'calendar.view':          ['owner','admin','operator','viewer'],
  'calendar.manage':        ['owner','admin','operator'],

  // ── E-sign ─────────────────────────────────────────────────────────────────
  'esign.view':             ['owner','admin','operator','viewer'],
  'esign.send':             ['owner','admin','operator'],
  'esign.manage':           ['owner','admin'],
  'esign.template_manage':  ['owner','admin'],
  'esign.provider_connect': ['owner'],
  'esign.void_envelope':    ['owner','admin'],

  // ── Lead Forms ─────────────────────────────────────────────────────────────
  'lead_form.view':         ['owner','admin','operator','viewer'],
  'lead_form.manage':       ['owner','admin','operator'],

  // ── Dedupe ─────────────────────────────────────────────────────────────────
  'dedupe.view':            ['owner','admin','operator'],
  'dedupe.merge':           ['owner','admin'],

  // ── AI ─────────────────────────────────────────────────────────────────────
  'ai.use':                 ['owner','admin','operator'],

  // ── Property Data ──────────────────────────────────────────────────────────
  'property_data.view':     ['owner','admin','operator','viewer'],
  'property_data.pull':     ['owner','admin','operator'],

  // ── Threads ────────────────────────────────────────────────────────────────
  'thread.view':        ['owner','admin','operator','viewer'],
  'thread.create':      ['owner','admin','operator'],
  'thread.reply':       ['owner','admin','operator'],
  'thread.edit_own':    ['owner','admin','operator'],
  'thread.delete_own':  ['owner','admin','operator'],
  'thread.delete_any':  ['owner','admin'],
  'thread.resolve':     ['owner','admin','operator'],
  'thread.archive':     ['owner','admin'],

  // ── Joint Ventures ──────────────────────────────────────
  // Hub org (LotLine Homes): propose, configure, suspend, terminate
  'joint_venture.manage':   ['owner','admin'],
  // Partner org: accept or revoke consent
  'joint_venture.accept':   ['owner','admin'],
  'joint_venture.revoke':   ['owner','admin'],
  // All org members can view the JV settings page (read-only for non-admins)
  'joint_venture.view':     ['owner','admin','operator','viewer'],
};

/**
 * Check whether a given org role has a capability.
 *
 * @param {string|null} orgRole   - 'owner' | 'admin' | 'operator' | 'viewer' | null
 * @param {string}      capability - key from CAPABILITIES
 * @returns {boolean}
 */
export function canUser(orgRole, capability) {
  if (!orgRole) return false;
  const allowed = CAPABILITIES[capability];
  if (!allowed) {
    // Unknown capability — fail closed
    if (import.meta.env.DEV) {
      console.warn(`[permissions] Unknown capability: "${capability}". Add it to lib/permissions.js.`);
    }
    return false;
  }
  return allowed.includes(orgRole);
}

/**
 * Server-side version (Node.js / Vercel functions).
 * Same logic, no import.meta reference.
 *
 * @param {string|null} orgRole
 * @param {string}      capability
 * @returns {boolean}
 */
export function canUserServer(orgRole, capability) {
  if (!orgRole) return false;
  const allowed = CAPABILITIES[capability];
  if (!allowed) return false;
  return allowed.includes(orgRole);
}

/**
 * Seat limits per plan.
 * Total seats = Owner + team members.
 */
export const PLAN_SEAT_LIMITS = {
  starter: 1,
  pro:     6,
  scale:   20,
};

/**
 * Returns the friendly seat-limit message for a given plan
 * when the org is at or over the limit.
 *
 * @param {'starter'|'pro'|'scale'} plan
 * @param {number} currentSeats  - active members + pending invitations
 * @param {number} limit
 * @returns {string}
 */
export function seatLimitMessage(plan, currentSeats, limit) {
  if (plan === 'starter') {
    return 'Upgrade to Pro to invite teammates. Starter plans include 1 seat (Owner only).';
  }
  if (plan === 'pro') {
    return `Your Pro plan includes 5 team members. You have ${currentSeats - 1} active members. Remove a member or upgrade to Scale to add more.`;
  }
  if (plan === 'scale' && currentSeats >= limit) {
    return `Adding this seat will add to your next invoice. Confirm to proceed.`;
  }
  return 'Seat limit reached.';
}
