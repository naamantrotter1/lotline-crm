import { useState, useEffect } from 'react';
import { X, Send, Mail, Loader2, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { sendDealEmail } from '../../lib/dealEmailsData';
import { supabase } from '../../lib/supabase';

function buildBodyPreview(text) {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= 100) return text;
  const sentenceEnd = /[.!?]+\s+/g;
  let match, count = 0, lastIdx = 0;
  while ((match = sentenceEnd.exec(text)) !== null) {
    count++;
    lastIdx = match.index + match[0].length;
    if (count >= 3) break;
  }
  return lastIdx > 0 ? text.slice(0, lastIdx).trim() + '…' : text.slice(0, 300) + '…';
}

const EMAIL_TEMPLATES = [
  {
    id: 'intro',
    label: 'Initial Outreach',
    subject: 'Interested in Your Property',
    body: `Hi {name},\n\nI hope this message finds you well. My name is {senderName} and I'm reaching out because I'm interested in learning more about your property.\n\nWould you be open to a brief conversation about a potential offer? I'd love to discuss what works best for you.\n\nBest regards,\n{senderName}`,
  },
  {
    id: 'follow_up',
    label: 'Follow-Up',
    subject: 'Following Up — Your Property',
    body: `Hi {name},\n\nI wanted to follow up on my previous message regarding your property. I'm still very interested and would love to connect when you have a moment.\n\nPlease feel free to reply to this email or call me at your convenience.\n\nThank you for your time,\n{senderName}`,
  },
  {
    id: 'offer',
    label: 'Offer Letter',
    subject: 'Written Offer for Your Property',
    body: `Hi {name},\n\nThank you for speaking with me. As discussed, I'd like to formally present an offer for your property.\n\nI'll be sending the full offer details separately. In the meantime, please don't hesitate to reach out with any questions.\n\nLooking forward to working together,\n{senderName}`,
  },
  {
    id: 'closing',
    label: 'Closing Coordination',
    subject: 'Next Steps — Closing Your Property',
    body: `Hi {name},\n\nGreat news — we're moving forward with the closing on your property! I wanted to share a few next steps so we can make this process as smooth as possible for you.\n\nOur closing team will be in touch shortly with the full timeline and any documents needed from your end.\n\nThank you for choosing to work with us,\n{senderName}`,
  },
  {
    id: 'thank_you',
    label: 'Thank You',
    subject: 'Thank You',
    body: `Hi {name},\n\nI wanted to take a moment to thank you for your time and trust throughout this process. It has been a pleasure working with you.\n\nPlease don't hesitate to reach out if you ever have questions or need anything in the future.\n\nWarm regards,\n{senderName}`,
  },
];

function applyTemplate(template, { name, senderName }) {
  const replacements = { name: name || '', senderName: senderName || '' };
  return {
    subject: template.subject.replace(/\{(\w+)\}/g, (_, k) => replacements[k] ?? `{${k}}`),
    body: template.body.replace(/\{(\w+)\}/g, (_, k) => replacements[k] ?? `{${k}}`),
  };
}

export default function ComposeEmailModal({ contact, dealId, dealAddress, onClose, onSent }) {
  const { activeOrgId, profile } = useAuth();
  const [toEmail,  setToEmail]  = useState(contact?.email || '');
  const [toName,   setToName]   = useState(contact?.fullName || contact?.first_name
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : '');
  const [ccInput,  setCcInput]  = useState('');
  const [ccList,   setCcList]   = useState([]);
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [showCc,   setShowCc]   = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState(null); // { ok, message }

  // Close on Escape
  useEffect(() => {
    const down = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onClose]);

  const addCcEmail = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && ccInput.trim()) {
      e.preventDefault();
      const email = ccInput.trim().replace(/,$/, '');
      if (email && !ccList.includes(email)) setCcList(prev => [...prev, email]);
      setCcInput('');
    }
  };

  const removeCc = (email) => setCcList(prev => prev.filter(e => e !== email));

  const handleTemplate = (tpl) => {
    const senderName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name || ''
      : '';
    const { subject: s, body: b } = applyTemplate(tpl, { name: toName, senderName });
    setSubject(s);
    setBody(b);
    setShowTemplates(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!toEmail.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const data = await sendDealEmail({
        toEmail:  toEmail.trim(),
        toName:   toName.trim() || null,
        subject:  subject.trim(),
        body:     body.trim(),
        cc:       ccList,
        dealId:   dealId || null,
        orgId:    activeOrgId,
      });

      // Log activity note client-side so it reliably appears in the Activity feed
      console.log('[ComposeEmail] onSend: dealId=', dealId, 'orgId=', activeOrgId, 'supabase=', !!supabase);
      if (dealId && activeOrgId && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[ComposeEmail] session uid=', session?.user?.id);
        if (session) {
          const sentBy    = profile?.name || session.user.email || '';
          const toDisplay = toName.trim() ? `${toName.trim()} (${toEmail.trim()})` : toEmail.trim();
          const today     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const notePayload = {
            organization_id: activeOrgId,
            deal_id:         dealId,
            author_id:       session.user.id,
            author_name:     sentBy,
            note_type:       'email',
            body:            `📧 Email sent to ${toDisplay} — ${subject.trim()}`,
            metadata: {
              subject:      subject.trim(),
              to_name:      toName.trim() || null,
              to_email:     toEmail.trim(),
              body_preview: buildBodyPreview(body.trim()),
              sent_by:      sentBy,
              sent_via:     data?.sentVia || null,
              status:       'sent',
              date:         today,
            },
          };
          const { error: noteErr } = await supabase.from('activity_notes').insert(notePayload);
          if (noteErr) {
            console.error('[ComposeEmail] email note insert failed:', noteErr.message, noteErr);
            // Fallback: insert as plain note if 'email' type is blocked by constraint
            const { error: fallbackErr } = await supabase.from('activity_notes').insert({
              ...notePayload,
              note_type: 'note',
              metadata:  null,
            });
            if (fallbackErr) {
              console.error('[ComposeEmail] fallback note insert also failed:', fallbackErr.message, fallbackErr);
            } else {
              console.log('[ComposeEmail] fallback note inserted (note_type=note) for deal', dealId);
            }
          } else {
            console.log('[ComposeEmail] email note inserted successfully for deal', dealId);
          }
        }
      }

      setResult({ ok: true, message: 'Email sent successfully.' });
      if (onSent) onSent(data);
      setTimeout(onClose, 1500);
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Failed to send. Check your Gmail connection in Settings → Integrations.' });
    } finally {
      setSending(false);
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
            {dealAddress && (
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                {dealAddress}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
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
                <button
                  type="button"
                  onClick={() => setShowCc(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  Cc
                </button>
              </div>
            </div>

            {/* CC */}
            {showCc && (
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0 pt-0.5">Cc</span>
                <div className="flex-1 flex flex-wrap gap-1">
                  {ccList.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">
                      {email}
                      <button type="button" onClick={() => removeCc(email)} className="text-gray-400 hover:text-gray-600">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={ccInput}
                    onChange={e => setCcInput(e.target.value)}
                    onKeyDown={addCcEmail}
                    onBlur={() => {
                      if (ccInput.trim()) {
                        setCcList(prev => [...prev, ccInput.trim()]);
                        setCcInput('');
                      }
                    }}
                    placeholder="Add CC email, press Enter"
                    className="flex-1 min-w-[160px] text-sm text-gray-800 placeholder-gray-300 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Subject + Templates */}
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
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTemplates(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 border border-gray-200"
                >
                  Templates <ChevronDown size={11} />
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                    {EMAIL_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleTemplate(tpl)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                {result.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
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
