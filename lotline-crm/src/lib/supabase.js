import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// flowType: 'implicit' sends tokens in the URL hash instead of using PKCE.
// This is required so that reset-password / invite links work when opened
// from a mobile email app (Gmail, Mail.app) — those open in an in-app browser
// that doesn't share localStorage with the user's main browser, so the PKCE
// code_verifier is missing and the exchange silently fails.
export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: 'implicit' } })
  : null;
