-- ═══════════════════════════════════════════════════════════════════════
-- 055 · Relax contact_types.type CHECK constraint
--
-- The original constraint only allowed a small set of lowercase values
-- ('lead','seller','buyer', etc.) but the UI uses a different, richer
-- set ('Buyer','Closing Attorney','Home Dealer', …).  This mismatch
-- caused every type-insert to fail silently, leaving contacts typeless.
--
-- Fix: drop the restrictive CHECK and allow any non-empty text value
-- so the UI's CONTACT_TYPE_OPTIONS drive validation instead.
-- ═══════════════════════════════════════════════════════════════════════

-- Drop the old enum-style check (name may vary, so catch both)
ALTER TABLE public.contact_types DROP CONSTRAINT IF EXISTS contact_types_type_check;

-- Re-add a minimal constraint: type must be a non-empty string
ALTER TABLE public.contact_types
  ADD CONSTRAINT contact_types_type_nonempty CHECK (char_length(trim(type)) > 0);
