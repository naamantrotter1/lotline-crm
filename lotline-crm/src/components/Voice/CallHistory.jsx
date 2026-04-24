/**
 * CallHistory.jsx
 * Phase 13: Call log panel for Contact / Deal detail.
 */
import { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, Loader2, Mic } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { fetchCalls, CALL_OUTCOME, formatDuration } from '../../lib/voiceData';
import VoiceSoftphone from './VoiceSoftphone';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CallRow({ call }) {
  const isOut = call.direction === 'outbound';
  const outcome = call.outcome ? CALL_OUTCOME[call.outcome] : null;
  const missed = call.status === 'no-answer' || call.status === 'busy';
  const Icon = missed ? PhoneMissed : (isOut ? Phone : PhoneIncoming);
  const iconColor = missed ? 'text-red-400' : (isOut ? 'text-accent' : 'text-green-500');

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`flex-shrink-0 ${iconColor}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 capitalize">{isOut ? 'Outbound' : 'Inbound'}</span>
          {outcome && <span className="text-[10px] text-gray-400">{outcome.icon} {outcome.label}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{fmtDate(call.started_at)}</span>
          {call.duration_seconds > 0 && (
            <span className="text-[10px] text-gray-400">· {formatDuration(call.duration_seconds)}</span>
          )}
        </div>
        {call.notes && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{call.notes}</p>}
      </div>
      {call.recording_url && (
        <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
          className="p-1 text-gray-300 hover:text-accent transition-colors flex-shrink-0">
          <Mic size={12} />
        </a>
      )}
    </div>
  );
}

export default function CallHistory({ contactId, contactPhone, contactName, dealId }) {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const [calls, setCalls]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const canCall = can('voice.call');

  useEffect(() => {
    if (!activeOrgId || !contactId) return;
    fetchCalls(activeOrgId, { contactId }).then(d => { setCalls(d); setLoading(false); });
  }, [activeOrgId, contactId]);

  const handleCallLogged = () => {
    fetchCalls(activeOrgId, { contactId }).then(setCalls);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Calls ({calls.length})
        </span>
        {canCall && contactPhone && (
          <button
            onClick={() => setShowPhone(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white rounded-lg"
            style={{ backgroundColor: '#c9703a' }}
          >
            <Phone size={10} /> Call
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-gray-300" /></div>
      ) : calls.length === 0 ? (
        <p className="text-xs text-gray-300 italic py-1">No calls logged</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {calls.slice(0, 6).map(c => <CallRow key={c.id} call={c} />)}
          {calls.length > 6 && <p className="text-xs text-gray-400 pt-2">+{calls.length - 6} more</p>}
        </div>
      )}

      {showPhone && (
        <VoiceSoftphone
          toNumber={contactPhone}
          contactName={contactName}
          contactId={contactId}
          dealId={dealId}
          onClose={() => setShowPhone(false)}
          onCallLogged={handleCallLogged}
        />
      )}
    </>
  );
}
