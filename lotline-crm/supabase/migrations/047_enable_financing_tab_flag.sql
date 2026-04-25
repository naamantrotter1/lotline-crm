-- Migration 047: Enable deal_page.financing_tab feature flag for all existing orgs
--
-- The Financing tab on the deal detail page is gated behind this flag.
-- This migration enables it for all existing organizations so the tab
-- is visible immediately after deploy.
--
-- To disable for a specific org (rollback):
--   UPDATE organizations
--   SET feature_flags = feature_flags - 'deal_page.financing_tab'
--   WHERE id = '<org_id>';

UPDATE public.organizations
SET feature_flags = feature_flags || '{"deal_page.financing_tab": true}'::jsonb;
