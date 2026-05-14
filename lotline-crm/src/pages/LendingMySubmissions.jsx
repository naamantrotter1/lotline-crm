/**
 * /lending/my-submissions
 *
 * Shows all deals this org has submitted to the LotLine Lending Hub,
 * along with their current status and any messages from the hub.
 *
 * Visible to operator/admin/owner only (not agents, not investors).
 * Renders a "no hub configured" fallback if fetchLendingHub returns null.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  Clock, CheckCircle, XCircle, AlertCircle, MessageSquare,
  ChevronLeft, Send, X, Inbox,
} from 'lucide-react';
import Button from '../components/UI/Button';
import {
  fetchMySubmissions,
  withdrawSubmission,
  postMessage,
  fetchMessages,
  STATUS_LABELS,
} from '../lib/lendingSubmissionsData';

// ── Status badge config ──────────────────────────────────────────────────────
const STATUS_BADGE = {
  submitted:    { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Clock },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
  approved:     { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  declined:     { bg: 'bg-red-100',    text: 'text-red-600',    icon: XCircle },
  withdrawn:    { bg: 'bg-gray-100',   text: 'text-gray-500',   icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.submitted;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} />{STATUS_LABELS[status] ?? status}
    </span>
  );
}

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

// ── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-screen w-[500px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-sidebar truncate pr-4">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LendingMySubmissions() {
  const navigate = useNavigate();
  const { activeOrgId, session } = useAuth();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);

  const [selected, setSelected]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [msgBody, setMsgBody]         = useState('');
  const [msgSending, setMsgSending]   = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const data = await fetchMySubmissions(activeOrgId);
    setSubmissions(data);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (sub) => {
    setSelected(sub);
    setDrawerOpen(true);
    const msgs = await fetchMessages(sub.id);
    setMessages(msgs);
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    setSelected(null);
    setMessages([]);
    setMsgBody('');
  };

  const handleSendMessage = async () => {
    if (!msgBody.trim() || !selected) return;
    setMsgSending(true);
    const { data, error } = await postMessage(
      selected.id,
      session?.user?.id,
      activeOrgId,
      msgBody,
      false, // submitters cannot send internal notes
    );
    setMsgSending(false);
    if (error) { alert('Could not send message.'); return; }
    setMessages(prev => [...prev, data]);
    setMsgBody('');
  };

  const handleWithdraw = async () => {
    if (!selected) return;
    if (!window.confirm('Withdraw this submission? This cannot be undone.')) return;
    setWithdrawing(true);
    const { data, error } = await withdrawSubmission(selected.id);
    setWithdrawing(false);
    if (error) { alert('Could not withdraw: ' + (error.message || error)); return; }
    setSelected(data);
    setSubmissions(prev => prev.map(s => s.id === data.id ? data : s));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/lending')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-accent transition-colors"
        >
          <ChevronLeft size={16} /> Capital &amp; Partnerships
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-sidebar">My Lending Submissions</h1>
      </div>

      <p className="text-sm text-gray-500">
        Deals you've submitted to the LotLine Lending Hub for funding review.
        You'll see status updates and messages from the LotLine team here.
      </p>

      {/* Submissions list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400 font-medium">No submissions yet</p>
            <p className="text-xs text-gray-400 mt-1">Use the "Submit for Funding" button on any deal to get started.</p>
            <button
              type="button"
              onClick={() => navigate('/lending')}
              className="mt-4 text-sm text-accent font-semibold hover:underline"
            >
              Go to Capital &amp; Partnerships
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref #', 'Address', 'Loan Requested', 'Hub', 'Submitted', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 text-sm font-semibold text-accent whitespace-nowrap">{sub.ref}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{sub.address || '—'}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">
                      {sub.loanAmountRequested ? `$${Number(sub.loanAmountRequested).toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{sub.hubOrgName || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDetail(sub)}
                        className="text-xs text-accent font-semibold hover:underline flex items-center gap-1"
                      >
                        <MessageSquare size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={closeDetail}
        title={selected ? `${selected.ref} — ${selected.address || 'No address'}` : ''}
      >
        {selected && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
              {/* Status + decision note */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={selected.status} />
                {selected.hubOrgName && (
                  <span className="text-xs text-gray-500">Hub: <strong>{selected.hubOrgName}</strong></span>
                )}
              </div>

              {selected.decisionNote && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Decision Note from Hub</p>
                  <p className="text-sm text-gray-700">{selected.decisionNote}</p>
                </div>
              )}

              {/* Deal snapshot */}
              <div>
                <p className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Deal Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Address',       selected.address],
                    ['County',        selected.county],
                    ['State',         selected.state],
                    ['Acreage',       selected.acreage],
                    ['ARV',           selected.arv ? `$${Number(selected.arv).toLocaleString()}` : null],
                    ['Purchase Price', selected.purchasePrice ? `$${Number(selected.purchasePrice).toLocaleString()}` : null],
                    ['Loan Requested', selected.loanAmountRequested ? `$${Number(selected.loanAmountRequested).toLocaleString()}` : null],
                    ['Loan Type',     selected.loanType],
                    ['Exit Strategy', selected.exitStrategy],
                    ['Credit Score',  selected.creditScore],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
                      <p className="text-sm font-medium text-sidebar mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
                {selected.notes && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Notes</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div>
                <p className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Messages</p>
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div key={msg.id} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sidebar text-xs">{msg.authorName}</span>
                          <span className="text-gray-400 text-xs ml-auto">{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 text-xs leading-relaxed">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Withdraw option for pending submissions */}
              {['submitted', 'under_review'].includes(selected.status) && (
                <div>
                  <button
                    type="button"
                    disabled={withdrawing}
                    onClick={handleWithdraw}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline disabled:opacity-50"
                  >
                    {withdrawing ? 'Withdrawing…' : 'Withdraw this submission'}
                  </button>
                </div>
              )}
            </div>

            {/* Message compose (only for active submissions) */}
            {!['withdrawn', 'declined'].includes(selected.status) && (
              <div className="px-6 py-4 border-t border-gray-100 space-y-3 flex-shrink-0">
                <textarea
                  rows={2}
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  placeholder="Send a message to the LotLine team…"
                  className={inp + ' resize-none text-sm'}
                />
                <Button onClick={handleSendMessage} disabled={msgSending || !msgBody.trim()}>
                  <Send size={13} className="mr-1" /> {msgSending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
