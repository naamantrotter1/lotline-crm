import { useState, useEffect } from 'react';
import { Mail, Send, ChevronDown, ChevronUp, Eye, CornerDownLeft, Clock } from 'lucide-react';
import { fetchDealEmails } from '../../lib/dealEmailsData';
import ComposeEmailModal from '../Email/ComposeEmailModal';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function EmailRow({ email }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
          <Mail size={13} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-800 truncate">{email.subject}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(email.sent_at)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="truncate">To: {Array.isArray(email.to_emails) ? email.to_emails.join(', ') : email.to_emails}</span>
            {email.sent_by_name && <span className="flex-shrink-0 text-gray-400">from {email.sent_by_name}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {email.opened_at && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <Eye size={10} /> Opened {timeAgo(email.opened_at)}
                {email.open_count > 1 && ` (${email.open_count}×)`}
              </span>
            )}
            {email.replied_at && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                <CornerDownLeft size={10} /> Replied {timeAgo(email.replied_at)}
              </span>
            )}
            {!email.opened_at && !email.replied_at && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} /> Delivered
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-400 mt-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          {email.cc_emails && email.cc_emails.length > 0 && (
            <p className="text-xs text-gray-400 mb-2">CC: {email.cc_emails.join(', ')}</p>
          )}
          <div
            className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.body_html || email.body_text?.replace(/\n/g, '<br>') || '' }}
          />
        </div>
      )}
    </div>
  );
}

export default function DealEmailsTab({ deal, contact }) {
  const [emails,  setEmails]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await fetchDealEmails(deal.id);
    setEmails(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [deal.id]);

  const handleSent = () => {
    setCompose(false);
    load();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Emails {emails.length > 0 && <span className="text-gray-400 font-normal">({emails.length})</span>}
        </h3>
        <button
          onClick={() => setCompose(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#c9703a' }}
        >
          <Send size={11} /> Compose
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : emails.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Mail size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No emails sent for this deal yet.</p>
          <button
            onClick={() => setCompose(true)}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Send the first email
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => <EmailRow key={email.id} email={email} />)}
        </div>
      )}

      {/* Compose modal */}
      {compose && (
        <ComposeEmailModal
          contact={contact}
          dealId={deal.id}
          dealAddress={deal.address || deal.street_address}
          onClose={() => setCompose(false)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
