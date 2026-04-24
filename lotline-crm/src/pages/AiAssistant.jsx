/**
 * AiAssistant.jsx
 * Phase 19: AI Assistant — chat interface + quick tools (deal summary, email draft, voice note).
 */
import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Loader2, Copy, Check, RotateCcw, Mic, MicOff,
  FileText, Mail, Building2, AlertCircle, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { chat, draftEmail, cleanVoiceNote } from '../lib/aiData';

// ── Message bubble ─────────────────────────────────────────────────────────

function Message({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
          <Sparkles size={13} className="text-accent" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-accent text-white rounded-br-sm'
            : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm shadow-sm'
        }`}>
          {message.content}
        </div>
        {!isUser && (
          <button
            onClick={handleCopy}
            className="mt-1 ml-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-opacity"
          >
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quick Tools ────────────────────────────────────────────────────────────

function EmailDraftTool({ orgId, userId, onInsert }) {
  const [to, setTo]         = useState('');
  const [subject, setSubject] = useState('');
  const [points, setPoints] = useState('');
  const [tone, setTone]     = useState('professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);

  const handleDraft = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { text } = await draftEmail({ contactName: to, contactEmail: '', subject, tone, points }, orgId, userId);
      setResult(text);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="Recipient name"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject / topic"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
      </div>
      <textarea value={points} onChange={e => setPoints(e.target.value)} rows={2}
        placeholder="Key points to include"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
      <div className="flex items-center gap-3">
        <select value={tone} onChange={e => setTone(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="concise">Concise</option>
          <option value="urgent">Urgent</option>
        </select>
        <button onClick={handleDraft} disabled={loading || !subject}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Draft Email
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {result && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
          {result}
          <button onClick={() => onInsert(result)} className="mt-3 flex items-center gap-1.5 text-xs text-accent font-medium hover:underline">
            <Send size={11} /> Use in chat
          </button>
        </div>
      )}
    </div>
  );
}

function VoiceNoteTool({ orgId, userId }) {
  const [transcript, setTranscript] = useState('');
  const [cleaned, setCleaned]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);

  const handleClean = async () => {
    setLoading(true);
    setError(null);
    try {
      const { text } = await cleanVoiceNote(transcript, orgId, userId);
      setCleaned(text);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cleaned);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={4}
        placeholder="Paste or type your rough voice note / transcription here…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
      <button onClick={handleClean} disabled={loading || !transcript.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-60">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
        Clean Up Note
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {cleaned && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
          {cleaned}
          <button onClick={handleCopy} className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'chat',       label: 'Chat',        icon: Sparkles },
  { id: 'email',      label: 'Email Draft', icon: Mail },
  { id: 'voice',      label: 'Voice Note',  icon: Mic },
];

const QUICK_PROMPTS = [
  'What are best practices for cold outreach to landowners?',
  'How should I structure a seller finance deal?',
  'What questions should I ask on a land acquisition call?',
  'Help me analyze this deal: 5 acres at $50k/acre in a suburban market',
];

export default function AiAssistant() {
  const { activeOrgId, profile } = useAuth();
  const [activeTool, setActiveTool] = useState('chat');
  const [messages, setMessages]     = useState([
    { role: 'assistant', content: "Hi! I'm LotLine AI. I can help you analyze deals, draft emails, clean up voice notes, and answer real estate questions. What can I help you with?" }
  ]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMsg = text ?? input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setError(null);

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(0, -1); // history without the latest user msg
      const { text: reply } = await chat(userMsg, history.slice(-10), activeOrgId, profile?.id);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message);
      setMessages(m => [...m, { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent/10 rounded-xl flex items-center justify-center">
            <Sparkles size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800">LotLine AI</h1>
            <p className="text-xs text-gray-400">Powered by Claude</p>
          </div>
        </div>

        {/* Tool tabs */}
        <div className="flex items-center gap-1 ml-4 bg-gray-100 rounded-xl p-1">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTool === tool.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tool.icon size={12} />
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTool === 'chat' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => <Message key={i} message={msg} />)}

            {/* Quick prompts when only greeting shown */}
            {messages.length === 1 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center">Try asking…</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-accent/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={13} className="text-accent animate-pulse" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/10 transition-all">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your deals, contacts, or real estate…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none resize-none max-h-32"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 bg-accent text-white rounded-xl flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-300 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      ) : activeTool === 'email' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Mail size={15} className="text-accent" /> Email Draft Generator
            </h2>
            <EmailDraftTool
              orgId={activeOrgId}
              userId={profile?.id}
              onInsert={(text) => { setActiveTool('chat'); setInput(text); }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Mic size={15} className="text-accent" /> Voice Note Cleaner
            </h2>
            <VoiceNoteTool orgId={activeOrgId} userId={profile?.id} />
          </div>
        </div>
      )}
    </div>
  );
}
