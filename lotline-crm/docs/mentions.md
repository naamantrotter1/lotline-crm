# @mention System

**Last updated:** 2026-04-25
**Status:** Complete (PRs 1–7). Feature-flag gated: `deal_activity.mentions.enabled`.

---

## What It Does

Operators can type `@` in the Activity tab note composer to tag any active teammate in
the same org. The tagged user receives:

- An **in-app notification** (bell badge increments in real-time via Supabase Realtime)
- An **email** if `mention.deal_activity` is in their notification preferences
- A **push notification** (PWA) if push is enabled

Mentions render as **clickable chips** in the activity feed. Clicking opens a mini
profile card with name, role, email, and a "View profile" link.

---

## Feature Flag

`deal_activity.mentions.enabled` per org. Default **off** in prod, **on** in staging.

Enable for an org:
```sql
UPDATE organizations
SET feature_flags = feature_flags || '{"deal_activity.mentions.enabled": true}'::jsonb
WHERE id = '<org_id>';
```

When the flag is off:
- The `@` autocomplete popover does not open.
- The mute-mentions toggle is hidden.
- DB-backed note saves still work (notes go to `activity_notes` table regardless).

---

## Org Isolation Guarantee

Mentions can **never** cross organizations. Enforced at two independent layers:

1. **RLS** on `mentions` table: INSERT policy requires `mentioned_user_id` to be in
   `memberships` with `status = 'active'` for the same `org_id`.
2. **DB trigger** `trg_mention_org_membership_check`: BEFORE INSERT, raises an exception
   if the membership check fails — catches any bypass of RLS (e.g. service-role misuse).
3. **API** `POST /api/activity/notes`: validates org membership before inserting and
   returns 400 for any invalid mention rather than silently dropping it.

JV-partner members can be mentioned only on JV-shared deals where `permissions_on_partner`
includes `thread.reply` or `comment.create`. They appear in autocomplete with a
"JV partner" badge and are excluded otherwise.

---

## Data Model

### `activity_notes`
DB-backed notes for the Activity tab (replaces localStorage).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | FK organizations |
| deal_id | uuid | |
| author_id | uuid | FK auth.users |
| body | text | Markdown; mentions as `@[Name](uuid)` |
| mentioned_user_ids | uuid[] | Denormalized; GIN indexed |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz | Soft-delete |

### `mentions`
One row per @mention per message. Powers the inbox + notifications.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | FK organizations |
| mentioned_user_id | uuid | FK auth.users |
| mentioned_by_user_id | uuid | FK auth.users (author) |
| target_type | text | `'activity_note'` or `'thread_message'` |
| target_id | uuid | ID of the note/message |
| deal_id | uuid | Denormalized; nullable |
| read_at | timestamptz | Null = unread |
| created_at | timestamptz | |

Indexes: `(mentioned_user_id, read_at)` for unread feed; `(org_id, deal_id)` for per-deal.

### `deal_notification_mutes`
Per-user per-deal mute toggle.

| Column | Type |
|---|---|
| user_id | uuid |
| deal_id | uuid |
| muted_at | timestamptz |

Primary key: `(user_id, deal_id)`.

### `deal_thread_messages.mentioned_user_ids`
Added `uuid[] NOT NULL DEFAULT '{}'` + GIN index to the existing threads table.

---

## Mention Token Format

```
@[Display Name](00000000-0000-0000-0000-000000000000)
```

- Readable as plain text when rendered without parsing
- Portable to email and export
- Parsed by `extractMentions()` and replaced with `<MentionChip>` on render

---

## Component Map

