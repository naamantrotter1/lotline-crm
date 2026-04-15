// Vercel serverless function — requires SUPABASE_SERVICE_ROLE_KEY env var
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const { email, password, firstName, lastName, role } = req.body || {};
  if (!email || !password || !firstName) {
    return res.status(400).json({ error: 'email, password, and firstName are required' });
  }

  const fullName = `${firstName.trim()} ${(lastName || '').trim()}`.trim();

  // 1. Create the auth user via Supabase Admin API
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // skip confirmation email for admin-created accounts
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    return res.status(400).json({ error: createData.message || createData.msg || 'Failed to create user' });
  }

  const userId = createData.id;

  // 2. Wait for the DB trigger to create the profile row
  await new Promise(r => setTimeout(r, 800));

  // 3. Update the profile with name, role, etc.
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name:  (lastName || '').trim(),
        name:       fullName,
        role:       role || 'viewer',
      }),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return res.status(500).json({ error: 'User created but profile update failed: ' + errText });
  }

  return res.status(200).json({ success: true, userId, name: fullName });
}
