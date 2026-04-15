import { useAuth } from '../lib/AuthContext';

/**
 * Returns permission flags derived from the current user's role.
 *   admin  → canEdit + canAdmin (full access + user management)
 *   editor → canEdit only (create/edit deals, no user management)
 *   viewer → read-only (default for new signups)
 */
export function usePermissions() {
  const { role } = useAuth();
  return {
    canEdit:  role === 'admin' || role === 'editor',
    canAdmin: role === 'admin',
    isViewer: role === 'viewer' || role === null,
    role,
  };
}
