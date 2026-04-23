import { useAuth } from '../lib/AuthContext';

/**
 * Returns permission flags derived from the user's org-level role (memberships.role)
 * and profile-level role (profiles.role — for investor/agent detection only).
 *
 * ROLE HIERARCHY (orgRole, from memberships):
 *   owner    → full access including billing/org deletion
 *   admin    → full data + team management; no billing/deletion
 *   operator → create/edit/delete deals & investor data; no team/billing
 *   viewer   → read-only; no mutations
 *
 * profiles.role ('realtor', 'investor') is kept separately for routing guards.
 */
export function usePermissions() {
  const { role, orgRole, can } = useAuth();

  const isAgent    = role === 'realtor';
  const isInvestor = role === 'investor';

  return {
    // Fine-grained capability check (preferred for new code)
    can,

    // Current org-level role string
    orgRole,

    // Role-type flags (profiles.role — routing/portal detection only)
    isAgent,
    isInvestor,

    // Legacy aliases (kept for existing callers — prefer can() for new code)
    canEdit:  can('deal.create'),
    canAdmin: can('team.view'),
    isViewer: orgRole === 'viewer' || !orgRole,
  };
}
