// Sends a custom investor portal invite email via Resend.
async function sendInvestorInviteEmail({ to, name, inviteUrl, invitedByName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const inviterText = invitedByName ? `${invitedByName} has invited you` : 'You have been invited';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f3ee;margin:0;padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a2332;padding:32px 32px 24px;">
      <p style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">LotLine Homes</p>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:6px 0 0;">Investor Portal</p>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:20px;font-weight:700;color:#1a2332;margin:0 0 12px;">You're invited to the Investor Portal</h1>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hi ${name}, ${inviterText} to access the LotLine Homes Investor Portal,
        where you can view deals, track your investments, and stay up to date.
        Click the button below to sign in.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#c8613a;color:#ffffff;font-size:14px;font-weight:700;
                padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Access Investor Portal
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        This link expires shortly. If you didn't expect this email, you can safely ignore it.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
      <p style="font-size:11px;color:#d1d5db;margin:0;">
        Or copy this link: <a href="${inviteUrl}" style="color:#c8613a;">${inviteUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LotLine Homes <invites@lotlinehomes.com>',
      to:   [to],
      subject: 'You\'ve been invited to the LotLine Investor Portal',
      html,
    }),
  });
}

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
  let magicLink = null;

  const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, redirect_to: redirectTo }),
  });
  const inviteData = await inviteRes.json();
  if (inviteRes.ok && inviteData.id) {
    userId = inviteData.id;
    // Supabase already sent the invite email for new users
  } else {
    // User already exists. Try three approaches to retrieve their ID:

    // Approach A: generateLink (works for password accounts)
    // Also captures action_link so we can email existing users
    if (!userId) {
      const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: redirectTo } }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        userId = genData.user?.id ?? genData.properties?.user_id ?? null;
        magicLink = genData.properties?.action_link ?? genData.action_link ?? null;
        if (userId) isExistingUser = true;
      }
    }

    // Approach B: admin users list search by email (works for Google SSO / OAuth accounts)
    if (!userId) {
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?per_page=1000&page=1`,
        { headers },
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const users = Array.isArray(listData) ? listData : (listData.users ?? []);
        const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found?.id) { userId = found.id; isExistingUser = true; }
      }
    }

    // Approach C: last resort — create a new auth user
    if (!userId) {
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, email_confirm: true, password: crypto.randomUUID() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(400).json({
          error: createData.message ?? createData.msg ?? 'Failed to create or find user',
        });
      }
      userId = createData.id;
    }

    // For existing users found via Approach B or C, generate a magic link now
    if (isExistingUser && !magicLink) {
      const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: redirectTo } }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        magicLink = genData.properties?.action_link ?? genData.action_link ?? null;
      }
    }

    // Send invite email for existing users (Supabase only emails new users automatically).
    // Try Resend first (custom branded), then fall back to Supabase OTP (always available).
    let emailSent = false;
    if (magicLink && process.env.RESEND_API_KEY) {
      await sendInvestorInviteEmail({ to: email, name, inviteUrl: magicLink, invitedByName });
      emailSent = true;
    }
    if (!emailSent) {
      // Supabase OTP — works for all providers including Google SSO, no external key needed
      const otpRes = await fetch(`${supabaseUrl}/auth/v1/otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          create_user: false,
          options: { redirect_to: redirectTo },
        }),
      });
      emailSent = otpRes.ok;
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
