/**
 * aiData.js
 * Phase 19: AI / Anthropic data layer.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY — set in Supabase Edge Function secrets
 */
import { supabase } from './supabase';

/**
 * Call the ai-complete edge function.
 * @param {'deal_summary'|'email_draft'|'contact_summary'|'voice_note'|'chat'} feature
 * @param {string} prompt
 * @param {object} [context] — optional structured context (deal data, contact data, etc.)
 * @param {string} [orgId]
 * @param {string} [userId]
 * @returns {Promise<{text: string, inputTokens: number, outputTokens: number}>}
 */
export async function aiComplete(feature, prompt, { context, orgId, userId } = {}) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('ai-complete', {
    body: { feature, prompt, context, orgId, userId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchAiUsage(orgId, { days = 30 } = {}) {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ── Convenience helpers ───────────────────────────────────────────────────

export function summarizeDeal(dealData, orgId, userId) {
  return aiComplete('deal_summary', 'Summarize this deal.', {
    context: dealData, orgId, userId,
  });
}

export function draftEmail({ contactName, contactEmail, subject, tone = 'professional', points }, orgId, userId) {
  return aiComplete('email_draft',
    `Write an email to ${contactName} about: ${subject}. Tone: ${tone}. Key points: ${points}`, {
      context: { contactName, contactEmail }, orgId, userId,
    });
}

export function summarizeContact(contactData, orgId, userId) {
  return aiComplete('contact_summary', 'Summarize this contact and suggest next actions.', {
    context: contactData, orgId, userId,
  });
}

export function cleanVoiceNote(rawTranscript, orgId, userId) {
  return aiComplete('voice_note', rawTranscript, { orgId, userId });
}

export function chat(message, conversationHistory = [], orgId, userId) {
  // Build a single prompt with conversation history
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  const prompt = historyText ? `${historyText}\nUser: ${message}` : message;
  return aiComplete('chat', prompt, { orgId, userId });
}
