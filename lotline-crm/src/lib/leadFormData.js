/**
 * leadFormData.js
 * Phase 17: Lead Forms data layer.
 */
import { supabase } from './supabase';

// ── Forms ──────────────────────────────────────────────────────────────────

export async function fetchForms(orgId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('lead_forms')
    .select('*, lead_form_fields(*), lead_submissions(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function fetchForm(id) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('lead_forms')
    .select('*, lead_form_fields(*)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function fetchFormBySlug(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('lead_forms')
    .select('*, lead_form_fields(*)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  return data;
}

export async function createForm(orgId, userId, { name, slug, description, notifyEmail, dealId, themeColor = '#c9703a', submitButtonText = 'Submit' }) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('lead_forms')
    .insert({
      organization_id: orgId,
      created_by: userId,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: description ?? null,
      notify_email: notifyEmail ?? null,
      deal_id: dealId ?? null,
      theme_color: themeColor,
      submit_button_text: submitButtonText,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateForm(id, patch) {
  if (!supabase) return;
  await supabase.from('lead_forms').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteForm(id) {
  if (!supabase) return;
  await supabase.from('lead_forms').delete().eq('id', id);
}

// ── Fields ─────────────────────────────────────────────────────────────────

export async function saveFormFields(formId, fields) {
  if (!supabase) return;
  // Delete existing, re-insert
  await supabase.from('lead_form_fields').delete().eq('form_id', formId);
  if (fields.length > 0) {
    await supabase.from('lead_form_fields').insert(
      fields.map((f, i) => ({
        form_id: formId,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder ?? null,
        required: f.required ?? false,
        options: f.options ?? null,
        sort_order: i,
        maps_to: f.maps_to ?? null,
      }))
    );
  }
}

// ── Submissions ────────────────────────────────────────────────────────────

export async function fetchSubmissions(formId, { limit = 100 } = {}) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('lead_submissions')
    .select('*, contacts(first_name, last_name, email)')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchRecentSubmissions(orgId, { limit = 20 } = {}) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('lead_submissions')
    .select('*, lead_forms(name, slug)')
    .eq('organization_id', orgId)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Submit a lead form (called from public page — uses anon key).
 * Server-side contact creation handled by edge function.
 */
export async function submitForm(formId, orgId, formData) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('lead-form-submit', {
    body: { formId, orgId, data: formData },
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Field type helpers ─────────────────────────────────────────────────────

export const FIELD_TYPES = [
  { value: 'text',     label: 'Short Text' },
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Phone' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
];

export const CONTACT_FIELD_MAPPINGS = [
  { value: '',           label: '— No mapping —' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name',  label: 'Last Name' },
  { value: 'email',      label: 'Email' },
  { value: 'phone',      label: 'Phone' },
  { value: 'address',    label: 'Address' },
  { value: 'notes',      label: 'Notes' },
];
