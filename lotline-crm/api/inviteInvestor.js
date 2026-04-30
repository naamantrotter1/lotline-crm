// Sends a branded investor portal invite email via Resend.
async function sendInvestorInviteEmail({ to, name, inviteUrl, invitedByName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

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
      from:    'LotLine Homes <invites@lotlinehomes.com>',
      to:      [to],
      subject: `You've been invited to your LotLine Investor Portal`,
      html,
    }),
  });
  return true;
}

/**
 * Extracts the token_hash from a Supabase action_link and builds a direct
 * /investor/activate URL.  This lets us bypass both the Supabase email template
 * and the redirect-URL allowlist — the email link goes straight to our branded
 * activation page, which calls verifyOtp itself.
 *
 * action_link looks like:
 *   https://PROJECT.supabase.co/auth/v1/verify?token=TOKEN_HASH&type=invite&redirect_to=…
 */
function buildActivateUrl(actionLink, baseUrl) {
  if (!actionLink) return null;
  try {
    const url       = new URL(actionLink);
    const tokenHash = url.searchParams.get('token');
    const type      = url.searchParams.get('type') ?? 'invite';
    if (tokenHash) {
      return `${baseUrl}/investor/activate?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
    }
  } catch {}
  // Fallback: use the raw Supabase verification URL
  return actionLink;
}

// POST /api/inviteInvestor
// Upserts the investor record, creates/finds the auth user, and sends a branded
// activation email whose link goes directly to /investor/activate.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const { name, email, phone, organizationId, invitedByName, appUrl } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const baseUrl    = appUrl || process.env.APP_URL || 'https://lotline-crm.vercel.app';
  const redirectTo = `${baseUrl}/investor/activate`;

  const headers = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  // ── 1. Upsert investor record ──────────────────────────────────────────────
  const investorUpsertRes = await fetch(`${supabaseUrl}/rest/v1/investors`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body:    JSON.stringify({
      name:            name.trim(),
      email:           email.toLowerCase().trim(),
      phone:           phone ?? '',
      status:          'invited',
      invited_by_name: invitedByName ?? null,
      invited_at:      new Date().toISOString(),
      ...(organizationId ? { organization_id: organizationId } : {}),
    }),
  });
  const investorArr = await investorUpsertRes.json();
  const investor    = Array.isArray(investorArr) ? investorArr[0] : investorArr;
  const investorId  = investor?.id ?? null;

  const inviteMeta = {
    account_type:    'investor',
    investor_id:     investorId,
    organization_id: organizationId ?? null,
    full_name:       name.trim(),
    invited_by:      invitedByName ?? null,
  };

  // ── 2. Generate invite link — no Supabase email sent ──────────────────────
  // generateLink(type='invite') creates the auth user (if new) and returns
  // action_link WITHOUT triggering Supabase's own email.  We extract the
  // token_hash and build a direct /investor/activate URL ourselves.
  let userId         = null;
  let isExistingUser = false;
  let activateUrl    = null;

  // Path A: invite token (creates new user or refreshes invite for existing)
  const inviteGenRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type:    'invite',
      email,
      options: { redirect_to: redirectTo },
    }),
  });
  if (inviteGenRes.ok) {
    const d  = await inviteGenRes.json();
    userId   = d.user?.id ?? d.properties?.user_id ?? null;
    activateUrl = buildActivateUrl(
      d.properties?.action_link ?? d.action_link ?? null,
      baseUrl,
    );
  }

  // Path B: existing user that can't get a new invite token — try magic link
  if (!userId) {
    isExistingUser = true;
    const mlRes = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type:    'magiclink',
        email,
        options: { redirect_to: redirectTo },
      }),
    });
    if (mlRes.ok) {
      const d  = await mlRes.json();
      userId   = d.user?.id ?? d.properties?.user_id ?? null;
      activateUrl = buildActivateUrl(
        d.properties?.action_link ?? d.action_link ?? null,
        baseUrl,
      );
    }
  }

  // Path C: search admin users list (Google SSO / OAuth accounts)
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

  // Path D: last resort — create user then generate magic link
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
    // Generate a magic link for the newly created user
    const mlRes2 = await fetch(`${supabaseUrl}/auth/v1/admin/generateLink`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type:    'magiclink',
        email,
        options: { redirect_to: redirectTo },
      }),
    });
    if (mlRes2.ok) {
      const d2 = await mlRes2.json();
      activateUrl = buildActivateUrl(
        d2.properties?.action_link ?? d2.action_link ?? null,
        baseUrl,
      );
    }
  }

  if (!userId) return res.status(500).json({ error: 'Could not resolve user ID' });

  // ── 3. Stamp investor metadata on the auth user ────────────────────────────
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method:  'PUT',
    headers,
    body:    JSON.stringify({ user_metadata: inviteMeta }),
  });

  // ── 4. Send branded invite email ──────────────────────────────────────────
  // Resend (investor-branded HTML) → Supabase OTP plain-text fallback
  let emailSent = false;
  if (activateUrl) {
    emailSent = await sendInvestorInviteEmail({
      to: email, name, inviteUrl: activateUrl, invitedByName,
    });
  }
  if (!emailSent) {
    // Supabase native OTP — plain email but delivers reliably
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

  // ── 5. Wait for profile trigger ───────────────────────────────────────────
  await new Promise(r => setTimeout(r, 900));

  // ── 6. Patch profile ──────────────────────────────────────────────────────
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method:  'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body:    JSON.stringify({
      name:         name.trim(),
      phone:        phone ?? '',
      account_type: 'investor',
      ...(!isExistingUser ? { role: 'investor' } : {}),
      ...(organizationId ? { active_organization_id: organizationId } : {}),
    }),
  });

  // ── 7. Link investor_users ────────────────────────────────────────────────
  if (investorId) {
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
    inviteUrl:  activateUrl ?? null,
  });
}
