-- ═══════════════════════════════════════════════════════════════════════
-- 057 · Link Investor Portal records to Contacts
--
-- Changes:
--   1. Add contact_id UUID FK to investors table
--   2. For each existing investor without a linked contact:
--      a. Look for an existing contact in the same org (match by email,
--         then by name) — reuse if found
--      b. Otherwise create a new contact record
--      c. Ensure the contact has type = 'Investor' in contact_types
--      d. Set investors.contact_id to the matched/created contact
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add contact_id column
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS investors_contact_id_idx ON public.investors (contact_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Auto-create / auto-link contacts for existing investors
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  inv         RECORD;
  cid         UUID;
  name_parts  TEXT[];
  first_n     TEXT;
  last_n      TEXT;
  is_company  BOOLEAN;
BEGIN
  FOR inv IN
    SELECT * FROM public.investors
    WHERE contact_id IS NULL
      AND organization_id IS NOT NULL
  LOOP
    cid := NULL;

    -- ── Try email match first ────────────────────────────────────────
    IF inv.email IS NOT NULL AND trim(inv.email) <> '' THEN
      SELECT id INTO cid
        FROM public.contacts
        WHERE organization_id = inv.organization_id
          AND deleted_at IS NULL
          AND lower(trim(email)) = lower(trim(inv.email))
        LIMIT 1;
    END IF;

    -- ── Try name match ───────────────────────────────────────────────
    IF cid IS NULL THEN
      SELECT id INTO cid
        FROM public.contacts
        WHERE organization_id = inv.organization_id
          AND deleted_at IS NULL
          AND lower(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) =
              lower(trim(inv.name))
        LIMIT 1;
    END IF;

    -- ── Create a contact if none found ───────────────────────────────
    IF cid IS NULL THEN
      -- Heuristic: treat as a company if the name contains corporate keywords
      is_company := (
        inv.name ILIKE '%LLC%'   OR inv.name ILIKE '%Inc.%' OR
        inv.name ILIKE '% Inc%'  OR inv.name ILIKE '%Corp%' OR
        inv.name ILIKE '%Capital%' OR inv.name ILIKE '%Group%' OR
        inv.name ILIKE '%Partners%' OR inv.name ILIKE '%Holdings%' OR
        inv.name ILIKE '%Realty%'   OR inv.name ILIKE '%Properties%' OR
        inv.name ILIKE '%Investments%'
      );

      IF is_company THEN
        -- Company: store full name as company field; first_name = first word
        name_parts := string_to_array(trim(inv.name), ' ');
        first_n := name_parts[1];
        last_n  := '';

        INSERT INTO public.contacts (
          organization_id, first_name, last_name, email, phone,
          company, created_at, updated_at
        ) VALUES (
          inv.organization_id,
          first_n,
          '',
          NULLIF(trim(coalesce(inv.email, '')), ''),
          NULLIF(trim(coalesce(inv.phone, '')), ''),
          inv.name,
          NOW(), NOW()
        )
        RETURNING id INTO cid;
      ELSE
        -- Person: split name into first / last
        name_parts := string_to_array(trim(inv.name), ' ');
        IF array_length(name_parts, 1) >= 2 THEN
          first_n := name_parts[1];
          last_n  := array_to_string(name_parts[2:array_length(name_parts,1)], ' ');
        ELSE
          first_n := inv.name;
          last_n  := '';
        END IF;

        INSERT INTO public.contacts (
          organization_id, first_name, last_name, email, phone,
          company, created_at, updated_at
        ) VALUES (
          inv.organization_id,
          first_n,
          last_n,
          NULLIF(trim(coalesce(inv.email, '')), ''),
          NULLIF(trim(coalesce(inv.phone, '')), ''),
          NULLIF(trim(coalesce(inv.contact, '')), ''),  -- inv.contact = company name field
          NOW(), NOW()
        )
        RETURNING id INTO cid;
      END IF;
    END IF;

    -- ── Ensure 'Investor' type is set ────────────────────────────────
    IF cid IS NOT NULL THEN
      INSERT INTO public.contact_types (contact_id, type)
        VALUES (cid, 'Investor')
        ON CONFLICT (contact_id, type) DO NOTHING;

      -- Link investor → contact
      UPDATE public.investors
        SET contact_id = cid
        WHERE id = inv.id;
    END IF;
  END LOOP;
END $$;
