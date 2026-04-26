import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Component } from 'react';
import { DealsProvider } from './lib/DealsContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { JvProvider } from './lib/JvContext';
import { usePermissions } from './hooks/usePermissions';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: 'monospace', padding: 32, background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#c8613a', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 800 }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
            style={{ marginTop: 16, color: '#c8613a', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', fontSize: 14 }}
          >
            ← Go back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

class DealErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: 'monospace', padding: 32 }}>
          <h2 style={{ color: '#c8613a', marginBottom: 12 }}>Deal page error</h2>
          <pre style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 800 }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
            style={{ marginTop: 16, color: '#c8613a', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', fontSize: 14 }}
          >
            ← Go back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Landing from './pages/marketing/Landing';
import Features from './pages/marketing/Features';
import Pricing from './pages/marketing/Pricing';
import About from './pages/marketing/About';
import Contact from './pages/marketing/Contact';
import Terms from './pages/marketing/Terms';
import Privacy from './pages/marketing/Privacy';
import InvestorLayout from './components/InvestorLayout';
import InvestorHome from './pages/investor/InvestorHome';
import InvestorDeals from './pages/investor/InvestorDeals';
import InvestorDealDetail from './pages/investor/InvestorDealDetail';
import InvestorDocuments from './pages/investor/InvestorDocuments';
import InvestorUpdates from './pages/investor/InvestorUpdates';
import InvestorDistributions from './pages/investor/InvestorDistributions';
import InvestorOpportunities from './pages/investor/InvestorOpportunities';
import InvestorMessages from './pages/investor/InvestorMessages';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import SignUp from './pages/SignUp';
import Onboarding from './pages/Onboarding';
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
import JointVentures from './pages/JointVentures';
import Lending from './pages/Lending';
import PooledLoanDetail from './pages/PooledLoanDetail';
import BuilderNetwork from './pages/BuilderNetwork';
import UserManagement from './pages/UserManagement';
import AcceptInvite from './pages/AcceptInvite';
import JvJoinPage from './pages/JvJoinPage';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import SmsInbox from './pages/SmsInbox';
import SmsCampaigns from './pages/SmsCampaigns';
import CalendarView from './pages/CalendarView';
import SchedulerPage from './pages/SchedulerPage';
import ESign from './pages/ESign';
import LeadForms from './pages/LeadForms';
import LeadFormPublic from './pages/LeadFormPublic';
import Dedupe from './pages/Dedupe';
import AiAssistant from './pages/AiAssistant';
import PropertyData from './pages/PropertyData';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import CreateAccount from './pages/CreateAccount';

/** Redirects to /login if not authenticated; shows spinner while loading.
 *  Special case: unauthenticated users hitting exactly "/" see the marketing landing page. */
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f3ee' }}>
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) {
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * Redirects operator/admin/agent users who have no active_organization_id
 * to /onboarding so they complete workspace setup first.
 * Investors are excluded — they don't own an org.
 */
function OnboardingGuard({ children }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  const role = profile?.role;
  const needsOnboarding =
    profile &&
    role !== 'investor' &&
    !profile.active_organization_id;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return children;
}

/** Redirects non-admins (owner/admin) to / */
function AdminRoute({ children }) {
  const { can } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (!can('team.view')) return <Navigate to="/" replace />;
  return children;
}

/** Agent/Investor landing: redirect to role landing page */
function AgentIndexRoute() {
  const { isAgent, isInvestor } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (isAgent)    return <Navigate to="/pipelines/deal-overview" replace />;
  if (isInvestor) return <Navigate to="/investor/home" replace />;
  return <Dashboard />;
}

// Routes agents are permitted to access (deal/:id is allowed but guarded in the component)
const AGENT_PERMITTED = new Set([
  '/pipelines/deal-overview',
  '/pipelines/sales',
  '/homes',
  '/flood-map',
]);

// Routes investor-role users are permitted to access
const INVESTOR_PERMITTED = new Set([
  '/investors',
  '/investor/home',
  '/investor/deals',
  '/investor/distributions',
  '/investor/updates',
  '/investor/documents',
  '/investor/opportunities',
  '/investor/messages',
]);

/** Gate for investor-only routes: operators can also enter via impersonation */
function InvestorRoute({ children }) {
  const { isInvestor, canEdit, canAdmin } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  // Operators are allowed in (they may be impersonating)
  if (isInvestor || canEdit || canAdmin) return children;
  return <Navigate to="/" replace />;
}

/** Redirects agents/investors away from pages they have no access to */
function AgentRoute({ children, path }) {
  const { isAgent, isInvestor } = usePermissions();
  const { loading } = useAuth();
  if (loading) return null;
  if (isAgent    && path && !AGENT_PERMITTED.has('/' + path)) {
    return <Navigate to="/pipelines/deal-overview" replace />;
  }
  if (isInvestor && path && !INVESTOR_PERMITTED.has('/' + path)) {
    return <Navigate to="/investor/home" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AppErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <JvProvider>
        <DealsProvider>
          <Routes>
            {/* Public marketing routes */}
            <Route path="/features" element={<Features />} />
            <Route path="/pricing"  element={<Pricing />} />
            <Route path="/about"    element={<About />} />
            <Route path="/contact"  element={<Contact />} />
            <Route path="/terms"    element={<Terms />} />
            <Route path="/privacy"  element={<Privacy />} />

            {/* Auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Invitation acceptance — public but session-aware */}
            <Route path="/invite/:token" element={<AcceptInvite />} />

            {/* JV partner invitation signup — fully public */}
            <Route path="/join/:token" element={<JvJoinPage />} />

            {/* Public scheduler booking page */}
            <Route path="/schedule/:slug" element={<SchedulerPage />} />

            {/* Public lead form */}
            <Route path="/f/:slug" element={<LeadFormPublic />} />

            {/* Purchasing flow */}
            <Route path="/cart"           element={<Cart />} />
            <Route path="/checkout"       element={<Checkout />} />
            <Route path="/create-account" element={<CreateAccount />} />

            {/* Onboarding — authenticated but no org yet */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* All other routes require authentication + completed onboarding */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Layout />
                  </OnboardingGuard>
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
              <Route path="deal/:id"    element={<DealErrorBoundary><DealDetail /></DealErrorBoundary>} />
              <Route path="calculator"  element={<AgentRoute path="calculator"><DealCalculator /></AgentRoute>} />
              <Route path="home-models" element={<AgentRoute path="home-models"><HomeModels /></AgentRoute>} />
              <Route path="counties"    element={<AgentRoute path="counties"><CountyDatabase /></AgentRoute>} />
              <Route path="arv"         element={<AgentRoute path="arv"><ArvDatabase /></AgentRoute>} />
              <Route path="contractors" element={<AgentRoute path="contractors"><ContractorDatabase /></AgentRoute>} />
              <Route path="archived"    element={<AgentRoute path="archived"><ArchivedDeals /></AgentRoute>} />
              <Route path="flood-map"   element={<AgentRoute path="flood-map"><FloodMap /></AgentRoute>} />
              <Route path="homes"       element={<AgentRoute path="homes"><Homes /></AgentRoute>} />
              <Route path="lending"     element={<AgentRoute path="lending"><Lending /></AgentRoute>} />
              <Route path="lending/pooled-loans/:id" element={<AgentRoute path="lending"><PooledLoanDetail /></AgentRoute>} />
              <Route path="builder-network" element={<AgentRoute path="builder-network"><BuilderNetwork /></AgentRoute>} />
              <Route path="contacts"             element={<AgentRoute path="contacts"><Contacts /></AgentRoute>} />
              <Route path="contacts/:id"        element={<AgentRoute path="contacts"><ContactDetail /></AgentRoute>} />
              <Route path="tasks"               element={<AgentRoute path="tasks"><Tasks /></AgentRoute>} />
              <Route path="reports"             element={<AgentRoute path="reports"><Reports /></AgentRoute>} />
              <Route path="workflows"           element={<AgentRoute path="workflows"><Workflows /></AgentRoute>} />
              <Route path="workflows/:id"       element={<AgentRoute path="workflows"><WorkflowBuilder /></AgentRoute>} />
              <Route path="sms"                 element={<AgentRoute path="sms"><SmsInbox /></AgentRoute>} />
              <Route path="sms/campaigns"       element={<AgentRoute path="sms"><SmsCampaigns /></AgentRoute>} />
              <Route path="calendar"            element={<AgentRoute path="calendar"><CalendarView /></AgentRoute>} />
              <Route path="esign"               element={<AgentRoute path="esign"><ESign /></AgentRoute>} />
              <Route path="lead-forms"          element={<AgentRoute path="lead-forms"><LeadForms /></AgentRoute>} />
              <Route path="dedupe"              element={<AgentRoute path="dedupe"><Dedupe /></AgentRoute>} />
              <Route path="ai"                  element={<AgentRoute path="ai"><AiAssistant /></AgentRoute>} />
              <Route path="property-data"       element={<AgentRoute path="property-data"><PropertyData /></AgentRoute>} />
              <Route path="settings"             element={<AgentRoute path="settings"><Settings /></AgentRoute>} />
              <Route path="settings/joint-ventures" element={<AgentRoute path="settings/joint-ventures"><JointVentures /></AgentRoute>} />
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

            {/* ── Investor Portal (dual-mode: investor login or operator impersonation) */}
            <Route
              path="/investor"
              element={
                <ProtectedRoute>
                  <InvestorRoute>
                    <InvestorLayout />
                  </InvestorRoute>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/investor/home" replace />} />
              <Route path="home"                  element={<InvestorHome />} />
              <Route path="deals"                 element={<InvestorDeals />} />
              <Route path="deals/:id"             element={<InvestorDealDetail />} />
              <Route path="distributions"         element={<InvestorDistributions />} />
              <Route path="updates"               element={<InvestorUpdates />} />
              <Route path="documents"             element={<InvestorDocuments />} />
              <Route path="opportunities"         element={<InvestorOpportunities />} />
              <Route path="messages"              element={<InvestorMessages />} />
            </Route>
          </Routes>
        </DealsProvider>
        </JvProvider>
      </AuthProvider>
    </BrowserRouter>
    </AppErrorBoundary>
  );
}
