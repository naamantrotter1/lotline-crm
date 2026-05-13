/**
 * MarketSnapshot — county-level market metrics card. Reads from
 * counties.heat_map_metrics (jsonb). When the column is empty (initial
 * state — Phase F not yet wired), shows a "Data coming soon" placeholder
 * instead of a broken card.
 */
import { TrendingUp, ExternalLink, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt$ = (n) => (n == null ? '—' : `$${Number(n).toLocaleString()}`);
const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString());

function timeAgo(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.floor(ms / 60000);
  return `${Math.max(1, mins)}m ago`;
}

export default function MarketSnapshot({ county, heatMap }) {
  const navigate = useNavigate();
  if (!county) return null;

  const m = heatMap || {};
  const hasData = ['medianArv', 'pricePerSqft', 'daysOnMarket', 'avgLotPrice', 'compsCount']
    .some(k => m[k] != null);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-sidebar">
            Market Snapshot — {county.county_name} County, {county.state}
          </h2>
        </div>
        <button
          onClick={() => navigate(`/intelligence?tab=heatmap&county=${county.id}`)}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          View on heat map <ExternalLink size={11} />
        </button>
      </div>

      {!hasData ? (
        <div className="py-6 text-center text-xs text-gray-400">
          Market data not yet collected for this county.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Median ARV"     value={fmt$(m.medianArv)} />
            <Stat label="$ / sqft"        value={fmt$(m.pricePerSqft)} />
            <Stat label="Days on market"  value={fmtN(m.daysOnMarket)} />
            <Stat label="Avg lot price"   value={fmt$(m.avgLotPrice)} />
            <Stat label="Comps"           value={fmtN(m.compsCount)} />
            <Stat label="List → sale"     value={m.listPriceToSaleRatio != null ? `${(m.listPriceToSaleRatio * 100).toFixed(1)}%` : '—'} />
          </div>
          {m.lastRefreshedAt && (
            <p className="mt-3 text-[11px] text-gray-400 flex items-center gap-1">
              <Clock size={10} /> Refreshed {timeAgo(m.lastRefreshedAt) || 'recently'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm font-bold text-sidebar mt-0.5">{value}</p>
    </div>
  );
}
