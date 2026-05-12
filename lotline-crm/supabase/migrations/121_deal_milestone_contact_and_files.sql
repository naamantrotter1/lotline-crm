-- Extend deal_milestones so it fully replaces the legacy `dd_*` localStorage
-- keys. Previously each DD task stored its status, completion date, and notes
-- in deal_milestones, but the contact info and attached files lived only in
-- localStorage and were therefore per-browser and lost on cache clears.
--
-- Adds:
--   contact_name      - point of contact for this task
--   contact_phone     - phone number for the contact
--   contact_email     - email for the contact
--   contact_company   - company / org of the contact
--   files             - jsonb array of { name, url } entries. URLs are
--                       data: URIs today (mirroring the previous LS payload);
--                       a future migration can move them to Supabase Storage
--                       without changing this schema.

alter table public.deal_milestones
  add column if not exists contact_name    text,
  add column if not exists contact_phone   text,
  add column if not exists contact_email   text,
  add column if not exists contact_company text,
  add column if not exists files           jsonb not null default '[]'::jsonb;

-- No new RLS policies needed — the existing "org members can manage
-- deal_milestones" policy from 060_deal_milestones.sql already grants full
-- CRUD to org members.
