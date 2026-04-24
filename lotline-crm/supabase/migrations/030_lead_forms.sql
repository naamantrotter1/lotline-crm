-- Phase 17: Lead Forms
-- Tables: lead_forms, lead_form_fields, lead_submissions

CREATE TABLE lead_forms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES profiles(id),
  name            text        NOT NULL,
  slug            text        NOT NULL,
  description     text,
  active          boolean     NOT NULL DEFAULT true,
  notify_email    text,         -- email to notify on new submission
  notify_push     boolean     NOT NULL DEFAULT true,
  deal_id         text,         -- auto-link submissions to a deal
  redirect_url    text,         -- after submission redirect
  submit_button_text text      NOT NULL DEFAULT 'Submit',
  theme_color     text         NOT NULL DEFAULT '#c9703a',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE TABLE lead_form_fields (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  field_type      text        NOT NULL, -- text|email|phone|textarea|select|checkbox|number|date
  label           text        NOT NULL,
  placeholder     text,
  required        boolean     NOT NULL DEFAULT false,
  options         jsonb,       -- for select fields
  sort_order      int         NOT NULL DEFAULT 0,
  maps_to         text        -- contact field name to map value to (e.g. 'email', 'phone')
);

CREATE TABLE lead_submissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL, -- auto-linked contact
  deal_id         text,
  data            jsonb       NOT NULL DEFAULT '{}',
  ip_address      text,
  user_agent      text,
  submitted_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON lead_forms(organization_id);
CREATE INDEX ON lead_forms(slug);
CREATE INDEX ON lead_form_fields(form_id);
CREATE INDEX ON lead_submissions(form_id);
CREATE INDEX ON lead_submissions(organization_id);
CREATE INDEX ON lead_submissions(contact_id);
CREATE INDEX ON lead_submissions(submitted_at);

-- RLS
ALTER TABLE lead_forms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_form_fields  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_submissions  ENABLE ROW LEVEL SECURITY;

-- Forms: org members read; operators+ manage
CREATE POLICY "org members read lead_forms" ON lead_forms
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "operators manage lead_forms" ON lead_forms
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );

-- Fields follow form access
CREATE POLICY "org members read lead_form_fields" ON lead_form_fields
  FOR SELECT USING (
    form_id IN (
      SELECT id FROM lead_forms WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "operators manage lead_form_fields" ON lead_form_fields
  FOR ALL USING (
    form_id IN (
      SELECT id FROM lead_forms WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
      )
    )
  );

-- Submissions: org members read
CREATE POLICY "org members read lead_submissions" ON lead_submissions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Public insert (no auth) for form submissions via edge function / anon key
CREATE POLICY "anon insert lead_submissions" ON lead_submissions
  FOR INSERT WITH CHECK (true);
