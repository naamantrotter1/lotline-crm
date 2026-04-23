/**
 * Sends JV-related notification emails via Resend.
 * Mirrors the pattern of sendInviteEmail.js.
 */

const RESEND_API = 'https://api.resend.com/emails';
const FROM       = 'LotLine Homes <no-reply@lotlinehomes.com>';

function html({ proposerName, hubOrgName, partnerName, ownershipPct, reviewUrl, notes }) {
  const ownershipLine = ownershipPct != null
    ? `<p style="margin:0 0 12px"><strong>Claimed ownership:</strong> ${ownershipPct}%</p>`
    : '';
  const notesLine = notes
    ? `<p style="margin:0 0 12px"><strong>Message:</strong> ${notes}</p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body
    style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;margin:0;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:#1a2332;padding:32px 32px 24px;text-align:center">
        <p style="color:rgba(255,255,255,.5);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px">LotLine Homes</p>
        <h1 style="color:#fff;font-size:22px;margin:0">Joint Venture Proposal</h1>
      </div>
      <div style="padding:28px 32px">
        <p style="color:#374151;margin:0 0 16px">Hi there,</p>
        <p style="color:#374151;margin:0 0 16px">
          <strong>${proposerName}</strong> from <strong>${hubOrgName}</strong> has proposed a Joint Venture partnership with <strong>${partnerName}</strong>.
        </p>
        ${ownershipLine}
        ${notesLine}
        <p style="color:#374151;margin:0 0 24px">
          Review the proposal — including the requested data access permissions — and accept or decline at the link below.
        </p>
        <a href="${reviewUrl}"
           style="display:inline-block;background:#c8613a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px">
          Review Proposal →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
          You received this because you are an Owner or Admin of ${partnerName} on LotLine.
        </p>
      </div>
    </div>
  </body></html>`;
}

/**
 * @param {{ to: string[], proposerName: string, hubOrgName: string, partnerName: string,
 *           ownershipPct: number|null, reviewUrl: string, notes: string|null }} opts
 */
export async function sendJvProposalEmail(opts) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[sendJvEmail] RESEND_API_KEY not set — skipping email');
    return;
  }

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (recipients.length === 0) return;

  await fetch(RESEND_API, {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    FROM,
      to:      recipients,
      subject: `Joint Venture proposal from ${opts.hubOrgName}`,
      html:    html(opts),
    }),
  });
}
