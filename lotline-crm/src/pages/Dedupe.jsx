/**
 * Dedupe.jsx
 * Phase 18: Contact deduplication and merge UI.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  GitMerge, RefreshCw, Check, X, ChevronRight, AlertCircle,
  Loader2, User, Tag, Phone, Mail, MapPin,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchDedupeCandidates, runDedupesScan, mergeContacts, dismissCandidate } from '../lib/dedupeData';

const SCORE_COLOR = (score) => {
  if (score >= 90) return 'text-red-600 bg-red-50';
  if (score >= 70) return 'text-amber-600 bg-amber-50';
  return 'text-blue-600 bg-blue-50';
};

const REASON_LABELS = {
  same_email: 'Same email',
  same_phone: 'Same phone',
  same_name:  'Same name',
};

function ContactCard({ contact, isWinner, onSelectWinner }) {
  return (
    <div
      className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
        isWinner ? 'border-accent bg-accent/5' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
      onClick={onSelectWinner}
    >
      {isWinner && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent mb-2">
          <Check size={12} /> Keep this one
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-gray-800">
          {contact.first_name} {contact.last_name}
        </p>
        {contact.email && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Mail size={11} className="text-gray-300" />{contact.email}
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone size={11} className="text-gray-300" />{contact.phone}
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={11} className="text-gray-300" />{contact.address}
          </div>
        )}
        {contact.lead_source && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Tag size={11} className="text-gray-300" />{contact.lead_source}
          </div>
        )}
        <p className="text-xs text-gray-300 mt-2">
          Added {new Date(contact.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default function Dedupe() {
  const { activeOrgId, profile } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected]     = useState({}); // candidateId → keepId
  const [merging, setMerging]       = useState({});
  const [error, setError]           = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const data = await fetchDedupeCandidates(activeOrgId);
    setCandidates(data);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResult(null);
    try {
      const result = await runDedupesScan(activeOrgId);
      setScanResult(result?.found ?? 0);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setScanning(false);
  };

  const handleMerge = async (candidate) => {
    const keepId = selected[candidate.id] ?? candidate.contact_a.id;
    const mergeId = keepId === candidate.contact_a.id ? candidate.contact_b.id : candidate.contact_a.id;
    setMerging(m => ({ ...m, [candidate.id]: true }));
    setError(null);
    try {
      await mergeContacts(candidate.id, keepId, mergeId, activeOrgId, profile?.id);
      setCandidates(c => c.filter(cand => cand.id !== candidate.id));
    } catch (e) {
      setError(e.message);
    }
    setMerging(m => ({ ...m, [candidate.id]: false }));
  };

  const handleDismiss = async (candidateId) => {
    await dismissCandidate(candidateId, profile?.id);
    setCandidates(c => c.filter(cand => cand.id !== candidateId));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Deduplicate Contacts</h1>
            <p className="text-sm text-gray-400 mt-0.5">Identify and merge duplicate contact records</p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-60"
          >
            <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan for Duplicates'}
          </button>
        </div>

        {scanResult !== null && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
            <Check size={14} />
            Scan complete — found {scanResult} potential duplicate pair{scanResult !== 1 ? 's' : ''}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600">
            <AlertCircle size={12} />{error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <GitMerge size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-500">No duplicate candidates found</p>
            <p className="text-xs text-gray-400 mt-1">Run a scan to detect potential duplicates</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">{candidates.length} pair{candidates.length !== 1 ? 's' : ''} to review</p>
            {candidates.map(cand => {
              const keepId = selected[cand.id] ?? cand.contact_a.id;
              return (
                <div key={cand.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SCORE_COLOR(cand.score)}`}>
                        {cand.score}% match
                      </span>
                      {cand.match_reasons.map(r => (
                        <span key={r} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {REASON_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-stretch gap-3 mb-4">
                    <ContactCard
                      contact={cand.contact_a}
                      isWinner={keepId === cand.contact_a.id}
                      onSelectWinner={() => setSelected(s => ({ ...s, [cand.id]: cand.contact_a.id }))}
                    />
                    <div className="flex items-center text-gray-300 flex-shrink-0">
                      <ChevronRight size={16} />
                    </div>
                    <ContactCard
                      contact={cand.contact_b}
                      isWinner={keepId === cand.contact_b.id}
                      onSelectWinner={() => setSelected(s => ({ ...s, [cand.id]: cand.contact_b.id }))}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDismiss(cand.id)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50"
                    >
                      <X size={13} /> Not a duplicate
                    </button>
                    <button
                      onClick={() => handleMerge(cand)}
                      disabled={merging[cand.id]}
                      className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-xs font-medium hover:bg-accent/90 disabled:opacity-60 ml-auto"
                    >
                      {merging[cand.id]
                        ? <><Loader2 size={13} className="animate-spin" /> Merging…</>
                        : <><GitMerge size={13} /> Merge</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
