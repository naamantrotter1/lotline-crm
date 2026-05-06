/**
 * GET /api/sync-gmail-replies
 * Polls Gmail threads for replies on sent emails and logs them as activity notes.
 * Called by Vercel Cron every 10 minutes, or manually by an authenticated user.
 */
import { createClient } from '@supabase/supabase-js';

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/** Refresh Gmail token if expired; returns { accessToken, gmailEmail } or null. */
async function getGmailAccess(supa, userId) {
  const { data: integration } = await supa
    .from('user_integrations')
    .select('access_token, refresh_token, token_expiry, gmail_email')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (!integration?.refresh_token) return null;

  let { access_token, refresh_token, token_expiry, gmail_email } = integration;

  if (!token_expiry || new Date(token_expiry) <= new Date(Date.now() + 120_000)) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type:    'refresh_token',
      }),
    });
    const json = await r.json();
    if (!r.ok || !json.access_token) return null;
    access_token = json.access_token;
    await supa.from('user_integrations').update({
      access_token,
      token_expiry: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('user_id', userId).eq('provider', 'google');
  }

  return { accessToken: access_token, gmailEmail: gmail_email };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supa = adminSupabase();
  const bearerToken = (req.headers.authorization || '').replace('Bearer ', '');
  const cronSecret  = process.env.CRON_SECRET;

  // Accept Vercel Cron secret OR a valid Supabase user token
  let scopeToUserId = null;
  if (bearerToken === cronSecret) {
    // Cron call — sync all users
  } else {
    const { data: { user } } = await supa.auth.getUser(bearerToken);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    scopeToUserId = user.id; // scope sync to this user only
  }

  // Optional ?dealId= to scope to a single deal (used by frontend polling)
  const dealId = req.query?.dealId || null;

  // Query email activity notes from the last 30 days that have a gmail_thread_id
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let query = supa
    .from('activity_notes')
    .select('id, deal_id, organization_id, author_id, author_name, metadata')
    .eq('note_type', 'email')
    .gte('created_at', cutoff);
  if (scopeToUserId) query = query.eq('author_id', scopeToUserId);
  if (dealId)        query = query.eq('deal_id', dealId);
  const { data: emailNotes, error: notesErr } = await query;

  if (notesErr) {
    console.error('[sync-gmail-replies] query failed:', notesErr.message);
    return res.status(500).json({ error: notesErr.message });
  }

  const notes = (emailNotes || []).filter(n => n.metadata?.gmail_thread_id);
  if (!notes.length) return res.status(200).json({ synced: 0, checked: 0 });

  // Group by author_id to avoid redundant token fetches
  const tokenCache = {};
  let synced = 0;

  for (const note of notes) {
    try {
      if (!tokenCache[note.author_id]) {
        tokenCache[note.author_id] = await getGmailAccess(supa, note.author_id);
      }
      const gmailAccess = tokenCache[note.author_id];
      if (!gmailAccess) continue;

      const { accessToken, gmailEmail } = gmailAccess;
      const threadId = note.metadata.gmail_thread_id;

      // Fetch the thread (metadata only — no message body needed, just snippet + headers)
      const threadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!threadRes.ok) continue;
      const thread = await threadRes.json();
      const messages = thread.messages || [];
      if (messages.length <= 1) continue; // no replies yet

      // Get already-logged reply message IDs for this parent note
      const { data: existingReplies } = await supa
        .from('activity_notes')
        .select('metadata')
        .eq('parent_note_id', note.id);
      const loggedIds = new Set(
        (existingReplies || []).map(r => r.metadata?.gmail_message_id).filter(Boolean)
      );

      const originalMsgId = note.metadata.gmail_message_id;

      for (const msg of messages) {
        if (msg.id === originalMsgId) continue; // skip the original sent message
        if (loggedIds.has(msg.id)) continue;     // already logged

        const headers  = msg.payload?.headers || [];
        const fromHeader    = headers.find(h => h.name === 'From')?.value  || '';
        const subjectHeader = headers.find(h => h.name === 'Subject')?.value || note.metadata?.subject || '';
        const dateHeader    = headers.find(h => h.name === 'Date')?.value  || null;

        // Skip messages sent by us (the CRM user)
        if (gmailEmail && fromHeader.toLowerCase().includes(gmailEmail.toLowerCase())) continue;

        const snippet      = msg.snippet || '';
        const toEmail      = note.metadata?.to_email || '';
        const toName       = note.metadata?.to_name  || toEmail;
        const replyBody    = `📨 Reply from ${toName} — ${subjectHeader}`;

        const replyMeta = {
          gmail_message_id: msg.id,
          gmail_thread_id:  threadId,
          subject:          subjectHeader,
          from:             fromHeader,
          snippet,
          direction:        'received',
          date:             dateHeader,
        };

        const payload = {
          organization_id: note.organization_id,
          deal_id:         note.deal_id,
          author_id:       note.author_id,
          author_name:     toName,
          note_type:       'email_reply',
          body:            replyBody,
          parent_note_id:  note.id,
          metadata:        replyMeta,
        };

        const { error: insertErr } = await supa.from('activity_notes').insert(payload);
        if (insertErr) {
          // Constraint may not allow 'email_reply' yet — fall back to 'note'
          if (insertErr.code === '23514') {
            const { error: fallbackErr } = await supa.from('activity_notes').insert({ ...payload, note_type: 'note' });
            if (fallbackErr) {
              console.error('[sync-gmail-replies] fallback insert failed:', fallbackErr.message);
              continue;
            }
          } else {
            console.error('[sync-gmail-replies] insert failed:', insertErr.message);
            continue;
          }
        }
        synced++;
        loggedIds.add(msg.id); // prevent double-insert within same sync run
      }
    } catch (err) {
      console.error(`[sync-gmail-replies] error on note ${note.id}:`, err.message);
    }
  }

  return res.status(200).json({ synced, checked: notes.length });
}
