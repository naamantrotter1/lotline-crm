-- 065 · Add deal_owner column to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deal_owner text;
