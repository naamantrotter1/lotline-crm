-- Migration 050: Add first_name / last_name columns to profiles
-- and ensure users can update their own profile row.
--
-- These columns may already exist (created via Supabase dashboard).
-- IF NOT EXISTS makes this migration safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Allow authenticated users to update their own profile row.
-- Using IF NOT EXISTS avoids failure if the policy already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_self_update'
  ) THEN
    -- Only enable RLS if it isn't already on
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY profiles_self_update ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Also ensure a SELECT policy exists so users can read their own profile.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_self_select'
  ) THEN
    CREATE POLICY profiles_self_select ON public.profiles
      FOR SELECT TO authenticated
      USING (true);  -- any authenticated user can read any profile (needed for team views)
  END IF;
END $$;
