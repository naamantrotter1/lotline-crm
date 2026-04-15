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
              <Route index element={<Dashboard />} />
              <Route path="big-rocks" element={<BigRocks />} />
              <Route path="pnl" element={<PnlDashboard />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="intelligence" element={<MarketResearch />} />
              <Route path="investors" element={<InvestorPortal />} />
              <Route path="pipelines/deal-overview" element={<DealOverview />} />
              <Route path="pipelines/land" element={<LandAcquisition />} />
              <Route path="pipelines/due-diligence" element={<DueDiligence />} />
              <Route path="pipelines/development" element={<Development />} />
              <Route path="pipelines/sales" element={<Sales />} />
              <Route path="deal/:id" element={<DealDetail />} />
              <Route path="calculator" element={<DealCalculator />} />
              <Route path="home-models" element={<HomeModels />} />
              <Route path="counties" element={<CountyDatabase />} />
              <Route path="arv" element={<ArvDatabase />} />
              <Route path="contractors" element={<ContractorDatabase />} />
              <Route path="archived" element={<ArchivedDeals />} />
              <Route path="flood-map" element={<FloodMap />} />
              <Route path="homes" element={<Homes />} />
              <Route path="lending" element={<Lending />} />
              <Route path="builder-network" element={<BuilderNetwork />} />
              <Route path="settings" element={<Settings />} />
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
