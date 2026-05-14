/**
 * SubmitForFundingButton
 *
 * Shown on DealDetail for operator/admin/owner users whose org is NOT a
 * lending hub (i.e. subscriber orgs). Opens a pre-filled modal that lets
 * the user submit the current deal to the LotLine Lending Hub.
 *
 * After submission the button shows a status badge instead so the user
 * always knows the current submission state for this deal.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, X, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  submitDeal,
  fetchMySubmissions,
  fetchLendingHub,
  STATUS_LABELS,
} from '../../lib/lendingSubmissionsData';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

const STATUS_BADGE = {
  submitted:    { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Clock },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
  approved:     { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  declined:     { bg: 'bg-red-100',    text: 'text-red-600',    icon: X },
  withdrawn:    { bg: 'bg-gray-100',   text: 'text-gray-500',   icon: X },
};

export default function SubmitForFundingButton({ deal }) {
  const navigate = useNavigate();
  const { activeOrgId, session, orgIsLendingHub } = useAuth();

  const [hub, setHub]               = useState(null); // { id, name, slug }
  const [existing, setExisting]     = useState(null); // existing submission for this deal
  const [modalOpen, setModalOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  const [form, setForm] = useState({
    loanAmountRequested: '',
    loanType: 'Land + Home Package',
    exitStrategy: 'Sell',
    creditScore: '700+',
    notes: '',
  });

  // Hub orgs don't submit to themselves
  if (orgIsLendingHub) return null;

  useEffect(() => {
    fetchLendingHub().then(setHub);
  }, []);

  useEffect(() => {
    if (!activeOrgId || !deal?.id) return;
    fetchMySubmissions(activeOrgId).then(subs => {
      const match = subs.find(s => s.dealId === deal.id);
      setExisting(match ?? null);
    });
  }, [activeOrgId, deal?.id]);

  if (!hub) return null; // no hub configured yet

  // If there's already a submission for this deal, show status badge only
  if (existing) {
    const cfg = STATUS_BADGE[existing.status] ?? STATUS_BADGE.submitted;
    const Icon = cfg.icon;
    return (
      <button
        type="button"
        onClick={() => navigate('/lending/my-submissions')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} hover:opacity-80 transition-opacity`}
        title="View submission in My Lending Submissions"
      >
        <Icon size={11} />
        Lending: {STATUS_LABELS[existing.status] ?? existing.status}
      </button>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hub || !activeOrgId || !session?.user?.id) return;
    setSubmitting(true);
    const { data, error } = await submitDeal(hub.id, activeOrgId, session.user.id, {
      dealId:              deal?.id,
      address:             deal?.address || '',
      county:              deal?.county  || null,
      state:               deal?.state   || null,
      acreage:             deal?.acreage ?? null,
      arv:                 deal?.arv     ?? null,
      purchasePrice:       deal?.land    ?? null,
      loanAmountRequested: form.loanAmountRequested || null,
      loanType:            form.loanType,
      exitStrategy:        form.exitStrategy,
      creditScore:         form.creditScore,
      notes:               form.notes || null,
    });
    setSubmitting(false);
    if (error) {
      alert('Submission failed: ' + (error.message || error));
      return;
    }
    setExisting(data);
    setDone(true);
    setModalOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded transition-colors"
        title={`Submit this deal to ${hub.name} for funding review`}
      >
        <DollarSign size={12} />
        Submit for Funding
      </button>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-sidebar">Submit for Funding</h2>
                <p className="text-xs text-gray-500 mt-0.5">Submitting to <strong>{hub.name}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Deal summary (read-only) */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Deal</p>
                  <p className="text-sm font-semibold text-sidebar">{deal?.address || 'No address'}</p>
                  {deal?.arv && (
                    <p className="text-xs text-gray-500">ARV: ${Number(deal.arv).toLocaleString()}</p>
                  )}
                </div>

                {/* Loan details */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Loan Amount Requested ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inp}
                    placeholder="e.g. 150000"
                    value={form.loanAmountRequested}
                    onChange={e => setForm(p => ({ ...p, loanAmountRequested: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Loan Type</label>
                    <select className={inp} value={form.loanType} onChange={e => setForm(p => ({ ...p, loanType: e.target.value }))}>
                      <option>Land + Home Package</option>
                      <option>Fix &amp; Flip</option>
                      <option>DSCR</option>
                      <option>Bridge Loan</option>
                      <option>Construction</option>
                      <option>Land Loan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Exit Strategy</label>
                    <select className={inp} value={form.exitStrategy} onChange={e => setForm(p => ({ ...p, exitStrategy: e.target.value }))}>
                      <option>Sell</option>
                      <option>Rent</option>
                      <option>Refinance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Credit Score Range</label>
                  <select className={inp} value={form.creditScore} onChange={e => setForm(p => ({ ...p, creditScore: e.target.value }))}>
                    <option>700+</option>
                    <option>650–699</option>
                    <option>600–649</option>
                    <option>Below 600</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    className={inp + ' resize-none'}
                    placeholder="Any context that may help the review…"
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send size={13} />
                  {submitting ? 'Submitting…' : 'Submit Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
