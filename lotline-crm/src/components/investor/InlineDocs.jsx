import { useState, useEffect } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { fetchInlineDocuments } from '../../lib/investorPortalData';

const TYPE_LABELS = {
  operating_agreement: 'Operating Agreement',
  subscription:        'Subscription Agreement',
  wire:                'Wire Confirmation',
  closing:             'Closing Statement',
  k1:                  'K-1',
  '1099':              '1099',
  proforma:            'Proforma',
  other:               'Other',
};
const TYPE_COLORS = {
  operating_agreement: 'bg-blue-500/15 text-blue-400',
  subscription:        'bg-purple-500/15 text-purple-400',
  wire:                'bg-green-500/15 text-green-400',
  closing:             'bg-yellow-500/15 text-yellow-400',
  k1:                  'bg-orange-500/15 text-orange-400',
  '1099':              'bg-red-500/15 text-red-400',
  proforma:            'bg-teal-500/15 text-teal-400',
  other:               'bg-white/10 text-gray-400',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InlineDocs({ dealId, investorId }) {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(true);

  useEffect(() => {
    if (!dealId) return;
    fetchInlineDocuments(dealId, investorId).then(({ documents }) => {
      setDocs(documents);
      setLoading(false);
    });
  }, [dealId, investorId]);

  return (
    <div className="bg-[#1c2130] rounded-2xl border border-white/8 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-white">Documents</span>
          {!loading && docs.length > 0 && (
            <span className="text-[10px] bg-white/8 text-gray-400 px-1.5 py-0.5 rounded-full">{docs.length}</span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
      </button>

      {/* Body */}
      {open && (
        loading ? (
          <div className="px-5 pb-4 space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="px-5 pb-6 pt-2 flex flex-col items-center gap-2 text-center">
            <FolderOpen size={24} className="text-gray-700" />
            <p className="text-xs text-gray-600">No documents shared yet.<br />Your operator will upload them here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 border-t border-white/8">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[doc.doc_type] ?? TYPE_COLORS.other}`}>
                        {TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                      </span>
                      <span className="text-[9px] text-gray-600">{fmtDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={e => e.stopPropagation()}
                  className="ml-3 flex-shrink-0 flex items-center gap-1 text-[11px] text-gray-500 hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  aria-label={`Download ${doc.title}`}
                >
                  <Download size={12} />
                </a>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
