// GET /api/university/admin-progress?courseId=<uuid>
// Publisher-admin-only analytics for a course. Delegates to the
// university_course_analytics() security-definer function (which itself
// enforces the publisher_org_id check) and returns the rows verbatim.
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const courseId = req.query?.courseId;
  if (!courseId) return res.status(400).json({ error: 'courseId required' });

  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  const r = await fetch(`${url}/rest/v1/rpc/university_course_analytics`, {
    method:  'POST',
    headers: {
      apikey:        anon,
      Authorization: userAuth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_course_id: courseId }),
  });
  if (r.status === 403 || r.status === 401) {
    return res.status(403).json({ error: 'not a publisher admin' });
  }
  if (!r.ok) return res.status(502).json({ error: 'rpc failed', detail: await r.text().catch(() => '') });
  const rows = await r.json();
  return res.json({ lessons: rows });
}
