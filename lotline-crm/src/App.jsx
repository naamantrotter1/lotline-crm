import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { seedDeals } from './utils/seedDeals';
import { DealsProvider } from './lib/DealsContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { usePermissions } from './hooks/usePermissions';
seedDeals();
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BigRocks from './pages/BigRocks';
import PnlDashboard from './pages/PnlDashboard';
import Analytics from './pages/Analytics';
import MarketResearch from './pages/MarketResearch';
import InvestorPortal from './pages/InvestorPortal';
import DealOverview from './pages/DealOverview';
import LandAcquisition from './pages/LandAcquisition';
import DueDiligence from './pages/DueDiligence';
import Development from './pages/Development';
import Sales from './pages/Sales';
import DealDetail from './pages/DealDetail';
import DealCalculator from './pages/DealCalculator';
import HomeModels from './pages/HomeModels';
import CountyDatabase from './pages/CountyDatabase';
import ArvDatabase from './pages/ArvDatabase';
import ContractorDatabase from './pages/ContractorDatabase';
import ArchivedDeals from './pages/ArchivedDeals';
import FloodMap from './pages/FloodMap';
import Homes from './pages/Homes';
import Settings from './pages/Settings';
import Lending from './pages/Lending';
import BuilderNetwork from './pages/BuilderNetwork';
import UserManagement from './pages/UserManagement';

/** Redirects to /login if not authenticated; shows spinner while loading */
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f3ee' }}>
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

/** Redirects non-admins to / */
function AdminRoute({ children }) {
  const { canAdmin } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (!canAdmin) return <Navigate to="/" replace />;
  return children;
}

/** Agent landing: redirect to deal overview if agent, otherwise show Dashboard */
function AgentIndexRoute() {
  const { isAgent } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (isAgent) return <Navigate to="/pipelines/deal-overview" replace />;
  return <Dashboard />;
}

// Routes agents are permitted to access (deal/:id is allowed but guarded in the component)
const AGENT_PERMITTED = new Set([
  '/pipelines/deal-overview',
  '/pipelines/sales',
  '/homes',
]);

/** Redirects agents away from pages they have no access to */
function AgentRoute({ children, path }) {
  const { isAgent } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (isAgent && path && !AGENT_PERMITTED.has('/' + path)) {
    return <Navigate to="/pipelines/deal-overview" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DealsProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* All other routes require authentication */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Agents hitting / are redirected to their landing page */}
              <Route index element={<AgentIndexRoute />} />
              <Route path="big-rocks"   element={<AgentRoute path="big-rocks"><BigRocks /></AgentRoute>} />
              <Route path="pnl"         element={<AgentRoute path="pnl"><PnlDashboard /></AgentRoute>} />
              <Route path="analytics"   element={<AgentRoute path="analytics"><Analytics /></AgentRoute>} />
              <Route path="intelligence" element={<AgentRoute path="intelligence"><MarketResearch /></AgentRoute>} />
              <Route path="investors"   element={<AgentRoute path="investors"><InvestorPortal /></AgentRoute>} />
              <Route path="pipelines/deal-overview" element={<DealOverview />} />
              <Route path="pipelines/land"          element={<AgentRoute path="pipelines/land"><LandAcquisition /></AgentRoute>} />
              <Route path="pipelines/due-diligence" element={<AgentRoute path="pipelines/due-diligence"><DueDiligence /></AgentRoute>} />
              <Route path="pipelines/development"   element={<AgentRoute path="pipelines/development"><Development /></AgentRoute>} />
              <Route path="pipelines/sales"         element={<Sales />} />
              <Route path="deal/:id"    element={<DealDetail />} />
              <Route path="calculator"  element={<AgentRoute path="calculator"><DealCalculator /></AgentRoute>} />
              <Route path="home-models" element={<AgentRoute path="home-models"><HomeModels /></AgentRoute>} />
              <Route path="counties"    element={<AgentRoute path="counties"><CountyDatabase /></AgentRoute>} />
              <Route path="arv"         element={<AgentRoute path="arv"><ArvDatabase /></AgentRoute>} />
              <Route path="contractors" element={<AgentRoute path="contractors"><ContractorDatabase /></AgentRoute>} />
              <Route path="archived"    element={<AgentRoute path="archived"><ArchivedDeals /></AgentRoute>} />
              <Route path="flood-map"   element={<AgentRoute path="flood-map"><FloodMap /></AgentRoute>} />
              <Route path="homes"       element={<AgentRoute path="homes"><Homes /></AgentRoute>} />
              <Route path="lending"     element={<AgentRoute path="lending"><Lending /></AgentRoute>} />
              <Route path="builder-network" element={<AgentRoute path="builder-network"><BuilderNetwork /></AgentRoute>} />
              <Route path="settings"    element={<AgentRoute path="settings"><Settings /></AgentRoute>} />
              {/* Admin-only route */}
              <Route
                path="admin/users"
                element={
                  <AdminRoute>
                    <UserManagement />
                  </AdminRoute>
                }
              />
            </Route>
          </Routes>
        </DealsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
