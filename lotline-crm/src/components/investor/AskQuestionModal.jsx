import { useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { sendInvestorInquiry } from '../../lib/investorPortalData';

export default function AskQuestionModal({ deal, investor, onClose }) {
  const [subject, setSubject]   = useState(`Question about ${deal?.address ?? 'this deal'}`);
  const [body, setBody]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) { setError('Please enter your message.'); return; }
    setSaving(true);
    const { error: err } = await sendInvestorInquiry(investor?.id, deal?.id, subject, body);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1c2130] rounded-t-2xl md:rounded-2xl border border-white/10 w-full md:max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-white">Ask a Question</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <MessageCircle size={20} className="text-green-400" />
            </div>
            <p className="text-white font-semibold">Message sent!</p>
            <p className="text-xs text-gray-400">We'll get back to you shortly.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-white/8 text-gray-300 rounded-lg text-sm hover:bg-white/12 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Message</label>
              <textarea
                value={body}
                onChange={e => { setBody(e.target.value); setError(null); }}
                rows={4}
                placeholder="What would you like to know?"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-accent/50 transition-colors resize-none"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
