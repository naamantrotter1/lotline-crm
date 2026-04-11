import { useState, useMemo } from 'react';
import {
  ArrowLeft, Search, X, Building2, Send, CheckCircle, ChevronRight,
  Users, TrendingUp, Phone, Globe, Mail, MapPin, Home, BarChart2, Info,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Button from '../components/UI/Button';
import { COUNTIES, totalPermits, topBuilder } from '../data/builderNetwork';

// ── Style helpers ────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

const STATUS_STYLE = {
  'Dominant':    'bg-accent text-white',
  'Very Active': 'bg-blue-100 text-blue-700',
  'Active':      'bg-green-100 text-green-700',
};

const SPECIALTY_STYLE = {
  'Single Family': 'bg-blue-50 text-blue-600',
  'Multi-Family':  'bg-purple-50 text-purple-600',
  'Custom':        'bg-amber-50 text-amber-700',
  'Mixed':         'bg-gray-100 text-gray-600',
};

const TYPE_STYLE = {
  'Dealer + Installer':     'bg-orange-50 text-orange-700',
  'Full Turnkey Installer': 'bg-purple-50 text-purple-700',
  'Dealer':                 'bg-blue-50 text-blue-600',
  'Dealer + Builder':       'bg-teal-50 text-teal-700',
  'Installer':              'bg-gray-100 text-gray-600',
  'Transport & Setup':      'bg-purple-50 text-purple-700',
  'General Setup':          'bg-gray-100 text-gray-600',
  'Setup Contractor':       'bg-teal-50 text-teal-700',
  'Dealer + Setup':         'bg-orange-50 text-orange-700',
};

const BUILDER_TYPE_STYLE = {
  'National Builder': 'bg-blue-50 text-blue-600',
  'Regional Builder': 'bg-teal-50 text-teal-700',
  'Local Builder':    'bg-green-50 text-green-700',
  'Custom Builder':   'bg-amber-50 text-amber-700',
};

// ── Sub-components ───────────────────────────────────────────────────────────
function StateBadge({ state }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${state === 'NC' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
      {state}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}{hint && <span className="normal-case font-normal ml-1 text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-bold text-accent uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 px-4 py-4 text-center min-w-0">
      <p className="text-2xl font-bold text-sidebar leading-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{label}</p>
    </div>
  );
}

function PermitTrendChart({ data, title = 'Monthly Mobile Home Permits Issued (2024–2025)' }) {
  return (
    <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-sidebar mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 44 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9.5, fill: '#9ca3af' }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip
            formatter={(v) => [`${v} permits`, 'Permits']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            cursor={{ fill: 'rgba(249,115,22,0.06)' }}
          />
          <Bar dataKey="permits" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.year === 2025 ? '#f97316' : '#fed7aa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-1 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-200" />
          <span className="text-xs text-gray-500">2024</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent" />
          <span className="text-xs text-gray-500">2025</span>
        </div>
      </div>
    </div>
  );
}

// ── Connect Drawer ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  address: '', county: '', acreage: '', zoning: 'Residential',
  cleared: '', waterSewer: '', askingPrice: '',
  name: '', email: '', phone: '', contactTime: 'Morning',
  message: '', sendCopy: true,
};

