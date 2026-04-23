// POST /api/jv/propose
// Hub-only. Creates a new JV proposal (status = proposed).
// Body: { partnerOrgId, ownershipPct, permissionsOnPartner, agreementDocumentUrl, notes }
import { requireJvHubAuth, isAdmin } from '../_lib/teamAuth.js';
import { sendJvProposalEmail } from '../_lib/sendJvEmail.js';

const DEFAULT_PERMISSIONS = {
  'deal.view':          true,
  'investor.view':      true,
  'capital_stack.view': true,
  'document.view':      true,
  'distribution.view':  true,
  'draw_schedule.view': true,
  'deal.edit':          false,
  'investor.edit':      false,
  'capital_stack.edit': false,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireJvHubAuth(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can propose JVs.' });
  }

  const {
    partnerOrgId,
    ownershipPct,
    permissionsOnPartner,
    agreementDocumentUrl,
    notes,
  } = req.body || {};

  if (!partnerOrgId) return res.status(400).json({ error: 'partnerOrgId is required.' });

  // Verify partner org exists and is active
  const { data: partnerOrg } = await adminClient
    .from('organizations')
    .select('id, name, slug, status, owner_user_id')
    .eq('id', partnerOrgId)
    .eq('status', 'active')
    .single();

  if (!partnerOrg) return res.status(404).json({ error: 'Partner organization not found or inactive.' });

  // Block if a non-terminated JV already exists with this partner
  const { data: existing } = await adminClient
    .from('joint_ventures')
    .select('id, status')
    .eq('host_organization_id', orgId)
    .eq('partner_organization_id', partnerOrgId)
    .in('status', ['proposed', 'active', 'suspended'])
    .maybeSingle();

  if (existing) {
    return res.status(409).json({
      error: `A JV already exists with this partner (status: ${existing.status}). Edit the existing JV instead.`,
    });
  }

  const permissions = permissionsOnPartner || DEFAULT_PERMISSIONS;

  const { data: jv, error } = await adminClient
    .from('joint_ventures')
    .insert({
      host_organization_id:    orgId,
      partner_organization_id: partnerOrgId,
      host_ownership_pct:      ownershipPct ?? null,
      permissions_on_partner:  permissions,
      agreement_document_url:  agreementDocumentUrl ?? null,
      notes:                   notes ?? null,
      status:                  'proposed',
      proposed_by_user_id:     userId,
      proposed_at:             new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Fetch hub org name + proposer name for email
  const [{ data: hubOrg }, { data: proposerProfile }] = await Promise.all([
    adminClient.from('organizations').select('name').eq('id', orgId).single(),
    adminClient.from('profiles').select('name, first_name').eq('id', userId).single(),
  ]);

  // Fetch partner org Owner + Admin emails for notification
  const { data: partnerAdmins } = await adminClient
    .from('memberships')
    .select('user_id')
    .eq('organization_id', partnerOrgId)
    .in('role', ['owner', 'admin'])
    .eq('status', 'active');

  const adminIds = (partnerAdmins || []).map(m => m.user_id);
  if (adminIds.length > 0) {
    const { data: adminUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const emails = (adminUsers?.users || [])
      .filter(u => adminIds.includes(u.id))
      .map(u => u.email)
      .filter(Boolean);

    const proposerName = proposerProfile?.name || proposerProfile?.first_name || 'LotLine Homes';
    const origin = req.headers.origin ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://lotline-crm.vercel.app');

    await sendJvProposalEmail({
      to:           emails,
      proposerName,
      hubOrgName:   hubOrg?.name || 'LotLine Homes',
      partnerName:  partnerOrg.name,
      ownershipPct: ownershipPct ?? null,
      reviewUrl:    `${origin}/settings/joint-ventures?tab=pending&jv=${jv.id}`,
      notes:        notes ?? null,
    });
  }

  return res.status(201).json({ jv });
}
