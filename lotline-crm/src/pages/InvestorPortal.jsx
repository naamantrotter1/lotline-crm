import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Briefcase, ChevronDown, ChevronUp, Mail, Phone } from 'lucide-react';
import { INVESTORS, ALL_DEALS_TABLE } from '../data/investors';
import { useDeals } from '../lib/DealsContext';

const INVESTOR_COLORS = {
  'Atium Build Group LLC': 'bg-blue-100 text-blue-700',
  'Louis Isom': 'bg-purple-100 text-purple-700',
  'Windstone': 'bg-teal-100 text-teal-700',
  'Blue Bay Capital': 'bg-orange-100 text-orange-700',
  'Cash': 'bg-green-100 text-green-700',
  'None': 'bg-gray-100 text-gray-500',
};

function LenderBadge({ name }) {
  const cls = INVESTOR_COLORS[name] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {name}
    </span>
  );
}

// ── Tab: All Deals ──────────────────────────────────────────────────────────
function AllDealsTab() {
  const navigate = useNavigate();
  const handleDealClick = (deal) => {
    const id = findDealId(deal.address);
    if (id) navigate(`/deal/${id}`, { state: { from: 'investor-portal' } });
  };
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Address</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Pipeline</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Stage</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Lender / Capital</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Land Cost</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Construction</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Total Capital</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">ARV</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Close Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ALL_DEALS_TABLE.map((deal, i) => (
              <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDealClick(deal)}>
                <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px]">{deal.address}</td>
                <td className="px-4 py-2.5 text-gray-600">{deal.pipeline}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{deal.stage}</span>
                </td>
                <td className="px-4 py-2.5">
                  <LenderBadge name={deal.lender} />
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.landCost.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.construction.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-800">${deal.totalCapital.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.arv.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{deal.closeDate || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Investor Card (By Investor tab) ─────────────────────────────────────────
function InvestorCard({ investor }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isCash = investor.name === 'Cash';
  const handleDealClick = (deal) => {
    const id = findDealId(deal.address);
    if (id) navigate(`/deal/${id}`, { state: { from: 'investor-portal' } });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Users size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a2332]">{investor.name}</h3>
              <p className="text-xs text-gray-400">{isCash ? 'Cash Deals' : investor.name}</p>
            </div>
          </div>
          <span className="bg-accent/10 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
            {investor.activeDeals} {investor.activeDeals === 1 ? 'deal' : 'deals'}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{isCash ? 'Total Build Cost' : 'Capital Invested'}</p>
            <p className="text-base font-bold text-[#1a2332]">${investor.capitalInvested.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">Total Returns</p>
            <p className="text-base font-bold text-gray-400">${investor.totalReturns.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-400">ROI %</p>
            <p className="text-sm font-bold text-green-600">{investor.roiPct.toFixed(2)}%</p>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-400">ROI</p>
            <p className="text-sm font-bold text-blue-600">${investor.roiDollars.toLocaleString()}</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-xs text-gray-400">Ann. ROI</p>
            <p className="text-sm font-bold text-purple-600">{investor.avgAnnualizedRoi.toFixed(2)}%</p>
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors hover:bg-gray-50"
        >
          <span>View Deals</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded deals */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {ALL_DEALS_TABLE.filter(d => d.lender === investor.name).map((deal, i) => (
            <div
              key={i}
              className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleDealClick(deal)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{deal.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{deal.stage}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Capital</p>
                  <p className="text-xs font-bold text-gray-800">${deal.totalCapital.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                <span>Land: ${deal.landCost.toLocaleString()}</span>
                <span>Build: ${deal.construction.toLocaleString()}</span>
                <span>ARV: ${deal.arv.toLocaleString()}</span>
                {deal.closeDate && <span>Close: {deal.closeDate}</span>}
              </div>
            </div>
          ))}
          {ALL_DEALS_TABLE.filter(d => d.lender === investor.name).length === 0 && (
            <div className="px-5 py-4 text-xs text-gray-400 text-center">No deals assigned yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: By Investor ─────────────────────────────────────────────────────────
function ByInvestorTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {INVESTORS.map(inv => (
        <InvestorCard key={inv.id} investor={inv} />
      ))}
    </div>
  );
}

// ── Tab: Directory ───────────────────────────────────────────────────────────
function DirectoryTab() {
  const contacts = INVESTORS.filter(i => i.contact && i.name !== 'Cash');
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Investor</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Contact</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Phone</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Standard Terms</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Deals</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {contacts.map(inv => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Users size={13} className="text-accent" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800">{inv.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-700">{inv.contact || '—'}</td>
              <td className="px-4 py-3">
                {inv.email ? (
                  <a href={`mailto:${inv.email}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                    <Mail size={11} /> {inv.email}
                  </a>
                ) : <span className="text-xs text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3">
                {inv.phone ? (
                  <a href={`tel:${inv.phone}`} className="text-xs text-gray-700 flex items-center gap-1 hover:text-accent">
                    <Phone size={11} /> {inv.phone}
                  </a>
                ) : <span className="text-xs text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">{inv.standardTerms || '—'}</td>
              <td className="px-4 py-3">
                <span className="text-xs font-medium text-accent">{inv.activeDeals} {inv.activeDeals === 1 ? 'deal' : 'deals'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Investor Portal ──────────────────────────────────────────────────────
export default function InvestorPortal() {
  const { deals: customDeals } = useDeals();
  const [activeTab, setActiveTab] = useState('by-investor');

  const findDealId = (address) => {
    const norm = a => a.trim().toLowerCase();
    const match = customDeals.find(d => norm(d.address || '') === norm(address));
    return match?.id ?? null;
  };

  const totalCapital = INVESTORS.reduce((s, i) => s + i.capitalInvested, 0);
  const totalDeals = INVESTORS.reduce((s, i) => s + i.activeDeals, 0);
  const totalROI = INVESTORS.reduce((s, i) => s + i.roiDollars, 0);

  const TABS = [
    { key: 'all-deals', label: 'All Deals' },
    { key: 'by-investor', label: 'By Investor' },
    { key: 'directory', label: 'Directory' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-[#1a2332]">Investor Portal</h1>
        </div>
        <p className="text-sm text-gray-400">Manage capital sources and investor relationships</p>

        {/* Tabs */}
        <div className="flex gap-0 mt-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Active Investors', value: INVESTORS.filter(i => i.name !== 'Cash').length, icon: Users },
            { label: 'Total Capital Deployed', value: `$${totalCapital.toLocaleString()}`, icon: DollarSign },
            { label: 'Active Deals Funded', value: totalDeals, icon: Briefcase },
            { label: 'Total Projected ROI', value: `$${totalROI.toLocaleString()}`, icon: TrendingUp },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <stat.icon size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-[#1a2332]">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'all-deals' && <AllDealsTab />}
        {activeTab === 'by-investor' && <ByInvestorTab />}
        {activeTab === 'directory' && <DirectoryTab />}
      </div>
    </div>
  );
}
