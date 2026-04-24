import { useState, useEffect } from 'react';
import { X, Send, Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { sendEmail } from '../../lib/emailData';

export default function ComposeEmailModal({ contact, dealId, onClose, onSent }) {
  const { activeOrgId, profile } = useAuth();
  const [toEmail,  setToEmail]  = useState(contact?.email || '');
  const [toName,   setToName]   = useState(contact?.fullName || '');
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState(null); // { ok, message }

  // Close on Escape
  useEffect(() => {
    const down = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onClose]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!toEmail.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    const { ok, log } = await sendEmail({
      orgId:     activeOrgId,
      sentBy:    profile?.id,
      contactId: contact?.id,
      dealId:    dealId || null,
      toEmail:   toEmail.trim(),
      toName:    toName.trim() || null,
      subject:   subject.trim(),
      body:      body.trim(),
    });
    setSending(false);
    if (ok) {
      setResult({ ok: true, message: 'Email sent successfully.' });
      if (onSent) onSent(log);
      setTimeout(onClose, 1500);
    } else {
      setResult({ ok: false, message: 'Failed to send. Check your Gmail connection in Settings → Integrations.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-accent" />
            <h2 className="font-semibold text-gray-800">New Email</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {/* To */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">To</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="email"
                  value={toEmail}
                  onChange={e => setToEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className="flex-1 text-sm text-gray-800 placeholder-gray-300 focus:outline-none"
                />
                {toName && <span className="text-xs text-gray-400 truncate max-w-[160px]">{toName}</span>}
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject"
                required
                className="flex-1 text-sm text-gray-800 placeholder-gray-300 focus:outline-none"
              />
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
              required
              rows={10}
              className="w-full text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
            />

            {result && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                result.ok
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {result.ok
                  ? <CheckCircle size={14} />
                  : <AlertCircle size={14} />
                }
                {result.message}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Sent via your connected Gmail account
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                Discard
              </button>
              <button type="submit" disabled={sending || !!result?.ok}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#c9703a' }}>
                {sending
                  ? <><Loader2 size={14} className="animate-spin" />Sending…</>
                  : <><Send size={14} />Send</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
