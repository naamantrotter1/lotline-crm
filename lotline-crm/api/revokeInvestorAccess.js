// POST /api/revokeInvestorAccess
// Deletes the auth user for an investor, clears their portal access, and
// removes the investor_users join row.  Called when an operator archives
// (removes) an investor from the directory.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { investorId, authUserId } = req.body ?? {};
  if (!investorId) return res.status(400).json({ error: 'investorId is required' });

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  const errors = [];

  // 1. Delete the auth user (revokes all active sessions immediately)
  if (authUserId) {
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
      method:  'DELETE',
      headers,
    });
    if (!deleteRes.ok) {
      const body = await deleteRes.json().catch(() => ({}));
      errors.push(`auth delete: ${body.message ?? deleteRes.status}`);
    }
  }

  // 2. Clear auth_user_id + reset status on the investor record
  await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
    method:  'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body:    JSON.stringify({ auth_user_id: null, status: 'revoked' }),
  });

  // 3. Remove the investor_users join row
  await fetch(`${supabaseUrl}/rest/v1/investor_users?investor_id=eq.${investorId}`, {
    method:  'DELETE',
    headers,
  });

  return res.status(200).json({ success: true, errors });
}
