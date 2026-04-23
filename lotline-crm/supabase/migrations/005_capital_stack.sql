-- ═══════════════════════════════════════════════════════════════════════
-- 005 · Capital Stack: commitments, allocations, ledger
-- Requires: 001_investor_portal.sql (investors, profiles tables)
-- Reversible: DROP TABLE capital_commitments, deal_allocations,
--   commitment_ledger_entries CASCADE; ALTER TABLE deals DROP COLUMN
--   total_capital_required, capital_stack_status, investor_deprecated;
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 0. Seed real investors into the investors table
--    (they currently exist only in src/data/investors.js)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.investors (id, name, contact, email, phone, type, preferred_financing, standard_terms, notes)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   'Atium Build Group LLC', 'Bryton Smith', '', '801-829-8313',
   'Hard Money Lender', 'Hard Money (Land + Home)', '',
   'Primary funder for Dorchester SC (Marion Rd) and Duplin NC (Blue Newkirk Rd) deals.'),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   'Louis Isom', 'Louis Isom', 'louisisom@hotmail.com', '954-895-8924',
   'Private Lender', 'Hard Money (Land + Home)', '3 and 13',
   'Funder for Rutherford NC, Marion Rd Lot 10-5, Rowan NC deals.'),
  ('aaaaaaaa-0000-0000-0000-000000000003',
   'Blue Bay Capital', 'Edwin', 'edwin@bbcfunding.com', '813-400-2191',
   'Hard Money Lender', 'Hard Money (Land + Home)', '',
   'Funding Marion Rd Lot 10-2.'),
  ('aaaaaaaa-0000-0000-0000-000000000004',
   'Windstone', 'William', 'wbarrier@windstonepl.com', '662-303-7550',
   'Hard Money Lender', 'Hard Money Loan', '',
   'Funding Marion Rd Lot 10-1 and 10-4.'),
  ('aaaaaaaa-0000-0000-0000-000000000005',
   'Cash', '', '', '',
   'Internal', 'Cash', '',
   'Internal cash — no external investor. Unlimited headroom.')
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  contact            = EXCLUDED.contact,
  email              = EXCLUDED.email,
  phone              = EXCLUDED.phone,
  type               = EXCLUDED.type,
  preferred_financing = EXCLUDED.preferred_financing,
  standard_terms     = EXCLUDED.standard_terms,
  notes              = EXCLUDED.notes;

-- ─────────────────────────────────────────────────────────────────────
-- 1. New columns on deals
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS total_capital_required  NUMERIC,
  ADD COLUMN IF NOT EXISTS capital_stack_status    TEXT NOT NULL DEFAULT 'draft'
    CHECK (capital_stack_status IN ('draft','partially_funded','fully_funded','over_committed')),
  ADD COLUMN IF NOT EXISTS investor_deprecated     BOOLEAN NOT NULL DEFAULT false;

-- Backfill total_capital_required from existing cost columns
UPDATE public.deals
SET total_capital_required =
    COALESCE(land,0)       + COALESCE(mobile_home,0)  + COALESCE(setup,0)
  + COALESCE(septic,0)     + COALESCE(electric,0)     + COALESCE(hvac,0)
  + COALESCE(clear_land,0) + COALESCE(water_cost,0)   + COALESCE(footers,0)
  + COALESCE(underpinning,0) + COALESCE(decks,0)      + COALESCE(driveway,0)
  + COALESCE(landscaping,0)  + COALESCE(hud_engineer,0)
  + COALESCE(perc_test,0)    + COALESCE(survey,0)
WHERE total_capital_required IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. capital_commitments
--    One row = one investor's max willingness to deploy (the cap).
--    committed_amount NULL = unlimited (used for Cash / internal).
--    revolving = true  → capital_returned events restore headroom.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.capital_commitments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id       UUID        NOT NULL
                                REFERENCES public.investors(id) ON DELETE RESTRICT,
  name              TEXT        NOT NULL,
  committed_amount  NUMERIC,                    -- NULL = unlimited
  commitment_date   DATE,
  expiration_date   DATE,
  priority_rank     INTEGER     NOT NULL DEFAULT 99,
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','paused','fully_deployed','closed')),
  revolving         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.capital_commitments ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 3. deal_allocations
