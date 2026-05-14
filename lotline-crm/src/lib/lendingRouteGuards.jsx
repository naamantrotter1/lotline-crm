/**
 * Route guards for the LotLine Lending Hub feature.
 *
 * LendingHubRoute    — /lending hub pages; non-hub orgs → /dashboard
 * LendingSubmitterRoute — /lending/my-submissions; hub orgs → /dashboard
 *
 * Both guards wait for AuthContext to finish loading so they don't flash
 * a redirect on a hard refresh before the org context hydrates.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function LendingHubRoute({ children }) {
  const { orgIsLendingHub, loading } = useAuth();
  if (loading) return null;
  if (!orgIsLendingHub) return <Navigate to="/dashboard" replace />;
  return children;
}

export function LendingSubmitterRoute({ children }) {
  const { orgIsLendingHub, loading } = useAuth();
  if (loading) return null;
  if (orgIsLendingHub) return <Navigate to="/dashboard" replace />;
  return children;
}
