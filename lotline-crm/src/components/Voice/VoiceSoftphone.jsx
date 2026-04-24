/**
 * VoiceSoftphone.jsx
 * Phase 13: In-app softphone using Twilio Voice JS SDK.
 *
 * The Twilio Voice SDK (@twilio/voice-sdk) must be loaded. We lazy-import
 * it to avoid bundling issues when the VOICE feature flag is off.
 *
 * Usage:
 *   <VoiceSoftphone toNumber="+15551234567" contactName="John Smith" onClose={() => {}} />
 *
 * The softphone shows:
 *   - Ringing / Live / Ended states
 *   - Timer when in-progress
 *   - Mute, Hold, Keypad, Hangup controls
 *   - Outcome selector after call ends
 *   - Notes field logged to calls table
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Pause, Play,
  Hash, X, Loader2, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getVoiceToken, createCall, endCall, updateCall } from '../../lib/voiceData';

const DIAL_KEYS = [
  ['1','',''], ['2','ABC',''], ['3','DEF',''],
  ['4','GHI',''], ['5','JKL',''], ['6','MNO',''],
  ['7','PQRS',''], ['8','TUV',''], ['9','WXYZ',''],
  ['*','',''], ['0','+',''], ['#','',''],
];

const OUTCOMES = ['answered','voicemail','busy','no-answer'];

export default function VoiceSoftphone({ toNumber, contactName, contactId, dealId, onClose, onCallLogged }) {
  const { activeOrgId, profile } = useAuth();
  const [phase, setPhase]         = useState('connecting'); // connecting|ringing|live|ended|error
  const [muted, setMuted]         = useState(false);
  const [onHold, setOnHold]       = useState(false);
  const [showKeypad, setKeypad]   = useState(false);
  const [digits, setDigits]       = useState('');
  const [timer, setTimer]         = useState(0);
  const [notes, setNotes]         = useState('');
  const [outcome, setOutcome]     = useState('answered');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const callRef   = useRef(null);  // Twilio Call object
  const deviceRef = useRef(null);  // Twilio Device
  const callIdRef = useRef(null);  // DB call record ID
  const timerRef  = useRef(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
  }, []);

  // Format elapsed time
  const fmtTimer = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleHangup = useCallback(async (status = 'completed', autoOutcome) => {
    stopTimer();
    callRef.current?.disconnect();
    setPhase('ended');
    if (callIdRef.current) {
      await updateCall(callIdRef.current, {
        status,
        duration_seconds: timer,
        ended_at: new Date().toISOString(),
      });
    }
    if (autoOutcome) setOutcome(autoOutcome);
  }, [timer, stopTimer]);

  // Init Twilio Device on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const token = await getVoiceToken(activeOrgId);
        if (!token) {
          setError('Voice not configured. Deploy the voice-token edge function with Twilio credentials.');
          setPhase('error');
          return;
        }

        // Dynamic import to avoid bundling when flag is off
        const { Device } = await import('@twilio/voice-sdk');
        const device = new Device(token, { logLevel: 'warn' });
        deviceRef.current = device;

        await device.register();
        if (cancelled) return;

        // Create DB record
        const { data: callRecord } = await createCall(activeOrgId, profile?.id, {
          to: toNumber,
          from: 'browser',
          contactId,
          dealId,
        });
        if (callRecord) callIdRef.current = callRecord.id;

        // Connect
        const call = await device.connect({ params: { To: toNumber } });
        callRef.current = call;
        setPhase('ringing');

        call.on('ringing', () => !cancelled && setPhase('ringing'));
        call.on('accept',  () => { if (!cancelled) { setPhase('live'); startTimer(); } });
        call.on('disconnect', () => { if (!cancelled) handleHangup('completed'); });
        call.on('cancel',     () => { if (!cancelled) handleHangup('canceled', 'no-answer'); });
        call.on('error', (e) => {
          if (!cancelled) { setError(e.message); setPhase('error'); }
        });
      } catch (e) {
        if (!cancelled) { setError(e.message); setPhase('error'); }
      }
    };

    init();
    return () => {
      cancelled = true;
      stopTimer();
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  const toggleMute = () => {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  };

  const sendDigit = (d) => {
    callRef.current?.sendDigits(d);
    setDigits(prev => prev + d);
  };

  const saveAndClose = async () => {
    setSaving(true);
    if (callIdRef.current) {
      await endCall(callIdRef.current, {
        duration: timer,
        status: 'completed',
        outcome,
        notes,
      });
    }
    setSaving(false);
    onCallLogged?.();
    onClose();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: '#1a2332' }}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{contactName || toNumber}</p>
          <p className="text-xs text-white/50">{toNumber}</p>
        </div>
        <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Main panel */}
      <div className="px-5 py-5">
        {/* Status / timer */}
        <div className="text-center mb-5">
          {phase === 'connecting' && (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Connecting…</span>
            </div>
          )}
          {phase === 'ringing' && (
            <div className="flex items-center justify-center gap-2 text-blue-500">
              <Phone size={16} className="animate-bounce" />
              <span className="text-sm font-medium">Ringing…</span>
            </div>
          )}
          {phase === 'live' && (
            <div>
              <div className="flex items-center justify-center gap-1.5 text-green-600 mb-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wide">Live</span>
              </div>
              <p className="text-3xl font-mono font-light text-gray-800">{fmtTimer(timer)}</p>
            </div>
          )}
          {phase === 'error' && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}
          {phase === 'ended' && (
            <div className="text-center">
              <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1" />
              <p className="text-sm text-gray-500">Call ended · {fmtTimer(timer)}</p>
            </div>
          )}
        </div>

        {/* Keypad */}
        {showKeypad && phase === 'live' && (
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {DIAL_KEYS.map(([num, sub]) => (
              <button key={num} onClick={() => sendDigit(num)}
                className="flex flex-col items-center py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-base font-semibold text-gray-800">{num}</span>
                {sub && <span className="text-[8px] text-gray-400 tracking-wider">{sub}</span>}
              </button>
            ))}
          </div>
        )}
        {digits && showKeypad && (
          <p className="text-center text-sm text-gray-500 mb-3 font-mono">{digits}</p>
        )}

        {/* Live controls */}
        {phase === 'live' && !showKeypad && (
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={toggleMute}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${muted ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              <span className="text-[9px]">{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={() => setKeypad(true)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
              <Hash size={18} />
              <span className="text-[9px]">Keypad</span>
            </button>
            <button onClick={() => setOnHold(h => !h)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${onHold ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {onHold ? <Play size={18} /> : <Pause size={18} />}
              <span className="text-[9px]">{onHold ? 'Resume' : 'Hold'}</span>
            </button>
          </div>
        )}
        {showKeypad && phase === 'live' && (
          <button onClick={() => setKeypad(false)} className="w-full text-xs text-accent hover:underline mb-3">
            ← Back
          </button>
        )}

        {/* Hangup (live / ringing / connecting) */}
        {(phase === 'live' || phase === 'ringing' || phase === 'connecting') && (
          <button onClick={() => handleHangup('completed')}
            className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#ef4444' }}>
            <PhoneOff size={18} /> End Call
          </button>
        )}

        {/* Post-call: outcome + notes */}
        {phase === 'ended' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Outcome</label>
              <div className="grid grid-cols-2 gap-1.5">
                {OUTCOMES.map(o => (
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                      outcome === o ? 'border-accent bg-accent text-white' : 'border-gray-200 text-gray-600 hover:border-accent/50'
                    }`}>
                    {o.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Call notes…" rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
            </div>
            <button onClick={saveAndClose} disabled={saving}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Saving…' : 'Save & Close'}
            </button>
          </div>
        )}

        {phase === 'error' && (
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 mt-2">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