```
TopBar.jsx
  └── NotifPanel
        ├── Notifications tab (existing)
        └── Mentions tab (new)
              ├── filter: All / Unread
              ├── mark-all-read
              └── mention rows → click → navigate to /deal/[id]?activity=[note_id]

DealActivityFeed.jsx
  ├── MuteToggle          — mute/unmute mentions on this deal
  ├── NoteComposer        — textarea + @-mention autocomplete popover
  │     └── MentionAutocomplete — popover listing teammates (↑/↓/Enter/Tab/Esc)
  └── EventCard           — renders NoteBodyRenderer for note events
        └── NoteBodyRenderer  — parseMentionSegments → <MentionChip>
              └── MentionChip — chip + mini profile card

MentionChip.jsx           — standalone chip component
```

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/activity/notes` | Save note, fan out mentions + notifications |
| GET | `/api/activity/notes?deal_id=` | Fetch deal notes (paginated) |
| GET | `/api/team/search?q=&deal_id=` | Autocomplete teammates for @-mention |
| GET | `/api/mentions?status=&deal_id=` | Fetch mentions inbox |
| PATCH | `/api/mentions/read?id=` | Mark single mention read |
| POST | `/api/mentions/read` | Mark all (or deal-scoped) mentions read |
| POST | `/api/deals/mute-mentions` | Mute mentions on a deal |
| DELETE | `/api/deals/mute-mentions?deal_id=` | Unmute |

---

## Permissions

Added to `lib/permissions.js`:

| Capability | Roles |
|---|---|
| `mention.create` | owner, admin, operator |
| `mention.view_own` | all roles |
| `mention.mark_read` | all roles |
| `mention.mute_per_deal` | all roles |

Viewers cannot post notes, so they cannot create mentions. They can still view
their own mentions inbox and mark them read.

---

## lib/mentions.js Utility

```js
extractMentions(markdown)
// → [{ display_name, user_id, raw, index }]

parseMentionSegments(markdown, usersById)
// → [{ type: 'text'|'mention', content, userId?, displayName? }]
// Used by NoteBodyRenderer to swap tokens for <MentionChip>

mentionsToPlainText(markdown)
// → '@Alice Smith' (strips uuid, keeps @name for notifications)

mentionPreview(markdown, maxLen = 140)
// → plain text truncated for notification body

validateMentions(extracted, orgId)
// async → { valid: UUID[], invalid: { user_id, reason }[] }
// Supabase membership lookup; rejects disabled/removed users

validateJvMentions(userIds, jvPermissions)
// sync → { allowed: UUID[], denied: UUID[] }
// Checks permissions_on_partner for thread.reply or comment.create

buildMentionToken(displayName, userId)
// → '@[Display Name](uuid)'
```

---

## Rollback

1. Set `deal_activity.mentions.enabled` to `false` — feature disappears immediately.
2. To fully revert code: remove `MentionChip`, `MuteToggle`, `NoteComposer` (mention
   logic), restore original `DealActivityFeed.jsx`, remove the Mentions tab from
   `TopBar.jsx`, remove mention API routes, drop `048_mentions.sql` tables.

---

## Changelog

| Commit | Description |
|---|---|
| PR 1 | Migration 048: `activity_notes`, `mentions`, `deal_notification_mutes` tables + RLS + DB trigger |
| PR 1 | `lib/mentions.js` utilities: extract, parse, validate, plainText, preview |
| PR 1 | Add `mention.*` capabilities to `lib/permissions.js` |
| PR 2 | `api/team/search.js` autocomplete endpoint (org members + JV partners) |
| PR 2 | `MentionChip.jsx` — chip + profile mini-card |
| PR 2 | `DealActivityFeed.jsx` rewrite — DB notes, autocomplete popover, chip rendering |
| PR 3 | `api/activity/notes.js` — save note, validate mentions, fan out notifications |
| PR 3 | `api/mentions/index.js` — GET inbox |
| PR 3 | `api/mentions/read.js` — PATCH single / POST mark-all-read |
| PR 3 | `api/deals/mute-mentions.js` — POST mute / DELETE unmute |
| PR 4 | `TopBar.jsx` — Mentions tab in NotifPanel with unread count + deep-link |
| PR 5 | `MuteToggle` component in `DealActivityFeed.jsx` |
| PR 6 | Realtime subscription: `mentions` table → bell badge + `activity_notes` → feed refresh |
| PR 7 | This documentation file + `049_mentions_flag_staging.sql` feature flag flip |
