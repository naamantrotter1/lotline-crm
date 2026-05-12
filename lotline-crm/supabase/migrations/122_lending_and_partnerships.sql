-- Replace the localStorage-only Lending tab + Investor Portal "Available
-- Investments" feed with org-scoped Supabase tables so every teammate and
-- every connected investor sees the same submissions.
--
-- Previously the Lending page wrote to lending_requests_{orgId} and
-- partnership_submissions_{orgId} in localStorage; the Investor Portal
-- "Available Investments" tab read the *unscoped* lending_requests and
-- partnership_submissions keys, so investors literally only saw whatever
-- was in their own browser's localStorage. That isn't fixable without
-- backing the lists with a real DB table.

create table if not exists public.lending_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ref             text not null,
  address         text not null default '',
  loan_amount     numeric,
  loan_type       text,
  property_type   text,
  purchase_price  numeric,
  arv             numeric,
  credit_score    text,
  exit_strategy   text,
  notes           text,
  costs           jsonb not null default '{}'::jsonb,
  date_submitted  date not null default current_date,
  status          text not null default 'Pending Review'
    check (status in ('Pending Review', 'In Review', 'Approved', 'Declined')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, ref)
);

create table if not exists public.lending_partnerships (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  ref               text not null,
  address           text not null default '',
  property_type     text,
  deal_type         text,
  purchase_price    numeric,
  repair_costs      numeric,
  arv               numeric,
  projected_profit  numeric,
  needs             jsonb not null default '[]'::jsonb,
  split             text,
  your_role         text,
  summary           text,
  deal_flyer_name   text,
  supporting_docs_name text,
  costs             jsonb not null default '{}'::jsonb,
  date_submitted    date not null default current_date,
  status            text not null default 'Under Review'
    check (status in ('Under Review', 'Interested', 'In Discussion', 'Pass')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, ref)
);

create index if not exists lending_requests_org_idx
  on public.lending_requests (organization_id, date_submitted desc);
create index if not exists lending_partnerships_org_idx
  on public.lending_partnerships (organization_id, date_submitted desc);

alter table public.lending_requests     enable row level security;
alter table public.lending_partnerships enable row level security;

-- Team members of the org can see + manage submissions for their org.
create policy "org members manage lending_requests"
  on public.lending_requests for all
  using (
    organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  );

create policy "org members manage lending_partnerships"
  on public.lending_partnerships for all
  using (
    organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  );

-- Investors connected to the org can READ submissions to surface them on
-- the Investor Portal's "Available Investments" tab.
create policy "investors read lending_requests"
  on public.lending_requests for select
  using (
    organization_id in (
      select organization_id from public.investors
      where auth_user_id = auth.uid() and status = 'active'
    )
  );

create policy "investors read lending_partnerships"
  on public.lending_partnerships for select
  using (
    organization_id in (
      select organization_id from public.investors
      where auth_user_id = auth.uid() and status = 'active'
    )
  );
