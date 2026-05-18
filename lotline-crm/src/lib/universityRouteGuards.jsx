// Route guards for /university
// - UniversityRoute: any authenticated operator (subscriber). Investors → /investors.
// - UniversityAdminRoute: only members of an org with is_university_publisher=true.
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function UniversityRoute({ children }) {
  const { accountType, loading } = useAuth();
  if (loading) return null;
  if (accountType === 'investor') return <Navigate to="/investors" replace />;
  return children;
}

export function UniversityAdminRoute({ children }) {
  const { orgIsUniversityPublisher, loading } = useAuth();
  if (loading) return null;
  if (!orgIsUniversityPublisher) return <Navigate to="/university" replace />;
  return children;
}
