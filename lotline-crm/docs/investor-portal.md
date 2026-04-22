# Investor Portal

A dedicated, investor-facing portal built on top of the LotLine CRM. Investors log in and see only their own data. Operators can view-as-investor via impersonation.

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/investor/home` | `InvestorHome` | Dashboard — headline metrics, deal list, recent distributions, portfolio PDF export |
| `/investor/deals` | `InvestorDeals` | Full deal list with stage summary and search |
| `/investor/deals/:id` | `InvestorDealDetail` | Per-deal detail — pipeline progress, proforma, distributions, updates |
| `/investor/distributions` | `InvestorDistributions` | Distributions ledger with cumulative chart and CSV export |
| `/investor/updates` | `InvestorUpdates` | Project update feed (operator-posted, investor-visible) with photo lightbox |
| `/investor/documents` | `InvestorDocuments` | Document hub grouped by year with search and type filter |
| `/investor/opportunities` | `InvestorOpportunities` | Available investments with proforma, target IRR, allocation fill bar, Reserve Interest |
| `/investor/messages` | `InvestorMessages` | Inbox — operator-sent messages with read/unread state |

All routes are wrapped in `InvestorLayout` (dark sidebar + mobile hamburger).

---

## Auth and Access Control

### Investor login
1. User logs in via `/login` with a Supabase account.
2. `AuthContext` resolves the user's role from the `profiles` table.
3. If `role = 'investor'`, the `investor_users` table is queried to find the linked `investors` record.
4. The `investorRecord` is exposed via `useAuth()` and passed as context to all `/investor/*` pages via `InvestorLayout → Outlet context`.

### Operator impersonation
Operators (admin/editor) can enter the investor portal as any investor without logging out. The `ImpersonationContext` holds the active impersonation state. An amber "Operator view" badge appears in the sidebar. A "Exit investor view" button calls `logImpersonationEnd()` and navigates back to `/investors`.

### Row-Level Security (RLS)
All new tables (`investors`, `investor_users`, `documents`, `deal_updates`, `distributions`, `investment_interest`, `investor_messages`) have RLS policies applied. Investors can only read their own rows. Operators (authenticated with `operator` / `admin` role) have full access.

Helper functions in Postgres:
- `current_role_is(r TEXT)` — checks `profiles.role` for the authenticated user
- `current_investor_id()` — returns the `investor_id` from `investor_users` for the authenticated user

---

## Database Tables

### New tables (migration: `supabase/migrations/001_investor_portal.sql`)

| Table | Purpose |
|-------|---------|
| `investors` | Investor records (name, email, phone) |
| `investor_users` | Links Supabase auth users to `investors` |
| `documents` | Files shared with investors (stored in Supabase Storage bucket `investor-documents`) |
| `deal_updates` | Construction/progress posts on deals with photo arrays and visibility control |
| `distributions` | Cash distributions to investors (return of capital, profit, preferred return) |
| `investment_interest` | "Reserve Interest" submissions from the Opportunities page |
| `investor_messages` | Operator-to-investor inbox messages |
| `operator_impersonation_log` | Audit log of operator impersonation sessions |

### `deals` table additions

| Column | Type | Purpose |
|--------|------|---------|
| `projected_payout_date` | date | Expected distribution date |
| `projected_irr` | numeric | Target IRR shown in Opportunities |
| `min_check_size` | numeric | Minimum investment shown in Opportunities |
| `remaining_allocation` | numeric | Remaining allocation (used for fill-bar) |
| `visible_to_investors` | boolean | Controls whether deal appears in investor portal |

---

## Data Access Layer (`src/lib/investorPortalData.js`)

All Supabase queries are centralised here. Key functions:

**Investor-scoped reads**
- `fetchMyInvestor()` — resolve investor record from auth.uid()
- `fetchMyDeals(investorName)` — deals matched by investor name
- `fetchMyDeal(dealId, investorName)` — single deal
- `fetchMyDocuments(investorId)` — visible documents
- `fetchMyDealUpdates(investorName)` — investor-visible updates across all deals
- `fetchMyDistributions(investorId)` — full distribution ledger
- `fetchMyMessages(investorId)` — inbox messages

**Operator writes**
- `uploadDocument(...)` — upload to Storage + insert document record
- `toggleDocumentVisibility(docId, visible)` — show/hide from investor
- `postDealUpdate(...)` — post a construction update
- `uploadUpdatePhoto(dealId, file)` — upload photo to Storage
- `addDistribution(...)` — record a distribution payment
- `sendInvestorMessage(...)` — send a message to an investor
- `logImpersonationStart/End(...)` — audit log entries

**Math helpers**
- `computePortfolioMetrics(deals, distributions)` — deployed, returned, unrealizedGain, weightedIrr, nextDistribution
- `distributionsToCsv(distributions)` — CSV string for export

---

## Supabase Storage

Bucket: `investor-documents`

| Path pattern | Content |
|--------------|---------|
| `{investorId}/{timestamp}-{title}.{ext}` | Investor documents |
| `updates/{dealId}/{timestamp}-{filename}` | Deal update photos |

---

## Adding a New Investor

1. Create an investor record in `investors` table (name, email, phone).
2. Create a Supabase auth user for the investor (`role = 'investor'` in `profiles`).
3. Link them via `investor_users` table (`user_id` → `investor_id`).
4. Set `deals.investor = investor.name` and `deals.visible_to_investors = true` on their deals.
5. Investor can now log in and see their portal.

Or use the helper: `await upsertInvestor({...})` + `await linkInvestorUser(userId, investorId)`.

---

## Operator: Posting Deal Updates

From the Deal Detail page (operator side), the update composer allows:
- Title + body (markdown text)
- Photo uploads (multiple, stored in Supabase Storage)
- Visibility: `investor` (shown to investor) or `internal` (operator only)

Updates with `visibility = 'investor'` appear in the investor's `/investor/updates` feed and on the individual deal detail page.

---

## PDF Export

From `/investor/home`, the "Portfolio Summary" button generates a printable HTML page in a new window with:
- Headline metrics (deployed, distributed, unrealized gain, IRR)
- Full deal table (address, stage, ARV, capital, target IRR, expected close)
- Distribution history

The user can then use browser Print → Save as PDF.
