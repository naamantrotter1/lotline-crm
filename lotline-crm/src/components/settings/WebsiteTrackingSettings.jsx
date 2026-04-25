/**
 * Website Tracking Pixel settings page.
 * Admins add domains → get a copy-paste <script> snippet.
 * Tracks page views via Supabase REST API with the public anon key.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Copy, Check, Trash2, AlertCircle,
  BarChart2, Users, Eye, ExternalLink, RefreshCw,
  Code2, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

// ── Pixel snippet generator ───────────────────────────────────────────────────
function buildSnippet(pixelId, supabaseUrl, anonKey) {
  return `<!-- LotLine Tracking Pixel -->
<script>
(function(){
  var PID='${pixelId}';
  var URL='${supabaseUrl}/rest/v1/web_visits';
  var KEY='${anonKey}';
  function uid(k){try{var v=localStorage.getItem(k);if(!v){v=crypto.randomUUID();localStorage.setItem(k,v);}return v;}catch(e){return 'anon';}}
  function sid(k){try{var v=sessionStorage.getItem(k);if(!v){v=crypto.randomUUID();sessionStorage.setItem(k,v);}return v;}catch(e){return 'anon';}}
  var payload=JSON.stringify({pixel_id:PID,url:location.href,referrer:document.referrer||null,user_agent:navigator.userAgent,screen_width:screen.width,screen_height:screen.height,visitor_id:uid('_llv'),session_id:sid('_lls')});
  if(navigator.sendBeacon){navigator.sendBeacon(URL+'?apikey='+KEY,new Blob([payload],{type:'application/json'}));}
  else{fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},body:payload}).catch(function(){});}
})();
<\/script>`;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
        copied
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
      } ${className}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy snippet'}
    </button>
  );
}

// ── Stats pill ────────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
      <Icon size={12} className="text-gray-400" />
      <span className="font-semibold text-gray-700">{value ?? '—'}</span>
      <span>{label}</span>
    </div>
  );
}

// ── Single website row ────────────────────────────────────────────────────────
function WebsiteRow({ site, snippet, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Globe size={15} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a2332] truncate">
            {site.name || site.domain}
          </p>
          <p className="text-[11px] text-gray-400">{site.domain}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Stat icon={Eye}   label="visits"    value={site.total_visits ?? 0} />
          <Stat icon={Users} label="unique"    value={site.unique_visitors ?? 0} />

          {/* Active toggle */}
          <button
            onClick={() => onToggle(site)}
            className="text-gray-400 hover:text-accent transition-colors"
            title={site.active ? 'Deactivate pixel' : 'Activate pixel'}
          >
            {site.active
              ? <ToggleRight size={20} className="text-accent" />
              : <ToggleLeft  size={20} />
            }
          </button>

          {/* Snippet expand */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
          >
            <Code2 size={13} />
            {expanded ? 'Hide' : 'Snippet'}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(site)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove website"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Snippet panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Install this snippet before &lt;/body&gt;
            </p>
            <CopyButton text={snippet} />
          </div>
          <pre className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono">
            {snippet}
          </pre>
          <p className="text-[11px] text-gray-400 mt-2">
            Pixel ID: <span className="font-mono">{site.pixel_id}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Add website form ──────────────────────────────────────────────────────────
function AddWebsiteForm({ onAdd, adding }) {
  const [domain, setDomain] = useState('');
  const [name,   setName]   = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!domain.trim()) return;
    onAdd({ domain: domain.trim().replace(/^https?:\/\//, ''), name: name.trim() || null });
    setDomain('');
    setName('');
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-3 p-4 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
      <div className="flex-1">
        <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Domain</label>
        <input
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="example.com"
          required
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
        />
      </div>
      <div className="flex-1">
        <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Label (optional)</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Main Site"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
        />
      </div>
      <button
        type="submit"
        disabled={adding || !domain.trim()}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
      >
        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Add Website
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WebsiteTrackingSettings() {
  const { activeOrgId } = useAuth();

  const [sites,   setSites]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [error,   setError]   = useState(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  || '';
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);
    // Use view for visit counts; fall back to table if view not migrated yet
    const { data, error: err } = await supabase
      .from('website_visit_counts')
      .select('*')
      .eq('organization_id', activeOrgId)
      .order('last_visit_at', { ascending: false, nullsFirst: false });
    if (err) {
      // Fallback: table without counts
      const { data: raw } = await supabase
        .from('tracked_websites')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });
      setSites(raw || []);
    } else {
      setSites(data || []);
    }
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async ({ domain, name }) => {
    setAdding(true);
    const { error: err } = await supabase
      .from('tracked_websites')
      .insert({ organization_id: activeOrgId, domain, name });
    if (err) setError(err.message);
    else await load();
    setAdding(false);
  };

  const handleToggle = async (site) => {
    await supabase
      .from('tracked_websites')
      .update({ active: !site.active })
      .eq('id', site.id);
    await load();
  };

  const handleDelete = async (site) => {
    if (!window.confirm(`Remove tracking for ${site.domain}? All visit data will be deleted.`)) return;
    await supabase.from('tracked_websites').delete().eq('id', site.id);
    await load();
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#1a2332] flex items-center gap-2">
          <BarChart2 size={18} className="text-accent" />
          Website Tracking
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Add a lightweight pixel to your website to track visitor activity and connect leads to deals.
          The snippet is under 1 KB and uses no cookies.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-[12px] font-semibold text-blue-700 mb-2 uppercase tracking-wide">How it works</p>
        <ol className="list-decimal list-inside space-y-1 text-[12px] text-blue-700">
          <li>Add your website domain below.</li>
          <li>Copy the generated script snippet.</li>
          <li>Paste it before <code className="font-mono bg-blue-100 px-1 rounded">&lt;/body&gt;</code> on every page.</li>
          <li>Visit data appears here automatically — no cookies required.</li>
        </ol>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Add form */}
      <AddWebsiteForm onAdd={handleAdd} adding={adding} />

      {/* Website list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            Tracked Websites ({sites.length})
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading
          ? <div className="py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></div>
          : sites.length === 0
            ? (
              <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl">
                <Globe size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No websites tracked yet</p>
                <p className="text-[12px] text-gray-300 mt-1">Add a domain above to get your pixel snippet</p>
              </div>
            )
            : sites.map(site => (
              <WebsiteRow
                key={site.id || site.pixel_id}
                site={site}
                snippet={buildSnippet(site.pixel_id, supabaseUrl, anonKey)}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
        }
      </div>

      {/* Anon key warning */}
      {sites.length > 0 && (
        <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          The snippet uses your Supabase anon key, which is safe for public websites when Row Level Security
          is enabled. Never use your service role key in a public snippet.
        </p>
      )}
    </div>
  );
}
