import { useAuth } from '../lib/AuthContext';

/**
 * Returns permission flags derived from the current user's role.
 *   admin  → canEdit + canAdmin (full access + user management)
 *   editor → canEdit only (create/edit deals, no user management)
 *   viewer → read-only (default for new signups)
 *   agent  → Deal Overview + Sales only; can move stages; cannot edit fields
 */
export function usePermissions() {
  const { role } = useAuth();
  const isAgent    = role === 'agent';
  const isInvestor = role === 'investor';
  return {
    canEdit:  role === 'admin' || role === 'editor',
    canAdmin: role === 'admin',
    isViewer: role === 'viewer' || role === null,
    isAgent,
    isInvestor,
    role,
  };
}
