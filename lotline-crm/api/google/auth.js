/**
 * GET /api/google/auth
 * Starts the Google OAuth2 flow for Gmail access.
 * Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI
 *
 * The calling page passes ?state=<supabase_access_token> so the
 * callback can identify the user without a session cookie.
 */
export default function handler(req, res) {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }

  const state = req.query.state || '';

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
    access_type:   'offline',   // get refresh_token
    prompt:        'consent',   // always show consent so we get refresh_token every time
    state,
  });

  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
