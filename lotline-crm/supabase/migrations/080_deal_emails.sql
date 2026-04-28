-- 080_deal_emails.sql
-- Deal email tracking table (Gmail-sent emails, open tracking, reply detection)
-- Email templates table
-- gmail_connected flag on user_integrations

BEGIN;

-- ── Gmail connected flag ─────────────────────────────────────────────────────
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS gmail_connected boolean NOT NULL DEFAULT false;

-- ── deal_emails ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_emails (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id                text        NOT NULL,
  sent_by_user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_by_name           text,
  from_email             text        NOT NULL,
  to_emails              text[]      NOT NULL,
  cc_emails              text[],
  bcc_emails             text[],
  subject                text        NOT NULL,
  body_html              text,
  body_text              text,
  gmail_message_id       text,
  gmail_thread_id        text,
  status                 text        NOT NULL DEFAULT 'sent'
                         CHECK (status IN ('draft','sent','failed','bounced')),
  opened_at              timestamptz,
  open_count             integer     NOT NULL DEFAULT 0,
  replied_at             timestamptz,
  reply_gmail_message_id text,
  tracking_pixel_id      uuid        NOT NULL DEFAULT gen_random_uuid(),
  sent_at                timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_emails_deal
  ON public.deal_emails(deal_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_emails_org
  ON public.deal_emails(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_emails_tracking
  ON public.deal_emails(tracking_pixel_id);
CREATE INDEX IF NOT EXISTS idx_deal_emails_thread
  ON public.deal_emails(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

ALTER TABLE public.deal_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_emails_select" ON public.deal_emails;
CREATE POLICY "deal_emails_select" ON public.deal_emails FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "deal_emails_insert" ON public.deal_emails;
CREATE POLICY "deal_emails_insert" ON public.deal_emails FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "deal_emails_update" ON public.deal_emails;
CREATE POLICY "deal_emails_update" ON public.deal_emails FOR UPDATE
  USING (sent_by_user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_emails;

-- ── email_templates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  is_default      boolean     NOT NULL DEFAULT false,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON public.email_templates;
CREATE POLICY "email_templates_select" ON public.email_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "email_templates_insert" ON public.email_templates;
CREATE POLICY "email_templates_insert" ON public.email_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "email_templates_update" ON public.email_templates;
CREATE POLICY "email_templates_update" ON public.email_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

COMMIT;
