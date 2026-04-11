import { useState, useMemo } from 'react';
import { ArrowLeft, Search, X, Building2, Send, CheckCircle, ChevronRight, Users, TrendingUp } from 'lucide-react';
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

  // Reset on open
  const handleOpen = () => {
    if (!open) return;
    try {
      const u = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const msg = `Hi ${builder?.name || 'there'}, I own ${form.acreage || '[X]'} acres in ${county?.county || '[County]'} County and believe it may be a great fit for your pipeline. I'd love to connect.`;
      setForm({
        ...EMPTY_FORM,
        county: county?.county || '',
        name: u.name || '',
        email: u.email || '',
        message: msg,
      });
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

  const next = () => {
    if (step < 3) setStep(s => s + 1);
  };

  const submit = (e) => {
    e.preventDefault();
    const ref = 'LND-' + Math.floor(1000 + Math.random() * 9000);
    const payload = { ref, builder: builder?.name, county: county?.county, state: county?.state, ...form, submittedAt: new Date().toISOString() };
    console.log('🏗️ Builder Connect Submission:', payload);
    setConfirmed(ref);
  };

  const close = () => { onClose(); setConfirmed(null); setStep(1); };

  const STEP_LABELS = ['Land Details', 'Contact Info', 'Message'];

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={close} />
      <div className={`fixed top-0 right-0 h-full w-[500px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Connect to Sell Land</p>
            <h2 className="text-base font-bold text-sidebar">{builder?.name}</h2>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {confirmed ? (
          /* Confirmation screen */
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
            {/* Progress bar */}
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

                {/* ── Step 1: Land Details ── */}
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
                        <option>Residential</option>
                        <option>Agricultural</option>
                        <option>Mixed Use</option>
                        <option>Unzoned</option>
                        <option>Unknown</option>
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

                {/* ── Step 2: Contact Info ── */}
                {step === 2 && (
                  <>
                    <SectionLabel>Your Contact Info</SectionLabel>
                    <Field label="Full Name">
                      <input name="name" required value={form.name} onChange={set} className={inp} placeholder="Jane Smith" />
                    </Field>
                    <Field label="Email Address">
                      <input name="email" type="email" required value={form.email} onChange={set} className={inp} placeholder="jane@example.com" />
                    </Field>
                    <Field label="Phone Number">
                      <input name="phone" type="tel" value={form.phone} onChange={set} className={inp} placeholder="(555) 000-0000" />
                    </Field>
                    <Field label="Best Time to Contact">
                      <select name="contactTime" value={form.contactTime} onChange={set} className={inp}>
                        <option>Morning</option>
                        <option>Afternoon</option>
                        <option>Evening</option>
                      </select>
                    </Field>
                  </>
                )}

                {/* ── Step 3: Message ── */}
                {step === 3 && (
                  <>
                    <SectionLabel>Message to Builder</SectionLabel>
                    <Field label="Your Message">
                      <textarea
                        name="message" value={form.message} onChange={set}
                        rows={6} className={inp + ' resize-none'}
                        placeholder="Write your message here..."
                      />
                    </Field>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox" name="sendCopy" checked={form.sendCopy} onChange={set}
                        className="mt-0.5 accent-[#f97316] w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                        Also send a copy to the <strong>LotLine team</strong> for assistance with this introduction.
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                {step < 3 ? (
                  <Button type="button" onClick={next} className="w-full justify-center">
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
  const top = topBuilder(county);
  const total = totalPermits(county);

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

  return (
    <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-sidebar">{county.county} County</h3>
        <StateBadge state={county.state} />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Users size={12} className="text-accent" />
          <span><strong className="text-sidebar">{county.builders.length}</strong> active builders tracked</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <TrendingUp size={12} className="text-accent" />
          <span>Top builder: <strong className="text-sidebar">{top?.name}</strong> — {top?.permits} permits</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Building2 size={12} className="text-accent" />
          <span><strong className="text-sidebar">{total}</strong> total permits tracked</span>
        </div>
      </div>
      <Button onClick={() => onView(county)} size="sm" className="w-full justify-center">
        View Builders <ChevronRight size={12} className="ml-1" />
      </Button>
    </div>
  );
}

// ── County Detail View ────────────────────────────────────────────────────────
function CountyDetail({ county, onBack, onConnect }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors font-medium">
          <ArrowLeft size={15} /> Back
        </button>
      </div>

      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-sidebar">{county.county} County, {county.state}</h2>
              <StateBadge state={county.state} />
            </div>
            <p className="text-sm text-gray-500">Active Builder Rankings — {totalPermits(county)} total permits tracked</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span><strong className="text-sidebar">{county.builders.length}</strong> builders</span>
          </div>
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
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-sidebar">{b.name}</span>
                  </td>
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
                    <Button size="sm" onClick={() => onConnect(b)}>
                      Connect to Sell Land
                    </Button>
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

  const openConnect = (builder) => {
    setConnectBuilder(builder);
    setDrawerOpen(true);
  };

  if (selectedCounty) {
    return (
      <>
        <CountyDetail
          county={selectedCounty}
          onBack={() => setSelectedCounty(null)}
          onConnect={openConnect}
        />
        <ConnectDrawer
          open={drawerOpen}
          builder={connectBuilder}
          county={selectedCounty}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    );
  }

  const liveCount  = COUNTIES.filter(c => !c.comingSoon).length;
  const totalCount = COUNTIES.length;

  return (
    <>
      <div className="space-y-6">
        {/* Hero header */}
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

            {/* Search */}
            <div className="relative max-w-md mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by county or zip code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-accent/40 text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* State toggles */}
            <div className="flex gap-2">
              {[['all', 'All States'], ['NC', 'North Carolina'], ['SC', 'South Carolina']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStateFilter(val)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${stateFilter === val ? 'bg-accent text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500 flex-wrap">
            <span><strong className="text-sidebar">{totalCount}</strong> counties tracked</span>
            <span><strong className="text-accent">{liveCount}</strong> with live data</span>
            <span><strong className="text-sidebar">{totalCount - liveCount}</strong> coming soon</span>
            <span className="ml-auto text-gray-400 italic">Updated monthly from county permit reports</span>
          </div>
        </div>

        {/* County grid */}
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

      <ConnectDrawer
        open={drawerOpen}
        builder={connectBuilder}
        county={selectedCounty}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
