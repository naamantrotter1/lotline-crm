-- ─────────────────────────────────────────────────────────────
-- 004 · Deal investor position fields + message enhancements
-- ─────────────────────────────────────────────────────────────

-- Per-investor position on a deal
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS investor_capital_contributed numeric,
  ADD COLUMN IF NOT EXISTS investor_equity_pct          numeric;

-- Allow deal_id on investor_messages (for "ask a question" deep-link)
ALTER TABLE investor_messages
  ADD COLUMN IF NOT EXISTS deal_id   uuid REFERENCES deals(id),
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound'));

-- Let investors insert inbound messages
CREATE POLICY IF NOT EXISTS "investors_send_messages"
  ON investor_messages FOR INSERT
  WITH CHECK (investor_id = current_investor_id() AND direction = 'inbound');
