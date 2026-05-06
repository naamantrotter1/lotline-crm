-- Migration 107: Ensure all required deals columns and indexes exist
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subdivide   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_starred  boolean NOT NULL DEFAULT false;

-- Fast lookup for active/archived deal queries
CREATE INDEX IF NOT EXISTS idx_deals_is_archived
  ON public.deals (is_archived);

CREATE INDEX IF NOT EXISTS idx_deals_org_archived
  ON public.deals (organization_id, is_archived);

-- Ensure deal_milestones has the eta column used by ImportantDates
ALTER TABLE public.deal_milestones
  ADD COLUMN IF NOT EXISTS eta date;

-- Enable realtime on deal_milestones so ImportantDates live-sync works
ALTER TABLE public.deal_milestones REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_milestones;

CREATE INDEX IF NOT EXISTS idx_milestones_deal
  ON public.deal_milestones (deal_id);
