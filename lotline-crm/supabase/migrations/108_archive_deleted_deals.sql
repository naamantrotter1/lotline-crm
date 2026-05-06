-- Migration 108: Archive the 18 deals that were "deleted" via UI but never
-- actually had is_archived set to true in Supabase.

UPDATE public.deals
SET is_archived = true
WHERE id IN (
  'custom-1776399151348','land-013','custom-1777101239704','land-014',
  'land-018','custom-1776359752514','land-1777321010684','custom-1777082546500',
  'custom-1777150040391','custom-1776362582118','custom-1777102691990',
  'land-006','land-015','land-005','custom-1777102610673','land-016',
  'land-019','custom-1777100493769'
)
AND is_archived = false;

-- Verify
SELECT COUNT(*) AS archived_count FROM public.deals WHERE is_archived = true;
