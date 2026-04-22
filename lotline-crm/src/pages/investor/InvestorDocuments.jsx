import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Download, Search, FolderOpen } from 'lucide-react';
import { fetchMyDocuments } from '../../lib/investorPortalData';

const DOC_TYPE_LABELS = {
  operating_agreement: 'Operating Agreement',
  subscription:        'Subscription',
  wire:                'Wire Confirmation',
  closing:             'Closing Document',
  k1:                  'K-1',
  '1099':              '1099',
  other:               'Other',
};

const DOC_TYPE_COLORS = {
  operating_agreement: 'bg-blue-500/15 text-blue-400',
  subscription:        'bg-purple-500/15 text-purple-400',
  wire:                'bg-green-500/15 text-green-400',
  closing:             'bg-yellow-500/15 text-yellow-400',
  k1:                  'bg-orange-500/15 text-orange-400',
  '1099':              'bg-red-500/15 text-red-400',
  other:               'bg-gray-200 text-gray-500',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InvestorDocuments() {
  const { investor }         = useOutletContext();
  const [docs, setDocs]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!investor) return;
    fetchMyDocuments(investor.id).then(({ documents }) => {
      setDocs(documents);
      setLoading(false);
    });
  }, [investor]);

  const types = ['all', ...new Set(docs.map(d => d.doc_type).filter(Boolean))];
  const filtered = docs.filter(d => {
    const matchQuery = (d.title ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (d.deals?.address ?? '').toLowerCase().includes(query.toLowerCase());
    const matchType = typeFilter === 'all' || d.doc_type === typeFilter;
    return matchQuery && matchType;
  });

  // Group by year → tax folder concept
  const byYear = filtered.reduce((acc, doc) => {
    const yr = doc.created_at ? new Date(doc.created_at).getFullYear() : 'Other';
    if (!acc[yr]) acc[yr] = [];
    acc[yr].push(doc);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documents</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} shared with you</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="pl-8 pr-4 py-2 bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-accent/50 w-52"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              {t === 'all' ? 'All' : (DOC_TYPE_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-white/8 rounded-xl h-16 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1c2130] rounded-xl p-12 text-center border border-gray-200 dark:border-white/8">
          <FolderOpen size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No documents available yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byYear).sort((a, b) => b[0] - a[0]).map(([year, yearDocs]) => (
            <div key={year}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{year}</h3>
              <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
                {yearDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0">
                        <FileText size={16} className="text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DOC_TYPE_COLORS[doc.doc_type] ?? DOC_TYPE_COLORS.other}`}>
                            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                          </span>
                          {doc.deals?.address && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{doc.deals.address}</span>
                          )}
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtDate(doc.created_at)}</span>
                          {doc.file_size_bytes && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtBytes(doc.file_size_bytes)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="ml-3 flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-accent transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
                      onClick={e => e.stopPropagation()}
                    >
                      <Download size={13} /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
