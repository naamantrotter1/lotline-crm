import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  DollarSign, TrendingUp, BarChart2, ArrowUpRight,
  Calendar, ChevronRight, Clock, Download,
} from 'lucide-react';
import {
  fetchMyDeals, fetchMyDistributions, computePortfolioMetrics,
} from '../../lib/investorPortalData';
import { useAuth } from '../../lib/AuthContext';

const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];
const STAGE_COLOR = {
  'Contract Signed': 'bg-green-500',
  'Due Diligence':   'bg-yellow-500',
  'Development':     'bg-blue-500',
  'Complete':        'bg-purple-500',
};

function fmt(n) { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtPct(n) { return `${(n ?? 0).toFixed(2)}%`; }
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function exportPortfolioPdf(investor, deals, distributions, metrics) {
  const fmt  = n  => `$${Math.round(n ?? 0).toLocaleString()}`;
  const fmtD = d  => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const rows = deals.map(d => {
    const cost = (d.land ?? 0) + (d.mobile_home ?? 0) + (d.permits ?? 0) +
      (d.setup ?? 0) + (d.septic ?? 0) + (d.well ?? 0) + (d.electric ?? 0) +
      (d.hvac ?? 0) + (d.clear_land ?? 0);
    return `<tr>
      <td>${d.address}</td><td>${d.stage ?? '—'}</td>
      <td>${fmt(d.arv)}</td><td>${fmt(cost)}</td>
      <td>${d.projected_irr ? d.projected_irr + '%' : '—'}</td>
      <td>${fmtD(d.projected_payout_date ?? d.close_date)}</td>
    </tr>`;
  }).join('');
  const distRows = distributions.slice(0, 20).map(d => `<tr>
    <td>${fmtD(d.date)}</td><td>${d.deals?.address ?? '—'}</td>
    <td>${fmt(d.amount)}</td><td>${(d.type ?? '').replace(/_/g, ' ')}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Portfolio Summary – ${investor.name}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 40px; color: #1a1a2e; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; margin: 0 0 32px; font-size: 12px; }
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 32px; }
  .stat { background: #f5f5f5; border-radius: 8px; padding: 16px; }
  .stat-val { font-size: 20px; font-weight: 700; margin: 4px 0 2px; }
  .stat-lbl { font-size: 11px; color: #888; }
  h2 { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #666; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #e0e0e0; font-size: 11px; color: #888; font-weight: 500; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; }
  @media print { button { display: none; } }
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:20px;right:20px;padding:8px 16px;background:#c2651a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Print / Save PDF</button>
<h1>Portfolio Summary</h1>
<p class="sub">${investor.name} · Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
<div class="stats">
  <div class="stat"><div class="stat-val">${fmt(metrics?.deployed ?? 0)}</div><div class="stat-lbl">Capital Deployed</div></div>
  <div class="stat"><div class="stat-val">${fmt(metrics?.returned ?? 0)}</div><div class="stat-lbl">Total Distributed</div></div>
  <div class="stat"><div class="stat-val">${fmt(metrics?.unrealizedGain ?? 0)}</div><div class="stat-lbl">Unrealized Gain</div></div>
  <div class="stat"><div class="stat-val">${(metrics?.weightedIrr ?? 0).toFixed(2)}%</div><div class="stat-lbl">Weighted IRR</div></div>
</div>
<h2>Active Deals (${deals.length})</h2>
<table><thead><tr><th>Address</th><th>Stage</th><th>ARV</th><th>Capital</th><th>Target IRR</th><th>Expected Close</th></tr></thead>
<tbody>${rows}</tbody></table>
${distributions.length > 0 ? `<h2>Distributions</h2>
<table><thead><tr><th>Date</th><th>Deal</th><th>Amount</th><th>Type</th></tr></thead>
<tbody>${distRows}</tbody></table>` : ''}
<div class="footer">LotLine Investor Portal · Confidential</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

export default function InvestorHome() {
  const { investor } = useOutletContext();
  const { profile }  = useAuth();
  const [deals, setDeals]               = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [metrics, setMetrics]           = useState(null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!investor) return;
    setLoading(true);
    Promise.all([
      fetchMyDeals(investor.name),
      fetchMyDistributions(investor.id),
    ]).then(([{ deals: d }, { distributions: dist }]) => {
      setDeals(d);
      setDistributions(dist);
      setMetrics(computePortfolioMetrics(d, dist));
      setLoading(false);
    });
  }, [investor]);

  if (!investor) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">Your account has not been linked to an investor yet.</p>
        <p className="text-xs mt-1">Contact your LotLine operator to complete setup.</p>
      </div>
    );
  }

  const STAT_CARDS = metrics ? [
    { label: 'Capital Deployed',   value: fmt(metrics.deployed),       icon: DollarSign,  color: 'text-accent' },
    { label: 'Total Distributed',  value: fmt(metrics.returned),       icon: ArrowUpRight,color: 'text-green-400' },
    { label: 'Unrealized Gain',    value: fmt(metrics.unrealizedGain), icon: TrendingUp,  color: 'text-blue-400' },
    { label: 'Weighted IRR',       value: fmtPct(metrics.weightedIrr), icon: BarChart2,   color: 'text-purple-400' },
  ] : [];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{greeting()},</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{investor.name}</h1>
          {metrics?.nextDistribution && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <Calendar size={11} />
              Next expected payout: <span className="text-accent font-semibold ml-1">{fmtDate(metrics.nextDistribution)}</span>
            </p>
          )}
        </div>
        {!loading && metrics && (
          <button
            onClick={() => exportPortfolioPdf(investor, deals, distributions, metrics)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/8 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <Download size={14} /> Portfolio Summary
          </button>
        )}
      </div>

      {/* Headline numbers */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-white/8 rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-[#1c2130] rounded-xl p-5 border border-gray-200 dark:border-white/8">
              <div className={`flex items-center gap-2 mb-2 ${color}`}>
                <Icon size={15} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active deals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">My Deals</h2>
          <Link to="/investor/deals" className="flex items-center gap-1 text-xs text-accent hover:underline">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-white/8 rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white dark:bg-[#1c2130] rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm border border-gray-200 dark:border-white/8">
            No active deals yet.
          </div>
        ) : (
          <div className="space-y-3">
            {deals.slice(0, 5).map(deal => {
              const stageIdx = STAGE_ORDER.indexOf(deal.stage);
              const pct = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
              return (
                <Link
                  key={deal.id}
                  to={`/investor/deals/${deal.id}`}
                  className="block bg-white dark:bg-[#1c2130] rounded-xl p-4 border border-gray-200 dark:border-white/8 hover:border-accent/40 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-accent transition-colors leading-snug">{deal.address}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STAGE_COLOR[deal.stage] ?? 'bg-gray-600'} bg-opacity-20 text-white`}>
                        {deal.stage}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">ARV</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(deal.arv)}</p>
                    </div>
                  </div>
                  {/* Pipeline progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
                    <div
                      className="bg-accent h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{pct}% complete</span>
                    {deal.close_date && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock size={9} /> {fmtDate(deal.close_date)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent distributions */}
      {distributions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Recent Distributions</h2>
            <Link to="/investor/distributions" className="flex items-center gap-1 text-xs text-accent hover:underline">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 dark:border-white/8">
                <tr>
                  {['Date', 'Deal', 'Amount', 'Type'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {distributions.slice(0, 5).map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtDate(d.date)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{d.deals?.address ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-green-400">{fmt(d.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{(d.type ?? '').replace(/_/g, ' ')}</td>
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
