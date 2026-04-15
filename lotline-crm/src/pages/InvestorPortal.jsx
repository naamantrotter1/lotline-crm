import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Briefcase, ChevronDown, ChevronUp, Mail, Phone, X, UserPlus } from 'lucide-react';
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
function AllDealsTab({ onDealClick }) {
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
              <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDealClick(deal)}>
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
function InvestorCard({ investor, onDealClick }) {
  const [expanded, setExpanded] = useState(false);
  const isCash = investor.name === 'Cash';

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
              onClick={() => onDealClick(deal)}
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

// ── Assign Funder Modal ───────────────────────────────────────────────────────
function AssignFunderModal({ deal, investors, onAssign, onClose }) {
  const [mode, setMode] = useState('existing');
  const [selected, setSelected] = useState('');
  const [terms, setTerms] = useState('');
  const [newName, setNewName] = useState('');
  const [newTerms, setNewTerms] = useState('');

  const existingInv = investors.find(i => i.name === selected);

  const handleSubmit = () => {
    if (mode === 'existing' && selected) {
      onAssign({ funderName: selected, terms: terms || existingInv?.standardTerms || '' });
    } else if (mode === 'new' && newName.trim()) {
      onAssign({ funderName: newName.trim(), terms: newTerms, isNew: true, newInvestor: { name: newName.trim(), standardTerms: newTerms } });
    }
  };

  const canSubmit = mode === 'existing' ? !!selected : !!newName.trim();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Assign Funder</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{deal.address}</p>
            <p className="text-xs text-gray-500 mt-0.5">Capital needed: <span className="font-semibold text-gray-700">${deal.totalCapital.toLocaleString()}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4 flex gap-2">
          {['existing', 'new'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                mode === m ? 'bg-accent text-white border-accent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {m === 'existing' ? 'Existing Investor' : 'Add New Investor'}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">
          {mode === 'existing' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Investor</label>
                <select
                  value={selected}
                  onChange={e => { setSelected(e.target.value); setTerms(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">— Choose investor —</option>
                  {investors.map(inv => (
                    <option key={inv.name} value={inv.name}>{inv.name}</option>
                  ))}
                </select>
              </div>
              {existingInv?.standardTerms && (
                <p className="text-xs text-gray-400">Standard terms: <span className="font-medium text-gray-600">{existingInv.standardTerms}</span></p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Terms <span className="text-gray-400 font-normal">(override, optional)</span></label>
                <input
                  type="text"
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  placeholder={existingInv?.standardTerms || 'e.g. 3 and 13, 10% interest'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Investor Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. John Smith Capital"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Terms</label>
                <input
                  type="text"
                  value={newTerms}
                  onChange={e => setNewTerms(e.target.value)}
                  placeholder="e.g. 3 and 13, 10% interest, 12 months"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus size={12} /> Assign Funder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Needs Funding ───────────────────────────────────────────────────────
function NeedsFundingTab({ onDealClick }) {
  const UNFUNDED = ['Cash', 'None', '', null, undefined];
  const allUnfunded = ALL_DEALS_TABLE.filter(d => UNFUNDED.includes(d.lender));

  // Persist assignments & new investors across sessions
  const [assignments, setAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_assignments') || '{}'); } catch { return {}; }
  });
  const [extraInvestors, setExtraInvestors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_extra_investors') || '[]'); } catch { return []; }
  });
  const [modalDeal, setModalDeal] = useState(null);

  // Once assigned, deal leaves the list
  const deals = allUnfunded.filter(d => !assignments[d.address]);
  const totalNeeded = deals.reduce((s, d) => s + d.totalCapital, 0);

  const allInvestors = [
    ...INVESTORS.filter(i => i.name !== 'Cash' && i.name !== 'None'),
    ...extraInvestors,
  ];

  const handleAssign = ({ funderName, terms, isNew, newInvestor }) => {
    if (isNew && newInvestor) {
      const updated = [...extraInvestors, newInvestor];
      setExtraInvestors(updated);
      localStorage.setItem('nf_extra_investors', JSON.stringify(updated));
    }
    const updated = { ...assignments, [modalDeal.address]: { funder: funderName, terms } };
    setAssignments(updated);
    localStorage.setItem('nf_assignments', JSON.stringify(updated));
    setModalDeal(null);
  };

  return (
    <div>
      {/* Summary banner */}
      <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <DollarSign size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-bold">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span> need{deals.length === 1 ? 's' : ''} funding —{' '}
          <span className="font-bold">${totalNeeded.toLocaleString()}</span> total capital required
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          All deals have a funder assigned.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Address</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Stage</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Total Capital</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">ARV</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map((deal, i) => (
                <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDealClick(deal)}>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                    <div>{deal.address}</div>
                    <div className="text-gray-400 font-normal mt-0.5">{deal.pipeline}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{deal.stage}</span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.lender === 'Cash'
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Cash</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">No Funder</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">${deal.totalCapital.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${deal.arv.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setModalDeal(deal); }}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors whitespace-nowrap"
                    >
                      <UserPlus size={11} /> Assign Funder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalDeal && (
        <AssignFunderModal
          deal={modalDeal}
          investors={allInvestors}
          onAssign={handleAssign}
          onClose={() => setModalDeal(null)}
        />
      )}
    </div>
  );
}

// ── Tab: By Investor ─────────────────────────────────────────────────────────
function ByInvestorTab({ onDealClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {INVESTORS.map(inv => (
        <InvestorCard key={inv.id} investor={inv} onDealClick={onDealClick} />
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('by-investor');
  const findDealId = (address) => {
    const norm = a => a.trim().toLowerCase();
    const match = customDeals.find(d => norm(d.address || '') === norm(address));
    return match?.id ?? null;
  };

  const handleDealClick = (deal) => {
    const id = findDealId(deal.address);
    if (id) navigate(`/deal/${id}`, { state: { from: 'investor-portal' } });
  };

  const totalCapital = INVESTORS.reduce((s, i) => s + i.capitalInvested, 0);
  const totalDeals = INVESTORS.reduce((s, i) => s + i.activeDeals, 0);
  const totalROI = INVESTORS.reduce((s, i) => s + i.roiDollars, 0);

  const TABS = [
    { key: 'all-deals', label: 'All Deals' },
    { key: 'needs-funding', label: 'Needs Funding' },
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
        {activeTab === 'all-deals' && <AllDealsTab onDealClick={handleDealClick} />}
        {activeTab === 'needs-funding' && <NeedsFundingTab onDealClick={handleDealClick} />}
        {activeTab === 'by-investor' && <ByInvestorTab onDealClick={handleDealClick} />}
        {activeTab === 'directory' && <DirectoryTab />}
      </div>

    </div>
  );
}
