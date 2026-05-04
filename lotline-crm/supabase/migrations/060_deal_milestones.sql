-- Create deal_milestones table for Due Diligence tracker
-- Replaces localStorage keys: dd_{dealId}_{colKey}, dd_{dealId}_{colKey}_date, dd_{dealId}_{colKey}_cont
create table if not exists public.deal_milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  deal_id         text not null,
  milestone_key   text not null,
  status          text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete')),
  completed_date  date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (deal_id, milestone_key)
);

alter table public.deal_milestones enable row level security;

create policy "org members can manage deal_milestones"
  on public.deal_milestones for all
  using (
    organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  );
