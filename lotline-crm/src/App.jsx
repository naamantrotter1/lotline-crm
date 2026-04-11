import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import BigRocks from './pages/BigRocks';
import PnlDashboard from './pages/PnlDashboard';
import Analytics from './pages/Analytics';
import IntelligenceView from './pages/IntelligenceView';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="big-rocks" element={<BigRocks />} />
          <Route path="pnl" element={<PnlDashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="intelligence" element={<IntelligenceView />} />
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
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
