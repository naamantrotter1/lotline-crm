-- Migration 049: Enable deal_activity.mentions.enabled for all existing orgs.
--
-- This flips the feature flag ON so the @mention autocomplete and notification
-- system is active immediately after deploy.
--
-- To disable for a specific org (rollback):
--   UPDATE organizations
--   SET feature_flags = feature_flags - 'deal_activity.mentions.enabled'
--   WHERE id = '<org_id>';

UPDATE public.organizations
SET feature_flags = feature_flags || '{"deal_activity.mentions.enabled": true}'::jsonb;
