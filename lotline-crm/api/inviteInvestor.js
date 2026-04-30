// POST /api/inviteInvestor
// Creates a Supabase auth user with role='investor', upserts their investor record,
// links investor_users, and sends a magic-link / invite email.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const { name, email, phone, organizationId, invitedByName } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  // ── 1. Invite user via Supabase magic-link (sends welcome email automatically) ──
  const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  const inviteData = await inviteRes.json();
  if (!inviteRes.ok && !inviteData.id) {
    // Already-registered user: try creating directly instead
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, email_confirm: true, password: crypto.randomUUID() }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: createData.message ?? 'Failed to create user' });
    inviteData.id = createData.id;
  }

  const userId = inviteData.id;
  if (!userId) return res.status(500).json({ error: 'Could not resolve user ID' });

  // ── 2. Wait for profile trigger ─────────────────────────────────────────────
  await new Promise(r => setTimeout(r, 900));

  // ── 3. Update profile: name, phone, role = 'investor', org ─────────────────
  const profilePatch = {
    name:  name.trim(),
    phone: phone ?? '',
    role:  'investor',
    ...(organizationId ? { active_organization_id: organizationId } : {}),
  };
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(profilePatch),
  });
  if (!profileRes.ok) {
    return res.status(500).json({ error: 'User created but profile update failed' });
  }

  // ── 4. Upsert investor record ────────────────────────────────────────────────
  const investorBody = {
    name:            name.trim(),
    email,
    phone:           phone ?? '',
    type:            'Private Lender',
    ...(organizationId ? { organization_id: organizationId } : {}),
  };
  const investorRes = await fetch(`${supabaseUrl}/rest/v1/investors`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(investorBody),
  });
  const investorArr = await investorRes.json();
  const investor    = Array.isArray(investorArr) ? investorArr[0] : investorArr;
  const investorId  = investor?.id;
  if (!investorId) {
    return res.status(500).json({ error: 'Failed to upsert investor record' });
  }

  // ── 5. Link investor_users ────────────────────────────────────────────────────
  await fetch(`${supabaseUrl}/rest/v1/investor_users`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, investor_id: investorId }),
  });

  return res.status(200).json({ success: true, userId, investorId });
}