--    One row = one commitment's capital slice in one deal.
--    Multiple rows per deal = multi-investor capital stack.
--    Multiple rows per investor per deal = tranches.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_allocations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id              TEXT        NOT NULL
                                   REFERENCES public.deals(id) ON DELETE CASCADE,
  commitment_id        UUID        NOT NULL
                                   REFERENCES public.capital_commitments(id) ON DELETE RESTRICT,
  investor_id          UUID        NOT NULL
                                   REFERENCES public.investors(id) ON DELETE RESTRICT,
  amount               NUMERIC     NOT NULL CHECK (amount >= 0),
  percent_of_deal      NUMERIC,    -- cached; recomputed when stack changes
  position             TEXT        NOT NULL DEFAULT '1st Position'
                                   CHECK (position IN ('1st Position','2nd Position')),
  preferred_return_pct NUMERIC,    -- annual %; computed before pro-rata profit split
  profit_share_pct     NUMERIC,    -- when set, overrides percent_of_deal for profit step only
  allocated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status               TEXT        NOT NULL DEFAULT 'planned'
                                   CHECK (status IN ('planned','committed','funded','returned')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_allocations ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 4. commitment_ledger_entries (append-only audit log)
--    delta_amount > 0 → capital deployed / added
--    delta_amount < 0 → capital returned / reduced
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commitment_ledger_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id   UUID        NOT NULL
                              REFERENCES public.capital_commitments(id) ON DELETE CASCADE,
  delta_amount    NUMERIC     NOT NULL,
  reason          TEXT        NOT NULL
                              CHECK (reason IN (
                                'allocation_added', 'allocation_reduced',
                                'capital_returned',
                                'commitment_increased', 'commitment_decreased',
                                'migration'
                              )),
  deal_id         TEXT        REFERENCES public.deals(id) ON DELETE SET NULL,
  allocation_id   UUID        REFERENCES public.deal_allocations(id) ON DELETE SET NULL,
  override_reason TEXT,       -- populated when an operator bypassed a guardrail
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.commitment_ledger_entries ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Derived view: investor_commitment_summary
--    Per commitment: committed / allocated / remaining headroom.
--    remaining_headroom NULL = unlimited (Cash).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.investor_commitment_summary AS
SELECT
  i.id                                                          AS investor_id,
  i.name                                                        AS investor_name,
  cc.id                                                         AS commitment_id,
  cc.name                                                       AS commitment_name,
  cc.committed_amount,
  cc.revolving,
  cc.status                                                     AS commitment_status,
  cc.priority_rank,
  cc.commitment_date,
  cc.expiration_date,
  COALESCE(
    SUM(da.amount)
      FILTER (WHERE da.status IN ('planned','committed','funded')),
    0
  )                                                             AS total_allocated,
  CASE
    WHEN cc.committed_amount IS NULL THEN NULL
    ELSE cc.committed_amount
       - COALESCE(
           SUM(da.amount)
             FILTER (WHERE da.status IN ('planned','committed','funded')),
           0
         )
  END                                                           AS remaining_headroom,
  COUNT(DISTINCT da.deal_id)
    FILTER (WHERE da.status IN ('planned','committed','funded'))
                                                                AS active_deals_count
FROM public.investors i
JOIN public.capital_commitments cc ON cc.investor_id = i.id
LEFT JOIN public.deal_allocations da ON da.commitment_id = cc.id
GROUP BY i.id, i.name, cc.id, cc.name, cc.committed_amount, cc.revolving,
         cc.status, cc.priority_rank, cc.commitment_date, cc.expiration_date;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Derived view: deal_capital_stack_view
--    All allocations per deal with running total.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.deal_capital_stack_view AS
SELECT
  da.deal_id,
  da.id                                          AS allocation_id,
  da.commitment_id,
  da.investor_id,
  i.name                                         AS investor_name,
  cc.name                                        AS commitment_name,
  da.amount,
  da.percent_of_deal,
  da.position,
  da.preferred_return_pct,
  da.profit_share_pct,
  da.status,
  da.allocated_at,
  da.notes,
  SUM(da.amount) OVER (
    PARTITION BY da.deal_id
    ORDER BY da.allocated_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                              AS running_total
FROM public.deal_allocations da
JOIN public.investors i  ON i.id  = da.investor_id
JOIN public.capital_commitments cc ON cc.id = da.commitment_id
WHERE da.status != 'returned'
ORDER BY da.deal_id, da.allocated_at;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Data migration — convert every existing single-investor deal
--    into an equivalent deal_allocations row (no data loss).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r               RECORD;
  v_investor_id   UUID;
  v_commitment_id UUID;
  v_allocation_id UUID;
  v_amount        NUMERIC;
  v_alloc_status  TEXT;
  v_pref_rate     NUMERIC;
  v_profit_share  NUMERIC;
BEGIN
  FOR r IN
    SELECT
      d.id,
      d.investor,
      d.financing,
      d.investor_capital_contributed,
      d.total_capital_required,
      d.investor_equity_pct,
      d.scenario_data,
      d.stage
    FROM public.deals d
    WHERE d.investor IS NOT NULL
      AND trim(d.investor) != ''
      AND lower(trim(d.investor)) != 'none'
    ORDER BY d.investor
  LOOP
    -- ── Resolve investor UUID by name ──────────────────────────────
    SELECT id INTO v_investor_id
    FROM public.investors
    WHERE name = trim(r.investor)
    LIMIT 1;

    IF v_investor_id IS NULL THEN
      RAISE NOTICE 'Migration: investor "%" not found; skipping deal %', r.investor, r.id;
      CONTINUE;
    END IF;

    -- ── Find or create the legacy commitment for this investor ─────
    SELECT id INTO v_commitment_id
    FROM public.capital_commitments
    WHERE investor_id = v_investor_id
      AND name LIKE 'Legacy Commitment%'
    LIMIT 1;

    IF v_commitment_id IS NULL THEN
      INSERT INTO public.capital_commitments (
        investor_id,
        name,
        committed_amount,
        priority_rank,
        status,
        revolving,
        notes
      )
      SELECT
        v_investor_id,
        'Legacy Commitment — migrated ' || to_char(now(), 'YYYY-MM-DD'),
        -- Cash = unlimited; others = sum of all their deals' capital
        CASE
          WHEN trim(r.investor) = 'Cash' THEN NULL
          ELSE (
            SELECT COALESCE(SUM(
              COALESCE(d2.investor_capital_contributed, d2.total_capital_required, 0)
            ), 0)
            FROM public.deals d2
            WHERE trim(d2.investor) = trim(r.investor)
          )
        END,
        1,
        'active',
        true,
        'Auto-created by migration 005'
      RETURNING id INTO v_commitment_id;
    END IF;

    -- ── Compute allocation amount ──────────────────────────────────
    v_amount := GREATEST(
      COALESCE(r.investor_capital_contributed, 0),
      COALESCE(r.total_capital_required, 0)
    );
    IF v_amount = 0 THEN v_amount := 0; END IF;

    -- ── Derive allocation status from deal stage ───────────────────
    v_alloc_status := CASE
      WHEN r.stage IN ('Development', 'Complete', 'Utilities & Permits', 'Contract Signed')
        THEN 'funded'
      ELSE 'committed'
    END;

    -- ── Hard money → preferred_return_pct from scenario_data ──────
    v_pref_rate := CASE
      WHEN r.financing IN (
        'Hard Money Loan', 'Hard Money (Land + Home)', 'Hard Money'
      )
      THEN COALESCE(
        (r.scenario_data ->> 'interestRate')::NUMERIC,
        13
      )
      ELSE NULL
    END;

    -- ── Profit split → profit_share_pct from investor_equity_pct ──
    v_profit_share := CASE
      WHEN r.financing = 'Profit Split' THEN r.investor_equity_pct
      ELSE NULL
    END;

    -- ── Skip if an allocation already exists for this deal ─────────
    IF EXISTS (
      SELECT 1 FROM public.deal_allocations
      WHERE deal_id = r.id AND investor_id = v_investor_id
    ) THEN
      CONTINUE;
    END IF;

    -- ── Insert allocation ──────────────────────────────────────────
    INSERT INTO public.deal_allocations (
      deal_id, commitment_id, investor_id,
      amount, percent_of_deal,
      position, preferred_return_pct, profit_share_pct,
      status, notes
    ) VALUES (
      r.id, v_commitment_id, v_investor_id,
      v_amount, 100,
      '1st Position', v_pref_rate, v_profit_share,
      v_alloc_status,
      'Migrated from legacy deals.investor field (005)'
    )
    RETURNING id INTO v_allocation_id;

    -- ── Append ledger entry ────────────────────────────────────────
    INSERT INTO public.commitment_ledger_entries (
      commitment_id, delta_amount, reason, deal_id, allocation_id
    ) VALUES (
      v_commitment_id, v_amount, 'migration', r.id, v_allocation_id
    );

  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. Recompute capital_stack_status on all deals
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.deals d
SET capital_stack_status = sub.new_status
FROM (
  SELECT
    d2.id AS deal_id,
    CASE
      WHEN COALESCE(stack.total, 0) = 0                       THEN 'draft'
      WHEN COALESCE(stack.total, 0) > d2.total_capital_required THEN 'over_committed'
      WHEN COALESCE(stack.total, 0) >= d2.total_capital_required THEN 'fully_funded'
      ELSE 'partially_funded'
    END AS new_status
  FROM public.deals d2
  LEFT JOIN (
    SELECT deal_id, SUM(amount) AS total
    FROM public.deal_allocations
    WHERE status != 'returned'
    GROUP BY deal_id
  ) stack ON stack.deal_id = d2.id
  WHERE d2.total_capital_required IS NOT NULL
) sub
WHERE d.id = sub.deal_id;

-- ─────────────────────────────────────────────────────────────────────
-- 9. Seed named commitments: Atium $500K + Louis Isom $400K
--    These are the capped commitments per the spec.
--    (Legacy commitments above are uncapped mirrors of current reality;
--     these are the forward-looking hard caps Naaman wants to enforce.)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.capital_commitments (
  id, investor_id, name,
  committed_amount, commitment_date,
  priority_rank, status, revolving, notes
) VALUES
  (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Atium $500K 2026',
    500000,
    '2025-01-01',
    1, 'active', true,
    'Hard cap of $500,000. Will NOT invest beyond this ceiling. Contact: Bryton Smith.'
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Louis Isom $400K 2026',
    400000,
    '2025-01-01',
    2, 'active', true,
    'Hard cap of $400,000. Terms: 3pt origination, 13% interest. Contact: louisisom@hotmail.com.'
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 10. RLS policies
-- ─────────────────────────────────────────────────────────────────────

-- capital_commitments
CREATE POLICY "commitments_operator_all" ON public.capital_commitments
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );

CREATE POLICY "commitments_investor_select" ON public.capital_commitments
  FOR SELECT USING (
    public.current_role_is('investor')
    AND investor_id = public.current_investor_id()
  );

-- deal_allocations
CREATE POLICY "allocations_operator_all" ON public.deal_allocations
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );

CREATE POLICY "allocations_investor_select" ON public.deal_allocations
  FOR SELECT USING (
    public.current_role_is('investor')
    AND investor_id = public.current_investor_id()
  );

-- commitment_ledger_entries
CREATE POLICY "ledger_operator_all" ON public.commitment_ledger_entries
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );

CREATE POLICY "ledger_investor_select" ON public.commitment_ledger_entries
  FOR SELECT USING (
    public.current_role_is('investor')
    AND commitment_id IN (
      SELECT id FROM public.capital_commitments
      WHERE investor_id = public.current_investor_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- End of 005_capital_stack.sql
-- ─────────────────────────────────────────────────────────────────────
