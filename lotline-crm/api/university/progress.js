// POST /api/university/progress
// Body: { lesson_id, last_position_seconds, watched_seconds, completed?, duration_seconds? }
// Upserts the caller's progress for a lesson. Throttles writes to one per 10s
// per (user, lesson) by checking updated_at on the existing row.
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

const THROTTLE_MS = 10_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);

  const body = req.body || {};
  const lessonId = body.lesson_id;
  const lastPos  = Math.max(0, parseInt(body.last_position_seconds, 10) || 0);
  const watched  = Math.max(0, parseInt(body.watched_seconds,        10) || 0);
  const wantComplete = body.completed === true;
  const duration = body.duration_seconds ? parseInt(body.duration_seconds, 10) : null;
  if (!lessonId) return res.status(400).json({ error: 'lesson_id required' });

  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  // Look at the existing row for throttling + max-watched accumulator
  const getRes = await fetch(
    `${url}/rest/v1/university_progress?user_id=eq.${user.id}&lesson_id=eq.${encodeURIComponent(lessonId)}&select=watched_seconds,completed,updated_at`,
    { headers: { apikey: anon, Authorization: userAuth } }
  );
  if (!getRes.ok) return res.status(502).json({ error: 'lookup failed' });
  const existing = (await getRes.json())[0];

  if (existing && existing.updated_at) {
    const lastWriteMs = new Date(existing.updated_at).getTime();
    if (!wantComplete && Date.now() - lastWriteMs < THROTTLE_MS) {
      return res.json({ ok: true, throttled: true });
    }
  }

  // Auto-complete at 90% if duration is known and we exceed it
  let completed = existing?.completed === true || wantComplete;
  if (!completed && duration && duration > 0 && lastPos / duration >= 0.9) {
    completed = true;
  }

  // Take max of existing watched + new watched (never decrement)
  const newWatched = Math.max(existing?.watched_seconds || 0, watched, lastPos);

  const payload = {
    user_id:                 user.id,
    lesson_id:               lessonId,
    watched_seconds:         newWatched,
    last_position_seconds:   lastPos,
    completed:               completed,
    completed_at:            completed ? new Date().toISOString() : null,
  };

  const upsertRes = await fetch(
    `${url}/rest/v1/university_progress?on_conflict=user_id,lesson_id`,
    {
      method: 'POST',
      headers: {
        apikey:        anon,
        Authorization: userAuth,
        'Content-Type': 'application/json',
        Prefer:        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    }
  );
  if (!upsertRes.ok) {
    const txt = await upsertRes.text().catch(() => '');
    return res.status(502).json({ error: 'upsert failed', detail: txt.slice(0, 200) });
  }
  return res.json({ ok: true, completed });
}
