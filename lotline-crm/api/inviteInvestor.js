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

  const { name, email, phone, organizationId, invitedByName, appUrl } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  // Where Supabase redirects after the user clicks the invite link.
  // Falls back to the production URL so links work from any environment.
  const redirectTo = (appUrl || process.env.APP_URL || 'https://lotline-crm.vercel.app') + '/investor/account';

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  // ── 1. Invite user (new) or look up existing user ───────────────────────────
  let userId = null;
  let isExistingUser = false;

  const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, redirect_to: redirectTo }),
  });
  const inviteData = await inviteRes.json();
  if (inviteRes.ok && inviteData.id) {
    userId = inviteData.id;
  } else {
    // User already exists — use generateLink to retrieve their ID
    const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: redirectTo } }),
    });
    if (genRes.ok) {
      const genData = await genRes.json();
      userId = genData.user?.id ?? genData.properties?.user_id ?? null;
      isExistingUser = true;
    }
    // Last resort: create the user
    if (!userId) {
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, email_confirm: true, password: crypto.randomUUID() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) return res.status(400).json({ error: createData.message ?? 'Failed to create user' });
      userId = createData.id;
    }
  }

  if (!userId) return res.status(500).json({ error: 'Could not resolve user ID' });

  // ── 2. Wait for profile trigger ─────────────────────────────────────────────
  await new Promise(r => setTimeout(r, 900));

  // ── 3. Update profile: name, phone, role = 'investor' (skip role for existing users) ──
  const profilePatch = {
    name:  name.trim(),
    phone: phone ?? '',
    // Don't overwrite role for already-registered users (they may be admins)
    ...(!isExistingUser ? { role: 'investor' } : {}),
    ...(organizationId ? { active_organization_id: organizationId } : {}),
  };
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(profilePatch),
  });

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
