-- 061 · Fix deal_documents.deal_id column type
-- deal_id was created as uuid with FK reference in migration 052, but deal IDs
-- are text strings like 'land-1719000000000' from localStorage. This changes
-- the column to text so uploads work for all users.

ALTER TABLE deal_documents
  DROP CONSTRAINT IF EXISTS deal_documents_deal_id_fkey;

ALTER TABLE deal_documents
  ALTER COLUMN deal_id TYPE text USING deal_id::text;
