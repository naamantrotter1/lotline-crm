/**
 * POST /api/account/cancel
 * Cancels the caller's subscription and permanently deletes their auth user.
 * Requires a valid Bearer JWT in the Authorization header.
 */
import { makeAdminClient, requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireOrgMember(req, res);
  if (!auth) return; // requireOrgMember already sent the error response

  const { adminClient, userId } = auth;

  // Delete the user from Supabase Auth — this cascades to profiles, memberships, etc.
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