function ConnectDrawer({ open, builder, county, onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmed, setConfirmed] = useState(null);

  const handleOpen = () => {
    if (!open) return;
    try {
      const u = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const msg = `Hi ${builder?.name || 'there'}, I own ${form.acreage || '[X]'} acres in ${county?.county || '[County]'} County and believe it may be a great fit for your pipeline. I'd love to connect.`;
      setForm({ ...EMPTY_FORM, county: county?.county || '', name: u.name || '', email: u.email || '', message: msg });
    } catch {
      setForm({ ...EMPTY_FORM, county: county?.county || '' });
    }
    setStep(1);
    setConfirmed(null);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(handleOpen, [open]);

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = (e) => {
    e.preventDefault();
    const ref = 'LND-' + Math.floor(1000 + Math.random() * 9000);
    console.log('🏗️ Builder Connect Submission:', { ref, builder: builder?.name, county: county?.county, state: county?.state, ...form });
    setConfirmed(ref);
  };

  const close = () => { onClose(); setConfirmed(null); setStep(1); };
  const STEP_LABELS = ['Land Details', 'Contact Info', 'Message'];

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={close} />
      <div className={`fixed top-0 right-0 h-full w-[500px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Connect to Sell Land</p>
            <h2 className="text-base font-bold text-sidebar">{builder?.name}</h2>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {confirmed ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <CheckCircle size={28} className="text-accent" />
            </div>
            <div>
              <p className="text-lg font-bold text-sidebar">Inquiry Submitted!</p>
              <p className="text-sm text-gray-500 mt-1">Reference: <span className="font-bold text-accent">{confirmed}</span></p>
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">Your inquiry has been submitted. LotLine will facilitate the introduction within <strong>1–2 business days</strong>.</p>
            </div>
            <Button onClick={close} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="flex gap-1.5 mb-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${s <= step ? 'bg-accent' : 'bg-gray-100'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Step {step} of 3 — {STEP_LABELS[step - 1]}</p>
            </div>

            <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {builder?.contact && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-accent uppercase tracking-widest mb-1">Builder Contact</p>
                    {builder.contact.phone && (
                      <a href={`tel:${builder.contact.phone}`} className="flex items-center gap-2 text-sm text-sidebar hover:text-accent transition-colors">
                        <Phone size={13} className="text-gray-400 flex-shrink-0" />{builder.contact.phone}
                      </a>
                    )}
                    {builder.contact.website && (
                      <a href={builder.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sidebar hover:text-accent transition-colors truncate">
                        <Globe size={13} className="text-gray-400 flex-shrink-0" />{builder.contact.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {builder.contact.email && (
                      <a href={`mailto:${builder.contact.email}`} className="flex items-center gap-2 text-sm text-sidebar hover:text-accent transition-colors">
                        <Mail size={13} className="text-gray-400 flex-shrink-0" />{builder.contact.email}
                      </a>
                    )}
                    {builder.contact.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-500">
                        <MapPin size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />{builder.contact.address}
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <>
                    <SectionLabel>Your Land Details</SectionLabel>
                    <Field label="Property Address">
                      <input name="address" required value={form.address} onChange={set} className={inp} placeholder="123 Rural Rd, City, NC 28000" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="County">
                        <input name="county" value={form.county} onChange={set} className={inp} placeholder="County name" />
                      </Field>
                      <Field label="Total Acreage">
                        <input name="acreage" type="number" min="0" step="0.1" value={form.acreage} onChange={set} className={inp} placeholder="e.g. 2.5" />
                      </Field>
                    </div>
                    <Field label="Zoning Type">
                      <select name="zoning" value={form.zoning} onChange={set} className={inp}>
                        <option>Residential</option><option>Agricultural</option><option>Mixed Use</option><option>Unzoned</option><option>Unknown</option>
                      </select>
                    </Field>
                    <Field label="Is land cleared?">
                      <div className="flex gap-2 mt-1">
                        {['Yes', 'No', 'Partially'].map(v => (
                          <label key={v} className={`flex-1 text-center text-sm py-2 rounded-lg border cursor-pointer transition-colors ${form.cleared === v ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <input type="radio" name="cleared" value={v} checked={form.cleared === v} onChange={set} className="hidden" />{v}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Water & Sewer available?">
                      <div className="flex gap-2 mt-1">
                        {['Yes', 'No', 'Unknown'].map(v => (
                          <label key={v} className={`flex-1 text-center text-sm py-2 rounded-lg border cursor-pointer transition-colors ${form.waterSewer === v ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <input type="radio" name="waterSewer" value={v} checked={form.waterSewer === v} onChange={set} className="hidden" />{v}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Asking Price ($)" hint="optional">
                      <input name="askingPrice" type="number" min="0" value={form.askingPrice} onChange={set} className={inp} placeholder="0" />
                    </Field>
                  </>
                )}

                {step === 2 && (
                  <>
                    <SectionLabel>Your Contact Info</SectionLabel>
                    <Field label="Full Name"><input name="name" required value={form.name} onChange={set} className={inp} placeholder="Jane Smith" /></Field>
                    <Field label="Email Address"><input name="email" type="email" required value={form.email} onChange={set} className={inp} placeholder="jane@example.com" /></Field>
                    <Field label="Phone Number"><input name="phone" type="tel" value={form.phone} onChange={set} className={inp} placeholder="(555) 000-0000" /></Field>
                    <Field label="Best Time to Contact">
                      <select name="contactTime" value={form.contactTime} onChange={set} className={inp}>
                        <option>Morning</option><option>Afternoon</option><option>Evening</option>
                      </select>
                    </Field>
                  </>
                )}

                {step === 3 && (
                  <>
                    <SectionLabel>Message to Builder</SectionLabel>
                    <Field label="Your Message">
                      <textarea name="message" value={form.message} onChange={set} rows={6} className={inp + ' resize-none'} placeholder="Write your message here..." />
                    </Field>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" name="sendCopy" checked={form.sendCopy} onChange={set} className="mt-0.5 accent-[#f97316] w-4 h-4 flex-shrink-0" />
                      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                        Also send a copy to the <strong>LotLine team</strong> for assistance with this introduction.
                      </span>
                    </label>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                {step < 3 ? (
                  <Button type="button" onClick={() => setStep(s => s + 1)} className="w-full justify-center">
                    Continue <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" className="w-full justify-center">
                    <Send size={14} className="mr-1.5" /> Send to LotLine for Review
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}

// ── County Card ───────────────────────────────────────────────────────────────
function CountyCard({ county, onView }) {
  if (county.comingSoon) {
    return (
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 opacity-60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-400">{county.county} County</h3>
          <StateBadge state={county.state} />
        </div>
        <p className="text-xs text-gray-400 italic mt-2 mb-4">Data loading soon</p>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Building2 size={12} /> <span>Builders tracked: —</span>
        </div>
        <div className="h-8 bg-gray-100 rounded-lg w-full animate-pulse" />
      </div>
    );
  }

  // ── Manufactured home county (Horry-style) ──
  if (county.permitType) {
    return (
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-sidebar">{county.county} County</h3>
          <StateBadge state={county.state} />
        </div>
        <div className="mb-3">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{county.permitType}</span>
        </div>
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Home size={12} className="text-accent flex-shrink-0" />
            <span><strong className="text-sidebar">{county.permitCount}</strong> active mobile home permits</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp size={12} className="text-accent flex-shrink-0" />
            <span><strong className="text-sidebar">{county.permits2025}</strong> permits issued in 2025</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Building2 size={12} className="text-accent flex-shrink-0" />
            <span><strong className="text-sidebar">{county.builders.length}</strong> dealers &amp; installers tracked</span>
          </div>
        </div>
        <div className="mb-4">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">{county.marketStatus}</span>
        </div>
        <Button onClick={() => onView(county)} size="sm" className="w-full justify-center">
          View Market <ChevronRight size={12} className="ml-1" />
        </Button>
      </div>
    );
  }

  // ── Standard builder county (Guilford / Brunswick) ──
  const top = county.topBuilderName
    ? { name: county.topBuilderName, permits: county.topBuilderPermits }
    : topBuilder(county);
  const total = totalPermits(county);

  return (
    <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-sidebar">{county.county} County</h3>
        <StateBadge state={county.state} />
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Users size={12} className="text-accent" />
          <span><strong className="text-sidebar">{county.buildersTracked || county.builders?.length}</strong> active builders tracked</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <TrendingUp size={12} className="text-accent" />
          <span>Top builder: <strong className="text-sidebar">{top?.name}</strong> — {top?.permits} permits</span>
        </div>
        {!county.marketStatus && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <BarChart2 size={12} className="text-accent" />
            <span><strong className="text-sidebar">{total}</strong> total permits tracked
              {county.dataNote && <span className="text-gray-400 ml-1">({county.dataNote})</span>}
            </span>
          </div>
        )}
      </div>
      {county.marketStatus && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">{county.marketStatus}</span>
          {county.dataNote && <span className="text-xs text-gray-400">{county.dataNote}</span>}
        </div>
      )}
      <Button onClick={() => onView(county)} size="sm" className="w-full justify-center">
        View Builders <ChevronRight size={12} className="ml-1" />
      </Button>
    </div>
  );
}

// ── Dual-Tab Detail (Brunswick) ───────────────────────────────────────────────
function DualTabDetail({ county, onBack, onConnect }) {
  const [activeTab, setActiveTab] = useState('site-built');
  const sb = county.siteBuilt;
  const mh = county.manufactured;
  const currentStats = activeTab === 'site-built' ? sb.stats : mh.stats;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors font-medium">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header card with tabs */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-sidebar">{county.county} County, {county.state}</h2>
                <StateBadge state={county.state} />
              </div>
              <p className="text-sm text-gray-500">Builder &amp; Installer Rankings — {county.buildersTracked} tracked · {county.dataNote}</p>
            </div>
            {county.marketStatus && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-accent/10 text-accent">{county.marketStatus}</span>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[['site-built', 'Site-Built Homes'], ['manufactured', 'Manufactured Homes']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                  activeTab === val ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-6 py-5">
          <div className="flex gap-3 flex-wrap">
            {currentStats.map((s, i) => (
              <StatCard key={i} value={s.value} label={s.label} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Site-Built tab content ── */}
      {activeTab === 'site-built' && (
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-sidebar">Builder Rankings</h3>
            <p className="text-xs text-gray-400 mt-0.5">Active permit data — 2024–2025</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#', 'Builder', 'Permits', 'Type', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sb.builders.map(b => (
                  <tr key={b.name} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 text-sm font-bold text-gray-400 w-10">{b.rank}</td>
                    <td className="py-3 px-4"><span className="text-sm font-semibold text-sidebar">{b.name}</span></td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-sidebar">{b.permits}</span>
                      <span className="text-xs text-gray-400 ml-1">permits</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${BUILDER_TYPE_STYLE[b.type] || 'bg-gray-100 text-gray-600'}`}>
                        {b.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[b.status] || 'bg-gray-100 text-gray-600'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button size="sm" onClick={() => onConnect(b)}>Connect to Sell Land</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Manufactured Homes tab content ── */}
      {activeTab === 'manufactured' && (
        <>
          {mh.monthlyTrend && (
            <PermitTrendChart
              data={mh.monthlyTrend}
              title="Monthly Mobile Home Permits (2024–2025)"
            />
          )}

          <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-sidebar">Top Installer Rankings</h3>
              <p className="text-xs text-gray-400 mt-0.5">Ranked by permit volume — 2024–2025</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['#', 'Installer', 'Permits', 'Specialty', 'Status', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mh.installers.map(b => (
                    <tr key={b.name} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-sm font-bold text-gray-400 w-10">{b.rank}</td>
                      <td className="py-3 px-4"><span className="text-sm font-semibold text-sidebar">{b.name}</span></td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-bold text-sidebar">{b.permits}</span>
                        <span className="text-xs text-gray-400 ml-1">permits</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_STYLE[b.specialty] || 'bg-gray-100 text-gray-600'}`}>
                          {b.specialty}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[b.status] || 'bg-gray-100 text-gray-600'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button size="sm" onClick={() => onConnect(b)}>Connect to Sell Land</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Brand pills */}
          {mh.brands?.length > 0 && (
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-sidebar mb-3">Top Brands Being Installed</p>
              <div className="flex flex-wrap gap-2">
                {mh.brands.map(brand => (
                  <span key={brand} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">{brand}</span>
                ))}
              </div>
            </div>
          )}

          {/* Data source note */}
          {mh.dataSource && (
            <div className="flex items-start gap-2 px-1">
              <Info size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">{mh.dataSource}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── County Detail View ────────────────────────────────────────────────────────
function CountyDetail({ county, onBack, onConnect }) {
  // Dual-tab county (Brunswick)
  if (county.dualTab) {
    return <DualTabDetail county={county} onBack={onBack} onConnect={onConnect} />;
  }

  // Manufactured home county (Horry)
  if (county.permitType) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors font-medium">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-sidebar">{county.county} County, {county.state}</h2>
                <StateBadge state={county.state} />
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{county.permitType}</span>
              </div>
              <p className="text-sm text-gray-500">Top Dealers &amp; Installers — {county.builders.length} tracked</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-accent/10 text-accent">{county.marketStatus}</span>
          </div>
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex gap-3 flex-wrap">
              <StatCard value={county.permitCount} label="Active Mobile Home Permits" />
              <StatCard value={county.permits2025} label="Permits Issued in 2025" />
              <StatCard value={county.newInstalls} label="New Home Installs" />
              <StatCard value={county.usedRelocated} label="Used / Relocated Homes" />
            </div>
          </div>
        </div>

        {county.monthlyTrend && <PermitTrendChart data={county.monthlyTrend} />}

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-sidebar">Top Dealers &amp; Installers</h3>
            <p className="text-xs text-gray-400 mt-0.5">Ranked by estimated market presence in Horry County</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#', 'Company', 'Type', 'Notes', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {county.builders.map(b => (
                  <tr key={b.name} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 text-sm font-bold text-gray-400 w-10">{b.rank}</td>
                    <td className="py-3 px-4"><span className="text-sm font-semibold text-sidebar">{b.name}</span></td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_STYLE[b.type] || 'bg-gray-100 text-gray-600'}`}>
                        {b.type}
                      </span>
                    </td>
                    <td className="py-3 px-4"><span className="text-xs text-gray-500 leading-snug">{b.notes}</span></td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[b.status] || 'bg-gray-100 text-gray-600'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button size="sm" onClick={() => onConnect(b)}>Connect to Sell Land</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {county.dataSource && (
          <div className="flex items-start gap-2 px-1">
            <Info size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">{county.dataSource}</p>
          </div>
        )}
      </div>
    );
  }

  // Standard builder county (Guilford)
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors font-medium">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-sidebar">{county.county} County, {county.state}</h2>
              <StateBadge state={county.state} />
            </div>
            <p className="text-sm text-gray-500">Active Builder Rankings — {totalPermits(county)} total permits tracked</p>
          </div>
          <span><strong className="text-sidebar">{county.buildersTracked || county.builders.length}</strong> builders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Builder Name', 'Permits', 'Specialty', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {county.builders.map(b => (
                <tr key={b.name} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-sm font-bold text-gray-400 w-10">{b.rank}</td>
                  <td className="py-3 px-4"><span className="text-sm font-semibold text-sidebar">{b.name}</span></td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-sidebar">{b.permits}</span>
                    <span className="text-xs text-gray-400 ml-1">permits</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${SPECIALTY_STYLE[b.specialty] || 'bg-gray-100 text-gray-600'}`}>
                      {b.specialty}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[b.status] || 'bg-gray-100 text-gray-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <Button size="sm" onClick={() => onConnect(b)}>Connect to Sell Land</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BuilderNetwork() {
  const [selectedCounty, setSelectedCounty] = useState(null);
  const [stateFilter, setStateFilter]       = useState('all');
  const [search, setSearch]                 = useState('');
  const [connectBuilder, setConnectBuilder] = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);

  const filtered = useMemo(() => {
    return COUNTIES.filter(c => {
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return c.county.toLowerCase().includes(q) || c.state.toLowerCase().includes(q);
      }
      return true;
    });
  }, [stateFilter, search]);

  const openConnect = (builder) => { setConnectBuilder(builder); setDrawerOpen(true); };

  if (selectedCounty) {
    return (
      <>
        <CountyDetail county={selectedCounty} onBack={() => setSelectedCounty(null)} onConnect={openConnect} />
        <ConnectDrawer open={drawerOpen} builder={connectBuilder} county={selectedCounty} onClose={() => setDrawerOpen(false)} />
      </>
    );
  }

  const liveCount  = COUNTIES.filter(c => !c.comingSoon).length;
  const totalCount = COUNTIES.length;

  return (
    <>
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-8 bg-gradient-to-br from-sidebar to-gray-700 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={20} className="text-accent" />
              <span className="text-xs font-bold text-accent uppercase tracking-widest">Builder Network</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Find Builders. Sell Your Land.</h1>
            <p className="text-sm text-white/70 mb-6 max-w-xl">
              Find the top builders actively pulling permits in your county and connect with them to sell your land.
            </p>
            <div className="relative max-w-md mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search by county or zip code..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-accent/40 text-gray-700 placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2">
              {[['all', 'All States'], ['NC', 'North Carolina'], ['SC', 'South Carolina']].map(([val, label]) => (
                <button
                  key={val} onClick={() => setStateFilter(val)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${stateFilter === val ? 'bg-accent text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500 flex-wrap">
            <span><strong className="text-sidebar">{totalCount}</strong> counties tracked</span>
            <span><strong className="text-accent">{liveCount}</strong> with live data</span>
            <span><strong className="text-sidebar">{totalCount - liveCount}</strong> coming soon</span>
            <span className="ml-auto text-gray-400 italic">Updated monthly from county permit reports</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No counties match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => (
              <CountyCard key={c.id} county={c} onView={setSelectedCounty} />
            ))}
          </div>
        )}
      </div>

      <ConnectDrawer open={drawerOpen} builder={connectBuilder} county={selectedCounty} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
