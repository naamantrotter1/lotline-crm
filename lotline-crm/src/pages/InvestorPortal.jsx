import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Briefcase, ChevronDown, ChevronUp, Mail, Phone, X, UserPlus, Landmark, Handshake, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { INVESTORS, ALL_DEALS_TABLE } from '../data/investors';
import { loadInvestors, addInvestor as storeAddInvestor } from '../lib/investorsStore';
import { useDeals } from '../lib/DealsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../lib/AuthContext';
import { useJv } from '../lib/JvContext';
import { fetchCommitmentSummaries, fetchInvestors } from '../lib/capitalStackData';

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
  const { orgSlug } = useAuth();
  const staticDealsTable = orgSlug === 'lotline-homes' ? ALL_DEALS_TABLE : [];
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
            {staticDealsTable.map((deal, i) => (
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
function InvestorCard({ investor, onDealClick, contextDeals = [] }) {
  const { orgSlug } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const isCash = investor.name === 'Cash';

  // Merge static + context deals, deduplicating by address (static wins)
  const staticDeals = (orgSlug === 'lotline-homes' ? ALL_DEALS_TABLE : []).filter(d => d.lender === investor.name);
  const staticAddresses = new Set(staticDeals.map(d => (d.address || '').trim().toLowerCase()));
  const liveDeals = contextDeals
    .filter(d => (d.investor || '').trim() === investor.name.trim() && !staticAddresses.has((d.address || '').trim().toLowerCase()))
    .map(d => ({
      address: d.address,
      stage: d.stage,
      lender: investor.name,
      totalCapital: (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0),
      landCost: d.land || 0,
      construction: (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0),
      arv: d.arv || 0,
      closeDate: d.closeDate || null,
    }));
  const allInvestorDeals = [...staticDeals, ...liveDeals];

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
          {allInvestorDeals.map((deal, i) => (
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
                  <p className="text-xs font-bold text-gray-800">${(deal.totalCapital || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                <span>Land: ${(deal.landCost || 0).toLocaleString()}</span>
                <span>Build: ${(deal.construction || 0).toLocaleString()}</span>
                <span>ARV: ${(deal.arv || 0).toLocaleString()}</span>
                {deal.closeDate && <span>Close: {deal.closeDate}</span>}
              </div>
            </div>
          ))}
          {allInvestorDeals.length === 0 && (
            <div className="px-5 py-4 text-xs text-gray-400 text-center">No deals assigned yet</div>
          )}
        </div>
      )}
    </div>
  );
}

const FINANCING_SCENARIOS_LIST = [
  { id: 'cash',                 label: 'Cash' },
  { id: 'hard-money-loan',      label: 'Hard Money Loan' },
  { id: 'hard-money-land-home', label: 'Hard Money (Land + Home)' },
  { id: 'loc',                  label: 'Line of Credit' },
  { id: 'profit-split',         label: 'Profit Split' },
];

// ── Assign Investor Modal ─────────────────────────────────────────────────────
function AssignFunderModal({ deal, investors, onAssign, onClose }) {
  const [mode, setMode] = useState('existing');
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');

  // Financing scenario
  const [scenario, setScenario] = useState('');
  const [interestRate, setInterestRate] = useState(13);
  const [originationFeeType, setOriginationFeeType] = useState('percentage');
  const [originationFeePct, setOriginationFeePct] = useState(3);
  const [originationFeeFlat, setOriginationFeeFlat] = useState(0);
  const [servicingFeeType, setServicingFeeType] = useState('flat');
  const [servicingFeeFlat, setServicingFeeFlat] = useState(750);
  const [servicingFeePct, setServicingFeePct] = useState(0);
  const [balloonTerm, setBalloonTerm] = useState(12);
  const [holdPeriod, setHoldPeriod] = useState(6);
  const [monthlyHoldCost, setMonthlyHoldCost] = useState(250);
  const [profitSharePct, setProfitSharePct] = useState(0);
  const [capitalDeployedDate, setCapitalDeployedDate] = useState('');
  const [capitalReturnedDate, setCapitalReturnedDate] = useState('');
  const [ltcPct, setLtcPct] = useState(80);
  const [originationPoints, setOriginationPoints] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [drawPct, setDrawPct] = useState(100);
  const [annualFeePct, setAnnualFeePct] = useState(0);
  const [investorProfitSplitPct, setInvestorProfitSplitPct] = useState(50);

  const existingInv = investors.find(i => i.name === selected);

  // Auto-set scenario when selecting an existing investor
  const handleSelectInvestor = (name) => {
    setSelected(name);
    const inv = investors.find(i => i.name === name);
    if (inv?.preferredFinancing) {
      const match = FINANCING_SCENARIOS_LIST.find(s => s.label === inv.preferredFinancing);
      if (match) setScenario(match.id);
    }
  };

  const funderName = mode === 'existing' ? selected : newName.trim();
  const canSubmit = !!funderName;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const terms = { scenario, interestRate, originationFeeType, originationFeePct, originationFeeFlat, servicingFeeType, servicingFeeFlat, servicingFeePct, balloonTerm, holdPeriod, monthlyHoldCost, profitSharePct, capitalDeployedDate, capitalReturnedDate, ltcPct, originationPoints, creditLimit, drawPct, annualFeePct, investorProfitSplitPct };
    onAssign({ funderName, terms, isNew: mode === 'new', newInvestor: mode === 'new' ? { name: funderName, standardTerms: '' } : null });
  };

  // Shared styles matching DealDetail
  const ni = 'w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30';
  const wi = 'w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30';
  const row = 'flex justify-between items-center py-1.5 border-b border-gray-50 text-xs last:border-0';
  const sec = 'bg-white rounded-xl border border-gray-100 px-4 py-3';
  const secTitle = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2';
  const toggleBtn = (active) => `px-2.5 py-1 text-xs transition-colors ${active ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Assign Investor</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{deal.address}</p>
            <p className="text-xs text-gray-500 mt-0.5">Capital needed: <span className="font-semibold text-gray-700">${deal.totalCapital.toLocaleString()}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Mode toggle */}
          <div className="flex gap-2">
            {['existing', 'new'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${mode === m ? 'bg-accent text-white border-accent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {m === 'existing' ? 'Existing Investor' : 'Add New Investor'}
              </button>
            ))}
          </div>

          {/* Investor selection */}
          {mode === 'existing' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Investor</label>
              <select value={selected} onChange={e => handleSelectInvestor(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">— Choose investor —</option>
                {investors.map(inv => <option key={inv.name} value={inv.name}>{inv.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Investor Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. John Smith Capital"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          )}

          {/* Financing Scenario selector */}
          <div className={sec}>
            <p className={secTitle}>Financing Scenario</p>
            <select value={scenario} onChange={e => setScenario(e.target.value)}
              className="w-full text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30">
              <option value="">— Choose a scenario —</option>
              {FINANCING_SCENARIOS_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* ── Hard Money Loan ── */}
          {scenario === 'hard-money-loan' && (
            <div className={sec}>
              <p className={secTitle}>Loan Terms</p>
              <div className={row}><span className="text-gray-500">LTC % (Loan-to-Cost)</span><input type="number" value={ltcPct} onChange={e => setLtcPct(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Origination Points (%)</span><input type="number" value={originationPoints} onChange={e => setOriginationPoints(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Loan Term (months)</span><input type="number" value={balloonTerm} onChange={e => setBalloonTerm(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Hard Money (Land + Home) ── */}
          {scenario === 'hard-money-land-home' && (<>
            <div className={sec}>
              <p className={secTitle}>Interest</p>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
            </div>
            <div className={sec}>
              <div className="flex items-center justify-between mb-2">
                <p className={secTitle + ' mb-0'}>Origination Fee</p>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setOriginationFeeType('percentage')} className={toggleBtn(originationFeeType==='percentage')}>% of Total</button>
                  <button onClick={() => setOriginationFeeType('flat')} className={toggleBtn(originationFeeType==='flat')}>Flat $</button>
                </div>
              </div>
              {originationFeeType === 'percentage'
                ? <div className={row}><span className="text-gray-500">Fee Percentage (%)</span><input type="number" value={originationFeePct} onChange={e => setOriginationFeePct(+e.target.value||0)} className={ni} /></div>
                : <div className={row}><span className="text-gray-500">Flat Amount ($)</span><input type="number" value={originationFeeFlat} onChange={e => setOriginationFeeFlat(+e.target.value||0)} className={wi} /></div>
              }
            </div>
            <div className={sec}>
              <div className="flex items-center justify-between mb-2">
                <p className={secTitle + ' mb-0'}>Servicing Fee</p>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setServicingFeeType('percentage')} className={toggleBtn(servicingFeeType==='percentage')}>% of Total</button>
                  <button onClick={() => setServicingFeeType('flat')} className={toggleBtn(servicingFeeType==='flat')}>Flat $</button>
                </div>
              </div>
              {servicingFeeType === 'percentage'
                ? <div className={row}><span className="text-gray-500">Fee Percentage (%)</span><input type="number" value={servicingFeePct} onChange={e => setServicingFeePct(+e.target.value||0)} className={ni} /></div>
                : <div className={row}><span className="text-gray-500">Flat Amount ($)</span><input type="number" value={servicingFeeFlat} onChange={e => setServicingFeeFlat(+e.target.value||0)} className={wi} /></div>
              }
            </div>
            <div className={sec}>
              <p className={secTitle}>Profit Share</p>
              <div className={row}><span className="text-gray-500">Profit Share (%)</span><input type="number" value={profitSharePct} onChange={e => setProfitSharePct(+e.target.value||0)} className={ni} /></div>
            </div>
            <div className={sec}>
              <p className={secTitle}>Terms & Hold Period</p>
              <div className={row}><span className="text-gray-500">Balloon Payment Term (months)</span><input type="number" value={balloonTerm} onChange={e => setBalloonTerm(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Hold Period (months)</span><input type="number" value={holdPeriod} onChange={e => setHoldPeriod(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Monthly Holding Costs ($)</span><input type="number" value={monthlyHoldCost} onChange={e => setMonthlyHoldCost(+e.target.value||0)} className={wi} /></div>
            </div>
            <div className={sec}>
              <p className={secTitle}>Capital Tracking</p>
              <div className={row}><span className="text-gray-500">Capital Deployed Date</span><input type="date" value={capitalDeployedDate} onChange={e => setCapitalDeployedDate(e.target.value)} className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" /></div>
              <div className={row}><span className="text-gray-500">Capital Returned Date</span><input type="date" value={capitalReturnedDate} onChange={e => setCapitalReturnedDate(e.target.value)} className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" /></div>
            </div>
          </>)}

          {/* ── Line of Credit ── */}
          {scenario === 'loc' && (
            <div className={sec}>
              <p className={secTitle}>Line of Credit Terms</p>
              <div className={row}><span className="text-gray-500">Credit Limit ($)</span><input type="number" value={creditLimit} onChange={e => setCreditLimit(+e.target.value||0)} className={wi} /></div>
              <div className={row}><span className="text-gray-500">Draw % (of Limit)</span><input type="number" value={drawPct} onChange={e => setDrawPct(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Fee (%)</span><input type="number" value={annualFeePct} onChange={e => setAnnualFeePct(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Profit Split ── */}
          {scenario === 'profit-split' && (
            <div className={sec}>
              <p className={secTitle}>Profit Split</p>
              <div className={row}><span className="text-gray-500">Investor Profit Split (%)</span><input type="number" value={investorProfitSplitPct} onChange={e => setInvestorProfitSplitPct(+e.target.value||0)} className={ni} /></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <UserPlus size={12} /> Assign Investor
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Needs Funding ───────────────────────────────────────────────────────
function NeedsFundingTab({ onDealClick, orgId, orgSlug, investors: investorsProp }) {
  const UNFUNDED = ['Cash', 'None', '', null, undefined];
  const allUnfunded = (orgSlug === 'lotline-homes' ? ALL_DEALS_TABLE : []).filter(d => UNFUNDED.includes(d.lender));
  const { deals: contextDeals, saveDeal, setDeals } = useDeals();

  // Also include live context deals with no investor not already covered by a static unfunded entry
  const staticUnfundedAddrs = new Set(allUnfunded.map(d => (d.address || '').trim().toLowerCase()));
  const LAND_ACQ_STAGES = new Set(['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract']);
  const liveUnfunded = contextDeals
    .filter(d => !d.isArchived && !LAND_ACQ_STAGES.has(d.stage) && UNFUNDED.includes(d.investor || '') && !staticUnfundedAddrs.has((d.address || '').trim().toLowerCase()))
    .map(d => {
      const totalCapital = (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0);
      return {
        address: d.address,
        pipeline: d.stage,
        stage: d.stage,
        lender: '',
        totalCapital,
        landCost: d.land || 0,
        construction: totalCapital - (d.land || 0),
        arv: d.arv || 0,
        closeDate: d.closeDate || null,
        _isLive: true,
      };
    });

  // Persist assignments & new investors across sessions
  const [assignments, setAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_assignments') || '{}'); } catch { return {}; }
  });
  const [extraInvestors, setExtraInvestors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_extra_investors') || '[]'); } catch { return []; }
  });
  const [modalDeal, setModalDeal] = useState(null);

  // Once assigned, deal leaves the list
  const deals = [
    ...allUnfunded.filter(d => !assignments[d.address]),
    ...liveUnfunded.filter(d => !assignments[d.address]),
  ];
  const totalNeeded = deals.reduce((s, d) => s + (d.totalCapital || 0), 0);

  const baseInvestors = investorsProp ?? loadInvestors(orgId, orgSlug);
  const allInvestors = [
    ...baseInvestors.filter(i => i.name !== 'Cash' && i.name !== 'None'),
    ...extraInvestors.filter(e => !baseInvestors.find(i => i.name === e.name)),
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

    // Write investor + financing back to the deal
    const norm = a => (a || '').trim().toLowerCase();
    const matchedDeal = contextDeals.find(d => norm(d.address) === norm(modalDeal.address));
    if (matchedDeal) {
      const updatedDeal = {
        ...matchedDeal,
        investor: funderName,
        financing: terms?.scenario || matchedDeal.financing,
      };
      saveDeal(updatedDeal);
      setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d));
    }

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
                      <UserPlus size={11} /> Assign Investor
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
function ByInvestorTab({ onDealClick, linkedInvestor, investors, contextDeals }) {
  const displayInvestors = linkedInvestor
    ? investors.filter(inv => inv.name === linkedInvestor)
    : investors;

  if (linkedInvestor && displayInvestors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
        No investor account found for &quot;{linkedInvestor}&quot;. Contact an admin to update your link.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {displayInvestors.map(inv => (
        <InvestorCard key={inv.id} investor={inv} onDealClick={onDealClick} contextDeals={contextDeals} />
      ))}
    </div>
  );
}

// ── Tab: Directory ───────────────────────────────────────────────────────────
function DirectoryTab({ investors }) {
  const contacts = investors.filter(i => i.contact && i.name !== 'Cash');
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

// ── Tab: Available Investments ───────────────────────────────────────────────
const LOAN_STATUS_COLORS = {
  'Pending Review': 'bg-yellow-100 text-yellow-700',
  'In Review':      'bg-blue-100 text-blue-700',
  'Approved':       'bg-green-100 text-green-700',
  'Declined':       'bg-red-100 text-red-700',
};
const PARTNER_STATUS_COLORS = {
  'Under Review':  'bg-yellow-100 text-yellow-700',
  'Interested':    'bg-blue-100 text-blue-700',
  'In Discussion': 'bg-green-100 text-green-700',
  'Pass':          'bg-red-100 text-red-700',
};

function AvailableInvestmentsTab({ onDealClick }) {
  const loanRequests = (() => { try { return JSON.parse(localStorage.getItem('lending_requests') || '[]'); } catch { return []; } })();
  const partnerships = (() => { try { return JSON.parse(localStorage.getItem('partnership_submissions') || '[]'); } catch { return []; } })();

  const hasAny = loanRequests.length > 0 || partnerships.length > 0;

  if (!hasAny) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Landmark size={22} className="text-accent" />
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">No available investments yet</p>
        <p className="text-xs text-gray-400">Deals submitted for financing or partnership will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financing Requests */}
      {loanRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={15} className="text-accent" />
            <h3 className="text-sm font-bold text-[#1a2332]">Financing Requests</h3>
            <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded-full">{loanRequests.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref #', 'Address', 'Loan Amount', 'Loan Type', 'Date Submitted', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loanRequests.map(r => (
                  <tr key={r.ref} onClick={() => onDealClick({ address: r.address })} className="hover:bg-gray-50/60 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{r.address}</td>
                    <td className="px-4 py-3 font-semibold text-[#1a2332] whitespace-nowrap">${(r.loanAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.loanType}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${LOAN_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partnership Submissions */}
      {partnerships.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Handshake size={15} className="text-accent" />
            <h3 className="text-sm font-bold text-[#1a2332]">Partnership Submissions</h3>
            <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded-full">{partnerships.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref #', 'Address', 'Deal Type', 'Projected Profit', 'Date Submitted', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {partnerships.map(r => (
                  <tr key={r.ref} onClick={() => onDealClick({ address: r.address })} className="hover:bg-gray-50/60 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{r.address}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.dealType}</td>
                    <td className="px-4 py-3 font-semibold text-[#1a2332] whitespace-nowrap">${(r.projectedProfit || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PARTNER_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Commitments (headroom overview) ─────────────────────────────────────
function CommitmentsTab() {
  const { activeOrgId } = useAuth();
  const { jvScopeOrgIds } = useJv();
  const scopeIds = jvScopeOrgIds?.length > 0 ? jvScopeOrgIds : (activeOrgId ? [activeOrgId] : []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCommitmentSummaries(scopeIds).then(data => {
      setRows(data ?? []);
      setLoading(false);
    });
  }, [JSON.stringify(scopeIds)]);

  const fmt = v => v == null ? '—' : `$${Number(v).toLocaleString()}`;

  // Group by investor
  const byInvestor = rows.reduce((acc, r) => {
    (acc[r.investor_name] = acc[r.investor_name] || []).push(r);
    return acc;
  }, {});

  if (loading) {
    return <div className="text-xs text-gray-400 text-center py-10">Loading commitments…</div>;
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <p className="text-sm font-semibold text-gray-700 mb-1">No commitments found</p>
        <p className="text-xs text-gray-400">Run migration 008 to populate commitment data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(byInvestor).map(([investorName, commitments]) => {
        const totalCommitted = commitments.reduce((s, c) => s + Number(c.committed_amount ?? 0), 0);
        const totalDeployed = commitments.reduce((s, c) => s + Number(c.total_allocated ?? 0), 0);
        const totalHeadroom = commitments.reduce((s, c) => s + Number(c.remaining_headroom ?? 0), 0);
        const anyOver = commitments.some(c => Number(c.remaining_headroom ?? 0) < 0);

        return (
          <div key={investorName} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Investor header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                  <Users size={12} className="text-accent" />
                </div>
                <span className="text-sm font-semibold text-[#1a2332]">{investorName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Committed: <span className="font-semibold text-gray-800">{fmt(totalCommitted)}</span></span>
                <span>Deployed: <span className="font-semibold text-gray-800">{fmt(totalDeployed)}</span></span>
                <span className={anyOver ? 'text-red-600 font-semibold' : 'text-gray-800 font-semibold'}>
                  Headroom: {fmt(totalHeadroom)}
                </span>
                {anyOver && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Over limit</span>
                )}
              </div>
            </div>

            {/* Commitment rows */}
            <table className="w-full text-xs">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="text-left px-5 py-2 text-gray-400 font-medium">Commitment</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Type</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Committed</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Deployed</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Remaining</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commitments.map(c => {
                  const headroom = c.remaining_headroom;
                  const isOver = headroom != null && Number(headroom) < 0;
                  return (
                    <tr key={c.commitment_id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{c.commitment_name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          c.commitment_type === 'legacy'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50 text-blue-600'
                        }`}>
                          {c.commitment_type ?? 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(c.committed_amount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(c.total_allocated)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${isOver ? 'text-red-600' : 'text-green-700'}`}>
                        {headroom == null ? '∞' : fmt(headroom)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.commitment_status === 'active'       ? 'bg-green-100 text-green-700' :
                          c.commitment_status === 'fully_deployed' ? 'bg-gray-100 text-gray-500' :
                          c.commitment_status === 'expired'     ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {c.commitment_status ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Investor Portal ──────────────────────────────────────────────────────
export default function InvestorPortal() {
  const { deals: customDeals } = useDeals();
  const navigate = useNavigate();
  const { isInvestor } = usePermissions();
  const { profile, activeOrgId, orgSlug } = useAuth();
  const { jvScopeOrgIds, jvScopeIsMultiOrg } = useJv();
  // For investor-role users, their linked investor name is stored in profile.company
  const linkedInvestor = isInvestor ? (profile?.company || null) : null;

  const scopeIds = jvScopeOrgIds?.length > 0 ? jvScopeOrgIds : (activeOrgId ? [activeOrgId] : []);

  const [activeTab, setActiveTab] = useState('by-investor');
  const [investors, setInvestors] = useState(() => loadInvestors(activeOrgId, orgSlug));

  // Reload investor list whenever JV scope changes.
  // Multi-org: fetch from Supabase so partner investors appear.
  // Own-org:   use org-scoped localStorage (has pre-computed stats).
  useEffect(() => {
    if (jvScopeIsMultiOrg) {
      fetchInvestors(scopeIds).then(rows => {
        setInvestors(rows.map(r => ({
          id: r.id,
          name: r.name,
          contact: r.contact || '',
          email: r.email || '',
          phone: r.phone || '',
          type: r.type || 'Private Lender',
          preferredFinancing: r.preferred_financing || '',
          standardTerms: r.standard_terms || '',
          notes: r.notes || '',
          // Summary stats are 0 for cross-org view; InvestorCard derives
          // the live deal list from contextDeals (which is already JV-scoped).
          activeDeals: 0,
          capitalInvested: 0,
          totalReturns: 0,
          roiPct: 0,
          roiDollars: 0,
          avgAnnualizedRoi: 0,
          deals: [],
        })));
      });
    } else {
      setInvestors(loadInvestors(activeOrgId, orgSlug));
    }
  }, [JSON.stringify(scopeIds), activeOrgId, orgSlug]);
  const findDealId = (address) => {
    const norm = a => a.trim().toLowerCase();
    const match = customDeals.find(d => norm(d.address || '') === norm(address));
    return match?.id ?? null;
  };

  const handleDealClick = (deal) => {
    const id = findDealId(deal.address);
    if (id) navigate(`/deal/${id}`, { state: { from: 'investor-portal' } });
  };

  const totalCapital = investors.reduce((s, i) => s + i.capitalInvested, 0);
  const totalDeals = investors.reduce((s, i) => s + i.activeDeals, 0);
  const totalROI = investors.reduce((s, i) => s + i.roiDollars, 0);

  const TABS = isInvestor
    ? [{ key: 'by-investor', label: 'My Deals' }]
    : [
        { key: 'all-deals',            label: 'All Deals'            },
        { key: 'needs-funding',        label: 'Needs Funding'         },
        { key: 'by-investor',          label: 'By Investor'          },
        { key: 'commitments',          label: 'Commitments'          },
        { key: 'directory',            label: 'Directory'            },
        { key: 'available-investments',label: 'Available Investments' },
      ];

  return (
    <div className="min-h-screen" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-[#1a2332]">Investor Portal</h1>
          <Link
            to="/investor/home"
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <ExternalLink size={14} /> Investor View
          </Link>
        </div>
        <p className="text-sm text-gray-400">
          {isInvestor
            ? linkedInvestor ? `Viewing deals for ${linkedInvestor}` : 'Your account has not been linked to an investor yet'
            : 'Manage capital sources and investor relationships'}
        </p>

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

      {/* Summary stats — hidden for investor-role users */}
      <div className="px-6 pt-5">
        {!isInvestor && activeTab !== 'available-investments' && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Active Investors', value: investors.filter(i => i.name !== 'Cash').length, icon: Users },
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
        </div>}

        {/* Tab content */}
        {activeTab === 'all-deals' && <AllDealsTab onDealClick={handleDealClick} />}
        {activeTab === 'needs-funding' && <NeedsFundingTab onDealClick={handleDealClick} orgId={activeOrgId} orgSlug={orgSlug} investors={investors} />}
        {activeTab === 'by-investor' && <ByInvestorTab onDealClick={handleDealClick} linkedInvestor={linkedInvestor} investors={investors} contextDeals={customDeals} />}
        {activeTab === 'commitments' && <CommitmentsTab />}
        {activeTab === 'directory' && <DirectoryTab investors={investors} />}
        {activeTab === 'available-investments' && <AvailableInvestmentsTab onDealClick={handleDealClick} />}
      </div>

    </div>
  );
}
