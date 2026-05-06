-- Add is_starred column to deals table (org-wide shared star)
alter table public.deals
  add column if not exists is_starred boolean not null default false;
