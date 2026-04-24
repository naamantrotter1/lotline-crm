/**
 * GET /api/google/callback
 * Handles the Google OAuth2 redirect.
 * Exchanges the auth code for tokens and stores them in user_integrations.
 * Redirects back to /settings?tab=integrations with success or error query param.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;
  const redirectBase = '/settings?tab=integrations';

  if (oauthError) {
    return res.redirect(302, `${redirectBase}&error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return res.redirect(302, `${redirectBase}&error=no_code`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  // 1. Exchange code for tokens
  let tokens;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });
    tokens = await r.json();
    if (!r.ok || !tokens.access_token) throw new Error(tokens.error || 'Token exchange failed');
  } catch (err) {
    return res.redirect(302, `${redirectBase}&error=${encodeURIComponent(err.message)}`);
  }

  // 2. Fetch the user's Gmail address
  let gmailEmail = null;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await r.json();
    gmailEmail = info.email;
  } catch { /* non-critical */ }

  // 3. Identify Supabase user from state (JWT access_token)
  const accessToken = state;
  if (!accessToken) {
    return res.redirect(302, `${redirectBase}&error=no_session`);
  }
  const supa = adminSupabase();
  const { data: { user }, error: authErr } = await supa.auth.getUser(accessToken);
  if (authErr || !user) {
    return res.redirect(302, `${redirectBase}&error=auth_failed`);
  }

  // 4. Look up the user's organization_id from memberships
  const { data: membership } = await supa
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const orgId = membership?.organization_id;
  if (!orgId) {
    return res.redirect(302, `${redirectBase}&error=no_org`);
  }

  // 5. Upsert integration row
  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await supa.from('user_integrations').upsert({
    user_id:         user.id,
    organization_id: orgId,
    provider:        'google',
    gmail_email:     gmailEmail,
    access_token:    tokens.access_token,
    refresh_token:   tokens.refresh_token || null,
    token_expiry:    expiry,
    scopes:          tokens.scope ? tokens.scope.split(' ') : [],
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  return res.redirect(302, `${redirectBase}&connected=google`);
}
