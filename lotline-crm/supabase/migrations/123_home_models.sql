-- Org-scoped catalog of home models (manufacturers / floorplans / pricing)
-- replacing the per-browser localStorage keys `homeModels_data_v2` and
-- `hiddenOrderHomeIds`. The previous LS implementation meant every teammate
-- maintained their own list and added models that nobody else could see.

create table if not exists public.home_models (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  manufacturer    text not null default 'Clayton',
  model           text not null,
  sections        text not null default 'Single-Wide'
    check (sections in ('Single-Wide', 'Double-Wide')),
  beds            integer not null default 3,
  baths           numeric not null default 2,
  sqft            integer not null default 0,
  price           numeric not null default 0,
  link            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists home_models_org_idx
  on public.home_models (organization_id, manufacturer, model);

alter table public.home_models enable row level security;

create policy "org members manage home_models"
  on public.home_models for all
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

-- Track which model NAMES (after stripping any trailing parenthetical, the
-- same normalisation the UI used in LS) are hidden from the Order Home tool
-- for each org. Stored separately because multiple rows in home_models can
-- share the same display name and the visibility toggle is per-name, not
-- per-row.
create table if not exists public.home_model_hidden_names (
  organization_id uuid not null,
  name            text not null,
  created_at      timestamptz not null default now(),
  primary key (organization_id, name)
);

alter table public.home_model_hidden_names enable row level security;

create policy "org members manage home_model_hidden_names"
  on public.home_model_hidden_names for all
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
