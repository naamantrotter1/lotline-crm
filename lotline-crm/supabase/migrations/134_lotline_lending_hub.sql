-- ═══════════════════════════════════════════════════════════════════════════
-- 134 · LotLine Lending Hub
-- ─────────────────────────────────────────────────────────────────────────
-- Adds cross-org deal-submission infrastructure so subscriber orgs can send
-- deals to a designated "lending hub" org (LotLine Homes) for funding review.
--
-- New org flags
--   organizations.is_lending_hub          — true only for LotLine's own org
--   organizations.allow_lending_submissions — subscribers may opt out (default true)
--
-- New tables
--   lending_submissions             — cross-org deal packets
--   lending_submission_attachments  — files attached to a submission
--   lending_submission_messages     — threaded messages between hub & submitter
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- §1  Organization flags
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column if not exists is_lending_hub           boolean not null default false,
  add column if not exists allow_lending_submissions boolean not null default true;


-- ─────────────────────────────────────────────────────────────────────────
-- §2  lending_submissions
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.lending_submissions (
  id                    uuid        primary key default gen_random_uuid(),
  hub_org_id            uuid        not null references public.organizations(id) on delete cascade,
  submitter_org_id      uuid        not null references public.organizations(id) on delete cascade,
  -- optional link to the CRM deal record (may be null if submitted without a deal)
  deal_id               uuid        references public.deals(id) on delete set null,

  -- deal snapshot (captured at submission time)
  address               text        not null default '',
  county                text,
  state                 text,
  acreage               numeric,
  arv                   numeric,
  purchase_price        numeric,
  loan_amount_requested numeric,
  loan_type             text,
  exit_strategy         text,
  credit_score          text,
  notes                 text,
  costs                 jsonb       not null default '{}'::jsonb,

  -- status workflow
  status                text        not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'declined', 'withdrawn')),
  decision_note         text,
  decided_at            timestamptz,
  decided_by_user_id    uuid        references auth.users(id) on delete set null,

  -- identity
  ref                   text        not null,
  submitted_by_user_id  uuid        not null references auth.users(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (hub_org_id, submitter_org_id, ref)
);

create index if not exists lending_submissions_hub_idx
  on public.lending_submissions (hub_org_id, status, created_at desc);

create index if not exists lending_submissions_submitter_idx
  on public.lending_submissions (submitter_org_id, created_at desc);

-- keep updated_at current
create or replace function public.set_lending_submission_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lending_submission_updated_at on public.lending_submissions;
create trigger lending_submission_updated_at
  before update on public.lending_submissions
  for each row execute function public.set_lending_submission_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- §3  lending_submission_attachments
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.lending_submission_attachments (
  id              uuid        primary key default gen_random_uuid(),
  submission_id   uuid        not null references public.lending_submissions(id) on delete cascade,
  file_name       text        not null,
  storage_path    text        not null,
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid        not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now()
);

create index if not exists lending_sub_attachments_idx
  on public.lending_submission_attachments (submission_id);


-- ─────────────────────────────────────────────────────────────────────────
-- §4  lending_submission_messages
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.lending_submission_messages (
  id              uuid        primary key default gen_random_uuid(),
  submission_id   uuid        not null references public.lending_submissions(id) on delete cascade,
  author_id       uuid        not null references auth.users(id) on delete restrict,
  author_org_id   uuid        not null references public.organizations(id) on delete cascade,
  body            text        not null,
  -- hub-only internal notes not visible to the submitting org
  is_internal     boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists lending_sub_messages_idx
  on public.lending_submission_messages (submission_id, created_at);


-- ─────────────────────────────────────────────────────────────────────────
-- §5  Row-level security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.lending_submissions            enable row level security;
alter table public.lending_submission_attachments enable row level security;
alter table public.lending_submission_messages    enable row level security;

-- Helper: true if the calling user is an active member of the given org
-- (inlined in each policy to avoid a function dependency)

-- ── lending_submissions ───────────────────────────────────────────────────

-- Hub org members can read every submission sent to their hub
create policy "hub members read submissions"
  on public.lending_submissions for select
  using (
    hub_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Submitter org members can read their own submissions
create policy "submitter members read own submissions"
  on public.lending_submissions for select
  using (
    submitter_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Any active org member can create submissions to any hub
create policy "submitter members insert submissions"
  on public.lending_submissions for insert
  with check (
    submitter_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Hub and submitter org members may both update (hub: status/decision; submitter: withdraw)
create policy "hub or submitter members update submissions"
  on public.lending_submissions for update
  using (
    hub_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
    or
    submitter_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    hub_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
    or
    submitter_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ── lending_submission_attachments ────────────────────────────────────────

create policy "submission org members read attachments"
  on public.lending_submission_attachments for select
  using (
    submission_id in (
      select id from public.lending_submissions
      where
        hub_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
        or
        submitter_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
    )
  );

create policy "submission org members insert attachments"
  on public.lending_submission_attachments for insert
  with check (
    submission_id in (
      select id from public.lending_submissions
      where
        hub_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
        or
        submitter_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
    )
  );

-- ── lending_submission_messages ───────────────────────────────────────────

-- Hub org members can read all messages (including internal notes)
create policy "hub members read all messages"
  on public.lending_submission_messages for select
  using (
    submission_id in (
      select id from public.lending_submissions
      where hub_org_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- Submitter org members can read only non-internal messages
create policy "submitter members read non-internal messages"
  on public.lending_submission_messages for select
  using (
    is_internal = false
    and submission_id in (
      select id from public.lending_submissions
      where submitter_org_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- Either org's members may post messages to their submissions
create policy "org members insert messages"
  on public.lending_submission_messages for insert
  with check (
    author_org_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and status = 'active'
    )
    and submission_id in (
      select id from public.lending_submissions
      where
        hub_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
        or
        submitter_org_id in (
          select organization_id from public.memberships
          where user_id = auth.uid() and status = 'active'
        )
    )
  );


-- ─────────────────────────────────────────────────────────────────────────
-- §6  Seed — designate LotLine Homes as the lending hub
-- ─────────────────────────────────────────────────────────────────────────

update public.organizations
set    is_lending_hub = true
where  name  = 'LotLine Homes'
   or  slug  = 'lotline-homes';
