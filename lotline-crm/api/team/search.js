// GET /api/team/search?q=alice&deal_id=<uuid>
//
// Returns active org members whose name matches `q` (case-insensitive prefix).
// Used by the @mention autocomplete popover in the Activity feed and Thread
// message composers.
//
// Response shape:
// {
//   members: [
//     { id, first_name, last_name, name, email, role, avatar_url, is_jv_partner: false }
//   ]
// }
//
// JV-partner members: if deal_id is provided AND the caller's org has an active JV
// where permissions_on_partner grants thread.reply or comment.create, partner-org
// members matching the query are appended with is_jv_partner: true.
//
// Security: RLS is NOT relied on here — the service role is used to fetch profiles
// efficiently. Org isolation is enforced manually (org membership check below).
// Cross-org results are never returned unless an active JV with the correct
// permissions explicitly grants access.

import { requireOrgMember } from '../_lib/teamAuth.js';

const JV_MENTION_PERMISSIONS = ['thread.reply', 'comment.create'];

function normalizeName(p) {
  if (p.name) return p.name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : (p.email || '');
}

function matchesQuery(member, q) {
  if (!q) return true;
  const name  = normalizeName(member.profiles || member).toLowerCase();
  const email = (member.profiles?.email || member.email || '').toLowerCase();
  return name.includes(q) || email.includes(q);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId: callerId, orgId } = auth;
  const q       = (req.query.q || '').trim().toLowerCase();
  const dealId  = req.query.deal_id || null;

  // ── Own org members ────────────────────────────────────────────────────────
  const { data: memberships, error: memErr } = await adminClient
    .from('memberships')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (memErr) return res.status(500).json({ error: memErr.message });

  const memberUserIds = (memberships || []).map(m => m.user_id);
  const roleMap       = Object.fromEntries((memberships || []).map(m => [m.user_id, m.role]));

  // Fetch profiles + auth emails in parallel
  const [{ data: profiles }, { data: authData }] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, name, first_name, last_name, avatar_url')
      .in('id', memberUserIds),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  const emailMap   = Object.fromEntries(
    ((authData?.users) || [])
      .filter(u => memberUserIds.includes(u.id))
      .map(u => [u.id, u.email]),
  );

  let ownMembers = memberUserIds.map(uid => {
    const p    = profileMap[uid] || {};
    const email = emailMap[uid] || null;
    return {
      id:           uid,
      first_name:   p.first_name || null,
      last_name:    p.last_name  || null,
      name:         p.name       || [p.first_name, p.last_name].filter(Boolean).join(' ') || email || 'Unknown',
      email,
      role:         roleMap[uid] || 'viewer',
      avatar_url:   p.avatar_url || null,
      is_jv_partner: false,
    };
  });

  // Filter by query, exclude self
  ownMembers = ownMembers.filter(m =>
    m.id !== callerId && matchesQuery(m, q)
  );

  // ── JV partner members (if deal_id provided) ───────────────────────────────
  let partnerMembers = [];

  if (dealId) {
    // Find active JVs where this org is the host
    const { data: jvs } = await adminClient
      .from('joint_ventures')
      .select('id, partner_organization_id, permissions_on_partner')
      .eq('host_organization_id', orgId)
      .eq('status', 'active');

    for (const jv of jvs || []) {
      const perms = jv.permissions_on_partner || {};
      const canMention = JV_MENTION_PERMISSIONS.some(p => perms[p]);
      if (!canMention) continue;

      const { data: partnerMems } = await adminClient
        .from('memberships')
        .select('user_id, role')
        .eq('organization_id', jv.partner_organization_id)
        .eq('status', 'active');

      if (!partnerMems?.length) continue;

      const partnerIds = partnerMems.map(m => m.user_id);
      const [{ data: pProfiles }, { data: pAuth }] = await Promise.all([
        adminClient.from('profiles').select('id, name, first_name, last_name, avatar_url').in('id', partnerIds),
        adminClient.auth.admin.listUsers({ perPage: 1000 }),
      ]);

      const pProfileMap = Object.fromEntries((pProfiles || []).map(p => [p.id, p]));
      const pEmailMap   = Object.fromEntries(
        ((pAuth?.users) || [])
          .filter(u => partnerIds.includes(u.id))
          .map(u => [u.id, u.email]),
      );
      const pRoleMap = Object.fromEntries(partnerMems.map(m => [m.user_id, m.role]));

      const eligible = partnerIds
        .filter(uid => uid !== callerId)
        .map(uid => {
          const p     = pProfileMap[uid] || {};
          const email = pEmailMap[uid]   || null;
          return {
            id:            uid,
            first_name:    p.first_name || null,
            last_name:     p.last_name  || null,
            name:          p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || email || 'Unknown',
            email,
            role:          pRoleMap[uid] || 'viewer',
            avatar_url:    p.avatar_url || null,
            is_jv_partner: true,
            jv_org_name:   null, // enriched below if needed
          };
        })
        .filter(m => matchesQuery(m, q));

      partnerMembers.push(...eligible);
    }
  }

  const members = [...ownMembers, ...partnerMembers]
    .slice(0, 20); // cap autocomplete at 20

  return res.status(200).json({ members });
}
