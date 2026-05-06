-- 068 · Add avatar_url column to profiles (was missing, causing members API to fail silently)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
