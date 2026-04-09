import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import TopFilterBar from './components/TopFilterBar';
import MapView from './components/Map/MapView';
import MarketStats from './pages/MarketStats';
import CompFinder from './pages/CompFinder';
import DealAnalyzer from './pages/DealAnalyzer';
import Pipeline from './pages/Pipeline';
import Reports from './pages/Reports';
import api from './api';

export const AppContext = React.createContext(null);

const TABS = ['Map', 'Market Stats', 'Comp Finder', 'Deal Analyzer', 'Pipeline', 'Reports'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Map');
  const [filters, setFilters] = useState({
    state:          'Both',
    period:         '90d',
    metric:         'median_days_on_market',
    acreageRange:   'All',
    propertyType:   'Manufactured Homes',
    listingStatus:  'sold',
    minPrice:       0,
    maxPrice:       500000,
  });
  const [selectedCounty, setSelectedCounty] = useState(null);
  const [overview, setOverview] = useState(null);
  const [mapLayers, setMapLayers] = useState({
    deals: true, landAcquisition: true, activeListings: true,
  });

  useEffect(() => {
    api.stats.overview({ state: filters.state !== 'Both' ? filters.state : undefined })
      .then(setOverview)
      .catch(() => {});
  }, [filters.state]);

  const ctx = { filters, setFilters, selectedCounty, setSelectedCounty, overview, mapLayers, setMapLayers };

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex flex-col h-screen overflow-hidden bg-surface-base">
        <Navigation
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          overview={overview}
        />
        <TopFilterBar />
        <main className="flex-1 overflow-hidden">
          {activeTab === 'Map'          && <MapView />}
          {activeTab === 'Market Stats' && <MarketStats />}
          {activeTab === 'Comp Finder'  && <CompFinder />}
          {activeTab === 'Deal Analyzer'&& <DealAnalyzer />}
          {activeTab === 'Pipeline'     && <Pipeline />}
          {activeTab === 'Reports'      && <Reports />}
        </main>
      </div>
    </AppContext.Provider>
  );
}
