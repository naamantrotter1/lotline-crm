-- Migration 147: deal_lender_protections table
-- Tracks lender protection items per deal (personal guarantee, title insurance, etc.)
-- with status tracking and auto-trigger support (e.g. MSO on Draw #2 paid).

CREATE TABLE IF NOT EXISTS public.deal_lender_protections (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id         uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  item_key        text NOT NULL,
  label           text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'complete')),
  notes           text,
  auto_trigger    text,          -- e.g. 'draw2_paid'
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, item_key)
);

ALTER TABLE public.deal_lender_protections ENABLE ROW LEVEL SECURITY;

-- Operators: full access to deals within their org
CREATE POLICY "lender_prot_org_select" ON public.deal_lender_protections
  FOR SELECT USING (
    deal_id IN (
      SELECT d.id FROM public.deals d
      JOIN public.profiles p ON p.organization_id = d.organization_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "lender_prot_org_write" ON public.deal_lender_protections
  FOR ALL USING (
    deal_id IN (
      SELECT d.id FROM public.deals d
      JOIN public.profiles p ON p.organization_id = d.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Investors: read their allocated deals only
CREATE POLICY "lender_prot_investor_read" ON public.deal_lender_protections
  FOR SELECT USING (
    deal_id IN (
      SELECT da.deal_id FROM public.deal_allocations da
      WHERE da.investor_id IN (
        SELECT id FROM public.investors WHERE auth_user_id = auth.uid()
      )
      AND da.status != 'returned'
    )
  );
