// POST /api/jv/invite
// Hub-only. Creates a JV partner invitation link and emails it.
// Body: { inviteeEmail, notes? }
import { requireJvHubAuth, isAdmin } from '../_lib/teamAuth.js';
import crypto from 'crypto';

const RESEND_API = 'https://api.resend.com/emails';
const FROM       = 'LotLine Homes <no-reply@lotlinehomes.com>';

function inviteEmailHtml({ hubOrgName, inviterName, inviteUrl, notes }) {
  const notesHtml = notes
    ? `<p style="margin:0 0 12px;color:#374151"><strong>Message:</strong> ${notes}</p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body
    style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;margin:0;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:#1a2332;padding:32px 32px 24px;text-align:center">
        <p style="color:rgba(255,255,255,.5);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px">LotLine Homes</p>
        <h1 style="color:#fff;font-size:22px;margin:0">Partner Invitation</h1>
      </div>
      <div style="padding:28px 32px">
        <p style="color:#374151;margin:0 0 16px">Hi there,</p>
        <p style="color:#374151;margin:0 0 16px">
          <strong>${inviterName}</strong> from <strong>${hubOrgName}</strong> has invited you to join LotLine as a Joint Venture partner.
        </p>
        ${notesHtml}
        <p style="color:#374151;margin:0 0 24px">
          Click the button below to create your account and CRM workspace. Your organization will be automatically connected as a JV partner with ${hubOrgName}.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#c8613a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px">
          Accept Invitation &amp; Create Account →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
          This link expires in 7 days. If you did not expect this invitation, you can safely ignore it.
        </p>
      </div>
    </div>
  </body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireJvHubAuth(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can send invitations.' });
  }

  const { inviteeEmail, notes } = req.body || {};
  if (!inviteeEmail || !inviteeEmail.includes('@')) {
    return res.status(400).json({ error: 'A valid inviteeEmail is required.' });
  }

  const token = crypto.randomBytes(24).toString('hex');

  const { data: invitation, error } = await adminClient
    .from('jv_partner_invitations')
    .insert({
      token,
      hub_org_id:         orgId,
      invitee_email:      inviteeEmail.toLowerCase().trim(),
      invited_by_user_id: userId,
      notes:              notes ?? null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const origin = req.headers.origin ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://lotline-crm.vercel.app');
  const inviteUrl = `${origin}/join/${token}`;

  // Send email if Resend is configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const [{ data: hubOrg }, { data: inviterProfile }] = await Promise.all([
      adminClient.from('organizations').select('name').eq('id', orgId).single(),
      adminClient.from('profiles').select('name').eq('id', userId).single(),
    ]);

    await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [inviteeEmail],
        subject: `${hubOrg?.name || 'LotLine Homes'} invited you to join as a JV partner`,
        html: inviteEmailHtml({
          hubOrgName:  hubOrg?.name  || 'LotLine Homes',
          inviterName: inviterProfile?.name || 'LotLine Homes',
          inviteUrl,
          notes: notes ?? null,
        }),
      }),
    });
  }

  return res.status(201).json({ invitation, inviteUrl });
}
