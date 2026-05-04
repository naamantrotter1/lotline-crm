-- Fix activity_notes.deal_id type mismatch.
-- deals.id is TEXT (e.g. "deal-020", "custom-..."), but the column was
-- mistakenly declared as UUID, causing every insert from the client to fail
-- with "invalid input syntax for type uuid".
--
-- Also drop the FK constraint (which wrongly referenced deals.id as uuid)
-- and recreate it as TEXT so legacy localStorage deal IDs are allowed.

ALTER TABLE public.activity_notes
  ALTER COLUMN deal_id TYPE text USING deal_id::text;
