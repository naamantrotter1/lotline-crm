-- Pooled Loan: a single loan agreement spanning multiple deals simultaneously.
-- Interest accrues on the FULL pool amount regardless of draws.

CREATE TABLE IF NOT EXISTS pooled_loans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  name                    TEXT NOT NULL,
  lender_name             TEXT,
  lender_contact_name     TEXT,
  lender_contact_email    TEXT,
  lender_contact_phone    TEXT,
  total_pool              NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate           NUMERIC(6,4) NOT NULL DEFAULT 0,  -- decimal e.g. 0.13 = 13%
  term_months             INTEGER NOT NULL DEFAULT 12,
  start_date              DATE,
  maturity_date           DATE,
  profit_participation_pct NUMERIC(5,2) DEFAULT 0,          -- e.g. 10 = 10%
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pooled_loan_deal_allocations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pooled_loan_id   UUID NOT NULL REFERENCES pooled_loans(id) ON DELETE CASCADE,
  deal_id          TEXT NOT NULL,   -- deals.id (TEXT, may be localStorage or Supabase)
  allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  draw_date        DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE pooled_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pooled_loan_deal_allocations ENABLE ROW LEVEL SECURITY;

-- pooled_loans: org members can read; owner/admin/operator can write
CREATE POLICY "pooled_loans_select" ON pooled_loans FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "pooled_loans_insert" ON pooled_loans FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

CREATE POLICY "pooled_loans_update" ON pooled_loans FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

CREATE POLICY "pooled_loans_delete" ON pooled_loans FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

-- pooled_loan_deal_allocations: access via parent pooled_loan org check
CREATE POLICY "pooled_loan_alloc_select" ON pooled_loan_deal_allocations FOR SELECT
  USING (
    pooled_loan_id IN (
      SELECT id FROM pooled_loans
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "pooled_loan_alloc_insert" ON pooled_loan_deal_allocations FOR INSERT
  WITH CHECK (
    pooled_loan_id IN (
      SELECT id FROM pooled_loans
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "pooled_loan_alloc_update" ON pooled_loan_deal_allocations FOR UPDATE
  USING (
    pooled_loan_id IN (
      SELECT id FROM pooled_loans
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "pooled_loan_alloc_delete" ON pooled_loan_deal_allocations FOR DELETE
  USING (
    pooled_loan_id IN (
      SELECT id FROM pooled_loans
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );
