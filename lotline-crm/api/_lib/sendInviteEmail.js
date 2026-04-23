/**
 * Sends an invitation email via Resend.
 * Requires RESEND_API_KEY env var. No-ops silently if missing.
 *
 * @param {{ to: string, inviteUrl: string, orgName: string, role: string, inviterName?: string }} opts
 */
export async function sendInviteEmail({ to, inviteUrl, orgName, role, inviterName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // email not configured — caller still returns inviteUrl

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const inviterText = inviterName ? `${inviterName} has` : 'You have been';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f3ee;margin:0;padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a2332;padding:32px 32px 24px;">
      <p style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">LotLine Homes</p>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:6px 0 0;">Deal Management Platform</p>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:20px;font-weight:700;color:#1a2332;margin:0 0 12px;">You're invited to join ${orgName}</h1>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        ${inviterText} invited you to join <strong>${orgName}</strong> on LotLine Homes as a <strong>${roleLabel}</strong>.
        Click the button below to accept your invitation and set up your account.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#c8613a;color:#ffffff;font-size:14px;font-weight:700;
                padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Accept Invitation
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
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
      subject: `You're invited to join ${orgName} on LotLine Homes`,
      html,
    }),
  });
}
