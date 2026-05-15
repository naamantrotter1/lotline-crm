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

// supabase-js auto-calls realtime.setAuth() only on SIGNED_IN + TOKEN_REFRESHED,
// NOT on INITIAL_SESSION (the page-reload path where the session is restored from
// localStorage). This means any postgres_changes channel that subscribes before
// INITIAL_SESSION fires — which includes all page-level useEffect subscriptions
// because React runs child effects before parent effects — joins the channel with
// the anon key instead of the user JWT. Supabase Realtime checks RLS on join and
// rejects the subscription with CHANNEL_ERROR when the anon role lacks SELECT access.
//
// Fix: listen to ALL auth state changes here (module level, before any component
// mounts) and forward the JWT to the Realtime client immediately. This ensures
// accessTokenValue is set before any component effect can subscribe.
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }
  });
}
