# LotLine CRM — SaaS Architecture

> **Status:** Phase 1 in progress (PR 1.1 merged — DB foundation).
> Phases 2–4 are planned; see the PR plan below.

---

## Table of Contents

1. [Tenancy Model](#tenancy-model)
2. [Identity & Auth](#identity--auth)
3. [Roles](#roles)
4. [RLS Architecture](#rls-architecture)
5. [Data Model: Global vs. Tenant](#data-model-global-vs-tenant)
6. [Shared vs. Private Resources](#shared-vs-private-resources)
7. [Sign-up & Onboarding Flow](#sign-up--onboarding-flow)
8. [Workspace Switcher](#workspace-switcher)
9. [Invitations & Team Management](#invitations--team-management)
10. [Super-Admin Console](#super-admin-console)
11. [Investor Portal Multi-Tenancy](#investor-portal-multi-tenancy)
12. [Phased PR Plan](#phased-pr-plan)
13. [Testing Requirements](#testing-requirements)
14. [Operations & Rollback](#operations--rollback)

---

## Tenancy Model

**Pattern:** Shared database, row-level isolation.

Every tenant (organization) lives in the same Postgres database. Rows are isolated by `organization_id UUID NOT NULL` on every tenant-scoped table, enforced by Supabase Row Level Security policies. There is no schema-per-tenant or database-per-tenant.

```
auth.users (global)
    │
    ├─ profiles (global — one per auth user)
    │      active_organization_id → organizations.id   (session context)
    │      is_super_admin BOOLEAN                       (LotLine staff)
    │
    ├─ memberships (org-scoped link)
    │      user_id × organization_id × role
    │      UNIQUE(user_id, organization_id)
    │
    └─ investor_users (org-scoped link)
           user_id × organization_id × investor_id
           UNIQUE(user_id, organization_id)
```

**Session context:** `profiles.active_organization_id` stores the user's active workspace. The RLS helper `current_org_id()` reads this column. On workspace switch, the app updates `profiles.active_organization_id` and the RLS context changes immediately for subsequent queries — no JWT re-issue required.

---

## Identity & Auth

| Concern | Mechanism |
|---------|-----------|
| Authentication | Supabase Auth — magic link (primary), email+password (secondary) |
| User record | `auth.users` (Supabase-managed) + `profiles` (app-managed) |
| Session | Supabase JWT; no custom claims needed |
| Org context | `profiles.active_organization_id` — updated on workspace switch |
| Investor portal | Separate magic-link flow; investor sees only their operator's org |
| New user sign-up | Sign-up form → workspace creation → org + owner membership created |
| Invitation accept | Token URL → look up `organization_invitations.token` → create user if new → create membership → redirect |

### Auth helpers (Supabase RPC / client)

```typescript
// PR 1.2 — called at session start and on workspace switch
supabase.rpc('switch_organization', { org_id: targetOrgId })
// The RPC is SECURITY DEFINER; it validates membership then updates
// profiles.active_organization_id for the calling user.
```

---

## Roles

### Operator roles (stored in `memberships.role`)

| Role | Permissions |
|------|-------------|
| `owner` | All operations including destructive; can transfer ownership; one per org |
| `admin` | All operations including member management; cannot delete org |
| `operator` | Read + write deals/investors/capital stack; cannot manage members or delete |
| `viewer` | Read-only across all operator screens |

### Profile types (stored in `profiles.role`)

> This column is kept for backward compatibility and signals the *kind* of user, not the granular permission level. Granular permissions come from `memberships.role`.

| Value | Meaning |
|-------|---------|
| `admin` / `user` / `viewer` / `realtor` | Legacy operator types (all migrated to memberships in 010) |
| `investor` | Investor-portal user; linked to `investors` via `investor_users` |

### Super-admin (LotLine staff)

`profiles.is_super_admin = true`. Checked by `current_user_is_super_admin()`. Every cross-org access is logged to `super_admin_access_logs`. Super-admin bypasses RLS only through SECURITY DEFINER RPCs — never via a blanket policy exception.

---

## RLS Architecture

### Helper functions (all SECURITY DEFINER)

```sql
current_org_id()              → UUID    -- profiles.active_organization_id for auth.uid()
current_org_role()            → TEXT    -- memberships.role for (uid, org)
current_user_is_operator()    → BOOLEAN -- org_role IS NOT NULL
can_admin()                   → BOOLEAN -- org_role IN ('owner','admin')
can_write()                   → BOOLEAN -- org_role IN ('owner','admin','operator')
current_investor_id()         → UUID    -- investor_users.investor_id for (uid, org)
current_user_is_investor()    → BOOLEAN -- investor_id IS NOT NULL
current_user_is_super_admin() → BOOLEAN -- profiles.is_super_admin
```

### Policy template (operator tables)

```sql
-- SELECT: all org members can read
USING (organization_id = current_org_id() AND current_user_is_operator())

-- INSERT / UPDATE: owner | admin | operator can write
WITH CHECK (organization_id = current_org_id() AND can_write())

-- DELETE: owner | admin only
USING (organization_id = current_org_id() AND can_admin())
```

### Policy template (investor-readable tables)

```sql
-- SELECT: operators OR the linked investor
USING (
  organization_id = current_org_id()
  AND (
    current_user_is_operator()
    OR (current_user_is_investor() AND investor_id = current_investor_id())
  )
)
```

### Auto-fill trigger

Every tenant table has a `BEFORE INSERT` trigger `trg_auto_org_id` that sets `NEW.organization_id = current_org_id()` when the application omits it. This keeps pre-PR-1.2 app code working without changes. The trigger raises an exception if `current_org_id()` returns NULL (meaning the session has no active org — should never occur for authenticated users after backfill).

---

## Data Model: Global vs. Tenant

### Global tables (no `organization_id`)

| Table | Reason |
|-------|--------|
| `auth.users` | Supabase-managed |
| `profiles` | One profile per auth user; cross-org |
| `super_admin_access_logs` | Cross-org by definition |

### New global / infrastructure tables (migration 010)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant workspace record |
| `memberships` | user ↔ org ↔ role |
| `organization_invitations` | Pending email invitations |
| `audit_logs` | Org-scoped append-only audit trail |
| `super_admin_access_logs` | Cross-org access log for LotLine staff |

### Tenant-scoped tables (`organization_id NOT NULL`)

All 20 pre-existing tables + 4 new tables:

| Table | Notes |
|-------|-------|
| `deals` | Core deal record; RLS enabled in 010 (was missing before) |
| `investors` | Tenant's investor roster |
| `investor_users` | Portal user ↔ investor link; UNIQUE(user_id, org_id) |
| `documents` | Uploaded files per org |
| `deal_updates` | Posted updates; investor visibility via deal_allocations |
| `distributions` | Capital distributions |
| `investment_interest` | Investor soft-interest signals |
| `investor_messages` | Operator ↔ investor messaging |
| `operator_impersonation_log` | Operator "view as investor" sessions |
| `deal_photos` | Deal site / progress photos |
| `deal_milestones` | Milestone tracking per deal |
| `projected_distributions` | Month-by-month projections |
| `notifications` | Investor-facing notifications |
| `capital_commitments` | Investor commitment envelopes |
| `deal_allocations` | Capital slices from commitment into deal |
| `commitment_ledger_entries` | Append-only capital movement log |
| `draw_schedules` | Tranche funding schedules per allocation |
| `draw_tranches` | Individual funding tranches |
| `funding_events` | Source-of-truth capital movement events |
| `capital_calls` | Formal capital call documents |
| `contractor_database` | Tenant's vendor/contractor records (new in 010) |
| `pipelines` | Custom pipeline definitions (new in 010) |
| `stages` | Pipeline stage definitions (new in 010) |
| `checklists` | Deal checklist templates (new in 010) |

---

## Shared vs. Private Resources

| Resource | Decision | Implementation |
|----------|----------|----------------|
| **Home Models** | Global read-only + org-private custom | Future: `home_models` table with `is_global BOOLEAN`; `organization_id = NULL` = global |
| **Contractor Database** | **Tenant-private** | `contractor_database.organization_id` — no cross-org visibility |
| **Market Research** | **Tenant-private** | User-entered comps; future premium global dataset |
| **Pipelines & Stages** | **Tenant-private** + starter templates | Seeded at org creation (PR 1.4) |
| **Deal Checklists** | **Tenant-private** + starter template | Seeded at org creation (PR 1.4) |
| **Document Types** | **Tenant-private** + global defaults | Seeded at org creation (PR 1.4) |
| **Financing Scenario Types** | **Global code** (frontend `const`) | `FINANCING_SCENARIOS` array; scenario state on deals is tenant-private |
| **Investor Portal Branding** | **Tenant-private** (Phase 3) | `organizations.logo_url`, `brand_color` |
| **Audit Logs** | **Tenant-scoped** | Admins see own org; super-admin sees all via RPC |

---

## Sign-up & Onboarding Flow

```
/sign-up
  → Supabase auth.signUp (magic link or password)
  → on email confirm → /onboarding

/onboarding  (PR 1.2)
  → "Create your workspace" form
       name        (e.g. "Acme Flippers")
       slug        (e.g. "acme-flippers", auto-suggested, validated unique)
       industry    (Residential Flip / Mobile Home / Syndication / Fund / Other)
  → SECURITY DEFINER RPC: create_organization(name, slug, industry)
       creates organizations row (status='trialing', trial_ends_at = now()+14d)
       creates memberships row (role='owner', status='active')
       sets profiles.active_organization_id
       seeds starter data (pipeline + checklist + Cash investor)
       appends audit_log entry
  → redirect → /dashboard (empty state with setup checklist)
```

---

## Workspace Switcher

For users who are members of multiple organizations (e.g., LotLine staff, consultants):

- Top-left nav shows active org name + avatar/logo
- Click → dropdown lists all active memberships
- Select → calls `switch_organization(org_id)` RPC → updates `profiles.active_organization_id`
- All subsequent Supabase queries automatically scope to the new org (RLS reads the updated column)
- No page reload required — React context re-fetches after switch

---

## Invitations & Team Management

### `/settings/team` page (PR 1.2)

- List all memberships: name, email, role badge, status, last active
- Owner/admin can: invite, change role, disable, remove
- Cannot remove yourself; cannot demote the only owner

### Invite flow

```
Admin fills: email + role
  → INSERT into organization_invitations (token = 32-byte hex, expires 7 days)
  → Send invitation email via [email provider TBD]:
      Subject: "You've been invited to join {org.name} on LotLine CRM"
      Body: magic link → /invite/{token}
  → Pending row shown in team list

Recipient clicks link → /invite/{token}
  → SECURITY DEFINER RPC: accept_invitation(token)
      validates token exists + not expired + not accepted
      if user exists: creates membership
      if new user: supabase.auth.signUp → on confirm → creates membership
      marks invitation accepted_at
      sets profiles.active_organization_id
  → redirect → /dashboard of the invited org
```

---

## Super-Admin Console

Route: `/_admin` — renders 404 for any user where `profiles.is_super_admin = false`.

Every query on this route calls a SECURITY DEFINER RPC that:
1. Checks `current_user_is_super_admin()` — throws if false
2. Inserts a row into `super_admin_access_logs` (org, action, reason)
3. Returns the requested data

### Pages

| Page | Path | Content |
|------|------|---------|
| Org list | `/_admin` | All orgs: name, slug, status, seats, created, last active |
| Org detail | `/_admin/orgs/:id` | Members, recent audit log, deal/investor counts |
| Impersonate | `/_admin/orgs/:id/impersonate` | Prompt: reason → sets `active_organization_id` in session → logged |

---

## Investor Portal Multi-Tenancy

Investors access the portal via `/investor/*` routes. They are:
- Auth users with `profiles.role = 'investor'`
- Linked to an `investors` row via `investor_users` (org-scoped)
- `profiles.active_organization_id` is set to their operator's org

RLS ensures they see only their own data within that org. They never see the operator UI, other investors' data, or data from other orgs.

**Magic-link invite flow for investors (unchanged):**
```
Operator creates investor → creates Supabase auth user → creates investor_users row
  (organization_id automatically set to current org)
Investor receives magic-link → logs in → investor portal
```

---

## Phased PR Plan

### Phase 1 — Foundation ✅ / 🔄

| PR | Scope | Status |
|----|-------|--------|
| **1.1** | `010_organizations_and_tenancy.sql` — new tables, organization_id on 20+ tables, new RLS, backfill LotLine Homes | **This PR** |
| **1.2** | Auth: sign-up flow, workspace switcher, `switch_organization` RPC, invitation email flow, `/settings/team`, `/invite/[token]` | Pending |
| **1.3** | Super-admin console (`/_admin`), impersonation, `super_admin_access_logs` RPCs | Pending |
| **1.4** | Empty states, setup checklist, starter templates (pipeline/stages/checklist/Cash investor), isolation verification test | Pending |

### Phase 2 — Billing & Plans (after Phase 1 live)

Proposed tiers — confirm before coding:

| Plan | Price | Users | Deals | Features |
|------|-------|-------|-------|----------|
| Starter | $49/mo | 1 | 5 | No Investor Portal |
| Pro | $199/mo | 5 | 50 | Full Investor Portal + Capital Stack + Draws |
| Scale | $499/mo | 20 | ∞ | Custom branding + subdomain |

| PR | Scope |
|----|-------|
| **2.1** | `plans`, `subscriptions`, `seat_assignments`, `invoices` tables; `useEntitlement` hook; feature gates; 14-day Pro trial on org creation |
| **2.2** | Stripe Checkout (first purchase), Customer Portal (self-service), webhooks (`customer.subscription.*`, `invoice.*`), dunning |
| **2.3** | Billing UI: plan page, upgrade CTAs, seat management |

### Phase 3 — Customization & Branding

| PR | Scope |
|----|-------|
| **3.1** | Per-org logo + brand color in top bar, emails, investor portal |
| **3.2** | Custom subdomain (`acme.lotline-crm.com`), CNAME setup guide |
| **3.3** | Pipeline stage names, checklist items, document types — customization UI per org |
| **3.4** | Custom domain (Scale only) — DNS verification + TLS provisioning |

### Phase 4 — Polish

| PR | Scope |
|----|-------|
| **4.1** | CSV import: Deals, Investors, Contacts (column mapping + preview) |
| **4.2** | Help center + changelog (Markdown-backed, in-app) |
| **4.3** | Legal pages (Terms, Privacy, DPA — content TBD) |
| **4.4** | Org usage analytics (super-admin) + data export (owner ZIP download) |

---

## Testing Requirements

### RLS unit tests (non-negotiable, block any migration from shipping)

Each test pattern:
```sql
-- 1. SET auth context to user in org A
-- 2. Attempt SELECT on org B's row → assert 0 rows returned
-- 3. Attempt INSERT with org B's organization_id → assert permission denied
-- 4. Attempt UPDATE on org B's row → assert 0 rows updated
```

Minimum coverage per table:
- Cross-org SELECT blocked for operators
- Cross-org SELECT blocked for investors
- Cross-org INSERT blocked
- Cross-org UPDATE blocked
- Investor cannot read another investor's rows within the same org
- Viewer cannot write
- Super-admin RPC returns cross-org data AND logs to super_admin_access_logs

### E2E isolation test (PR 1.4)

```
1. Sign up "Acme Flippers" test org
2. Assert: 0 deals, 0 investors, 0 documents visible
3. Create 1 deal in Acme
4. Log in as LotLine user
5. Assert: Acme deal is not visible in LotLine session
6. Assert: LotLine's existing deals are visible
```

---

## Operations & Rollback

### Applying migration 010

```bash
# Apply via Supabase CLI
supabase db push
# or via the Dashboard SQL editor (paste migration file)
```

The migration is idempotent: all statements use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`. Re-running after a partial failure is safe.

### Rollback

Full rollback instructions are in the DOWN section at the bottom of `010_organizations_and_tenancy.sql`. Execute each step manually in reverse order. Key steps:

1. Drop NOT NULL constraints
2. Drop auto-fill triggers
3. Drop new RLS functions
4. Drop `organization_id` columns from all tenant tables
5. Drop `active_organization_id` and `is_super_admin` from `profiles`
6. Drop new tables (CASCADE removes policies + indexes)
7. Restore old `current_role_is()` function and policies from migrations 001–009

### Post-migration verification checklist

- [ ] `SELECT count(*) FROM organizations;` → 1 (LotLine Homes)
- [ ] `SELECT count(*) FROM memberships;` → matches number of operator profiles
- [ ] All `deals.organization_id IS NULL` count → 0
- [ ] All `investors.organization_id IS NULL` count → 0
- [ ] `SELECT is_super_admin FROM profiles WHERE email ILIKE '%naaman%';` → `true`
- [ ] App loads as LotLine operator → deals visible → no console errors
- [ ] App loads as investor portal user → own data visible → no console errors

---

## Related Docs

- `docs/capital-stack.md` — capital stack and draw schedule architecture
- `docs/billing.md` — Phase 2 billing and plan entitlements (forthcoming)
- `docs/admin-runbook.md` — super-admin operating procedures (forthcoming)
- `docs/onboarding.md` — new-org onboarding flow detail (forthcoming)
