/**
 * ai-complete — Supabase Edge Function
 * Phase 19: General-purpose AI completion via Anthropic Claude.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 *
 * Supports features:
 *   - deal_summary    — summarize a deal's data
 *   - email_draft     — draft an email to a contact
 *   - contact_summary — summarize a contact's history
 *   - voice_note      — clean up voice-to-text transcription
 *   - chat            — free-form assistant chat
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPTS: Record<string, string> = {
  deal_summary:
    'You are a real estate acquisition assistant. Summarize the deal data concisely in 3-5 bullet points covering key financials, status, risks, and next steps. Use plain English, no markdown headers.',
  email_draft:
    'You are a professional real estate communicator. Draft a brief, warm, and professional email based on the provided context. Output only the email body (no subject line, no "Dear X" — just the body text starting from the first sentence).',
  contact_summary:
    'You are a CRM assistant. Given contact activity data, write a 2-3 sentence summary of who this person is, their relationship with the organization, and suggested next actions.',
  voice_note:
    'You are a transcription cleaner. Clean up this voice-to-text transcription: fix grammar, remove filler words (um, uh, like), and format as clean prose. Preserve all key information.',
  chat:
    'You are LotLine AI, an intelligent assistant for a real estate land acquisition CRM. Help the user with deal analysis, contact management, market research, and operational questions. Be concise and practical.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { feature, prompt, orgId, userId, context } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = SYSTEM_PROMPTS[feature] ?? SYSTEM_PROMPTS.chat;

    // Build user message
    let userMessage = prompt ?? '';
    if (context) {
      userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nRequest:\n${userMessage}`;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const aiResponse = await anthropicRes.json();
    const outputText = aiResponse.content?.[0]?.text ?? '';
    const inputTokens = aiResponse.usage?.input_tokens ?? 0;
    const outputTokens = aiResponse.usage?.output_tokens ?? 0;

    // Log usage
    if (orgId && userId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await admin.from('ai_usage').insert({
        organization_id: orgId,
        user_id: userId,
        feature,
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        prompt_preview: userMessage.slice(0, 200),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ text: outputText, inputTokens, outputTokens }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
