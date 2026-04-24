/**
 * PropertyData.jsx
 * Phase 20: Property data lookup (ATTOM) and direct mail (Lob).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Database, Search, MapPin, Home, DollarSign, Calendar, Ruler,
  User, Mail, Loader2, AlertCircle, Clock, ChevronRight, Send, Building,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  lookupProperty, fetchPropertyLookups, fetchDirectMailJobs,
  formatCurrency, formatSqft,
} from '../lib/propertyData';

// ── Property Detail Card ───────────────────────────────────────────────────

function PropertyCard({ data }) {
  const rows = [
    { icon: User,      label: 'Owner',           value: data.owner_name },
    { icon: MapPin,    label: 'Mailing Address',  value: data.owner_mailing },
    { icon: DollarSign,label: 'Assessed Value',   value: formatCurrency(data.assessed_value) },
    { icon: DollarSign,label: 'Market Value',     value: formatCurrency(data.market_value) },
    { icon: Ruler,     label: 'Lot Size',         value: formatSqft(data.lot_size_sqft) },
    { icon: Home,      label: 'Year Built',       value: data.year_built },
    { icon: Building,  label: 'Zoning',           value: data.zoning },
    { icon: Database,  label: 'Land Use',         value: data.land_use },
    { icon: DollarSign,label: 'Last Sale Price',  value: formatCurrency(data.last_sale_price) },
    { icon: Calendar,  label: 'Last Sale Date',   value: data.last_sale_date ? new Date(data.last_sale_date + 'T00:00:00').toLocaleDateString() : null },
    { icon: DollarSign,label: 'Annual Taxes',     value: formatCurrency(data.tax_amount) },
  ].filter(r => r.value && r.value !== '—');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-start gap-2">
          <MapPin size={15} className="text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{data.address}</p>
            {data.parcel_id && <p className="text-xs text-gray-400 mt-0.5">APN: {data.parcel_id}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-50">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
              <Icon size={11} />{label}
            </div>
            <p className="text-sm font-medium text-gray-800">{value}</p>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">Via ATTOM</span>
        <span className="text-xs text-gray-400">{new Date(data.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PropertyData() {
  const { activeOrgId, profile } = useAuth();
  const [address, setAddress]     = useState('');
  const [lookups, setLookups]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searching, setSearching] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const data = await fetchPropertyLookups(activeOrgId);
    setLookups(data);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const data = await lookupProperty(address.trim(), activeOrgId, profile?.id);
      setResult({ ...data, address: address.trim(), created_at: new Date().toISOString() });
      load();
    } catch (err) {
      setError(err.message);
    }
    setSearching(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Property Data</h1>
          <p className="text-sm text-gray-400 mt-0.5">Look up ownership, valuation, and parcel data via ATTOM</p>
        </div>

        {/* Search */}
        <form onSubmit={handleLookup} className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="text-xs font-medium text-gray-600 mb-2 block">Property Address</label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Main St, Austin, TX 78701"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !address.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-60"
            >
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {searching ? 'Looking up…' : 'Look Up'}
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 rounded-xl text-xs text-red-600">
              <AlertCircle size={12} />{error}
            </div>
          )}
        </form>

        {/* Result */}
        {result && (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Result</h2>
            <PropertyCard data={result} />
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Lookups</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : lookups.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Database size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">No lookups yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lookups.map(lookup => (
                <div
                  key={lookup.id}
                  className="bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => setResult(lookup)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={14} className="text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{lookup.address}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
                          {lookup.owner_name && <span>{lookup.owner_name}</span>}
                          {lookup.market_value && <span>{formatCurrency(lookup.market_value)}</span>}
                          {lookup.lot_size_sqft && <span>{formatSqft(lookup.lot_size_sqft)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock size={11} />
                      {new Date(lookup.created_at).toLocaleDateString()}
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
