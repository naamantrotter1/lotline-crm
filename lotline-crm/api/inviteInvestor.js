// Sends a branded investor portal invite email via Resend.
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
      <h1 style="font-size:20px;font-weight:700;color:#1a2332;margin:0 0 12px;">You've been invited to your Investor Portal</h1>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hi ${name}, ${inviterText} to access the LotLine Homes Investor Portal,
        where you can view your deals, track distributions, and stay up to date.
        Click the button below to set your password and activate your account.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#c8613a;color:#ffffff;font-size:14px;font-weight:700;
                padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Activate Your Account
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        This link expires in 24 hours. If you didn't expect this email, you can safely ignore it.
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
      subject: `You've been invited to your LotLine Investor Portal`,
      html,
    }),
  });
}

// POST /api/inviteInvestor
// Upserts the investor record, creates/finds the auth user, sends an activation
// email with a link to /investor/activate so the invitee can set their password.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const { name, email, phone, organizationId, invitedByName, appUrl, mode } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  // Where the invite link lands — the activation page, not the marketing site
  const baseUrl   = appUrl || process.env.APP_URL || 'https://lotline-crm.vercel.app';
  const redirectTo = `${baseUrl}/investor/activate`;

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  // ── 1. Upsert investor record BEFORE sending invite ──────────────────────────
  // This ensures investor_id is known and can be embedded in the auth user metadata.
  const investorUpsertBody = {
    name:            name.trim(),
    email:           email.toLowerCase().trim(),
    phone:           phone ?? '',
    status:          'invited',
    invited_by_name: invitedByName ?? null,
    invited_at:      new Date().toISOString(),
    ...(organizationId ? { organization_id: organizationId } : {}),
  };

  const investorUpsertRes = await fetch(`${supabaseUrl}/rest/v1/investors`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body:    JSON.stringify(investorUpsertBody),
  });
  const investorArr = await investorUpsertRes.json();
  const investor    = Array.isArray(investorArr) ? investorArr[0] : investorArr;
  const investorId  = investor?.id ?? null;

  // ── 2. Invite user (new) or look up existing user ────────────────────────────
  let userId       = null;
  let isExistingUser = false;
  let magicLink    = null;

  const inviteMeta = {
    account_type:    'investor',
    investor_id:     investorId,
    organization_id: organizationId ?? null,
    full_name:       name.trim(),
    invited_by:      invitedByName ?? null,
  };

  const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, redirect_to: redirectTo, data: inviteMeta }),
  });
  const inviteData = await inviteRes.json();
  if (inviteRes.ok && inviteData.id) {
    userId = inviteData.id;
    // Supabase already sent the invite email for new users
  } else {
    // User already exists — find their ID and send a custom invite email.

    // Approach A: generateLink (works for email/password accounts, also returns action_link)
    if (!userId) {
      const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type:    'magiclink',
          email,
          options: { redirect_to: redirectTo },
        }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        userId    = genData.user?.id ?? genData.properties?.user_id ?? null;
        magicLink = genData.properties?.action_link ?? genData.action_link ?? null;
        if (userId) isExistingUser = true;
      }
    }

    // Approach B: admin users list search (works for Google SSO / OAuth accounts)
    if (!userId) {
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?per_page=1000&page=1`,
        { headers },
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const users    = Array.isArray(listData) ? listData : (listData.users ?? []);
        const found    = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found?.id) { userId = found.id; isExistingUser = true; }
      }
    }

    // Approach C: last resort — create a new auth user
    if (!userId) {
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, email_confirm: true, user_metadata: inviteMeta }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(400).json({
          error: createData.message ?? createData.msg ?? 'Failed to create or find user',
        });
      }
      userId = createData.id;
    }

    // Update auth user metadata with investor info so the activate page can read it
    if (userId) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method:  'PUT',
        headers,
        body:    JSON.stringify({ user_metadata: inviteMeta }),
      });
    }

    // For existing users: generate a magic link if we don't have one yet
    if (isExistingUser && !magicLink) {
      const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type:    'magiclink',
          email,
          options: { redirect_to: redirectTo },
        }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        magicLink = genData.properties?.action_link ?? genData.action_link ?? null;
      }
    }

    // Send invite email: Resend (branded) → Supabase OTP (fallback)
    let emailSent = false;
    if (magicLink && process.env.RESEND_API_KEY) {
      await sendInvestorInviteEmail({ to: email, name, inviteUrl: magicLink, invitedByName });
      emailSent = true;
    }
    if (!emailSent) {
      // Supabase native OTP — works for all providers including Google SSO
      const otpRes = await fetch(`${supabaseUrl}/auth/v1/otp`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({
          email,
          create_user: false,
          options: { redirect_to: redirectTo },
        }),
      });
      emailSent = otpRes.ok;
    }
  }

  if (!userId) return res.status(500).json({ error: 'Could not resolve user ID' });

  // ── 3. Wait for profile trigger ──────────────────────────────────────────────
  await new Promise(r => setTimeout(r, 900));

  // ── 4. Patch profile: name, phone, mark as investor ──────────────────────────
  const profilePatch = {
    name:         name.trim(),
    phone:        phone ?? '',
    account_type: 'investor',
    // Don't overwrite role for existing users who may be operators/admins
    ...(!isExistingUser ? { role: 'investor' } : {}),
    ...(organizationId ? { active_organization_id: organizationId } : {}),
  };
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method:  'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body:    JSON.stringify(profilePatch),
  });

  // ── 5. Link investor_users (if investor record was created) ──────────────────
  if (investorId) {
    // Set auth_user_id on the investor row now that we know the userId
    await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
      method:  'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ auth_user_id: userId }),
    });

    await fetch(`${supabaseUrl}/rest/v1/investor_users`, {
      method:  'POST',
      headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates' },
      body:    JSON.stringify({ user_id: userId, investor_id: investorId }),
    });
  }

  return res.status(200).json({
    success:    true,
    userId,
    investorId,
    // inviteUrl is only set when we generated a link (existing users)
    // For new users, Supabase sends the email directly — no URL to return
    inviteUrl:  magicLink ?? null,
  });
}
