/**
 * LeadForms.jsx
 * Phase 17: Lead form builder and submissions dashboard.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, Copy, Trash2, Edit2, ExternalLink, Eye,
  CheckCircle2, X, GripVertical, AlertCircle, Loader2, Users,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  fetchForms, fetchForm, createForm, updateForm, deleteForm,
  saveFormFields, fetchSubmissions, FIELD_TYPES, CONTACT_FIELD_MAPPINGS,
} from '../lib/leadFormData';

// ── Field Editor Row ───────────────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
      <GripVertical size={14} className="text-gray-300 mt-2.5 flex-shrink-0" />
      <div className="flex-1 grid grid-cols-2 gap-2">
        <input
          value={field.label}
          onChange={e => onChange(index, 'label', e.target.value)}
          placeholder="Field label"
          className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        <select
          value={field.field_type}
          onChange={e => onChange(index, 'field_type', e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none"
        >
          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={field.maps_to ?? ''}
          onChange={e => onChange(index, 'maps_to', e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none"
        >
          {CONTACT_FIELD_MAPPINGS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {field.field_type === 'select' && (
          <input
            value={(field.options ?? []).join(', ')}
            onChange={e => onChange(index, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="Options (comma separated)"
            className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          />
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={e => onChange(index, 'required', e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Required
        </label>
      </div>
      <button onClick={() => onRemove(index)} className="text-gray-300 hover:text-red-400 mt-2 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Form Builder Modal ─────────────────────────────────────────────────────

function FormBuilderModal({ existingForm, orgId, userId, onClose, onSaved }) {
  const [name, setName]     = useState(existingForm?.name ?? '');
  const [slug, setSlug]     = useState(existingForm?.slug ?? '');
  const [description, setDescription] = useState(existingForm?.description ?? '');
  const [notifyEmail, setNotifyEmail] = useState(existingForm?.notify_email ?? '');
  const [themeColor, setThemeColor]   = useState(existingForm?.theme_color ?? '#c9703a');
  const [submitText, setSubmitText]   = useState(existingForm?.submit_button_text ?? 'Submit');
  const [fields, setFields] = useState(
    existingForm?.lead_form_fields?.slice().sort((a,b) => a.sort_order - b.sort_order) ??
    [{ label: 'Name', field_type: 'text', required: true, maps_to: 'first_name' },
     { label: 'Email', field_type: 'email', required: true, maps_to: 'email' },
     { label: 'Phone', field_type: 'phone', required: false, maps_to: 'phone' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const addField = () => setFields(f => [...f, { label: 'New Field', field_type: 'text', required: false, maps_to: '' }]);
  const removeField = (i) => setFields(f => f.filter((_, idx) => idx !== i));
  const updateField = (i, key, val) => setFields(f => f.map((fld, idx) => idx === i ? { ...fld, [key]: val } : fld));

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      let formId = existingForm?.id;
      if (existingForm) {
        await updateForm(existingForm.id, { name, slug, description, notify_email: notifyEmail || null, theme_color: themeColor, submit_button_text: submitText });
      } else {
        const form = await createForm(orgId, userId, { name, slug, description, notifyEmail: notifyEmail || null, themeColor, submitButtonText: submitText });
        formId = form.id;
      }
      await saveFormFields(formId, fields);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-800">{existingForm ? 'Edit Form' : 'New Lead Form'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Form Name *</label>
              <input value={name} onChange={e => { setName(e.target.value); if (!existingForm) setSlug(e.target.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')); }}
                placeholder="e.g. Land Inquiry Form"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">URL Slug</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50">/f/</span>
                <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''))}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Theme Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                <input value={themeColor} onChange={e => setThemeColor(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Submit Button Text</label>
              <input value={submitText} onChange={e => setSubmitText(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Notify Email (on submission)</label>
              <input value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} type="email"
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description (shown on form)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Short description shown to the person filling out the form"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
            </div>
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Fields</h3>
              <button onClick={addField} className="flex items-center gap-1 text-xs text-accent font-medium hover:underline">
                <Plus size={12} /> Add Field
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <FieldRow key={i} field={field} index={i} onChange={updateField} onRemove={removeField} />
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
              <AlertCircle size={12} />{error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !name}
              className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Form'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Submissions Panel ──────────────────────────────────────────────────────

function SubmissionsPanel({ form, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions(form.id).then(s => { setSubmissions(s); setLoading(false); });
  }, [form.id]);

  const fields = (form.lead_form_fields ?? []).slice().sort((a,b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{form.name}</h2>
          <p className="text-xs text-gray-400">{submissions.length} submissions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Users size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No submissions yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                {fields.map(f => (
                  <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{f.label}</th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(sub.submitted_at).toLocaleString()}
                  </td>
                  {fields.map(f => (
                    <td key={f.id} className="px-4 py-3 text-xs text-gray-700 max-w-[200px] truncate">
                      {sub.data[f.label] !== undefined ? String(sub.data[f.label]) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-xs">
                    {sub.contacts
                      ? <span className="text-accent font-medium">{sub.contacts.first_name} {sub.contacts.last_name}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function LeadForms() {
  const { activeOrgId, profile } = useAuth();
  const [forms, setForms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [viewingForm, setViewingForm] = useState(null);
  const [copied, setCopied]       = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const data = await fetchForms(activeOrgId);
    setForms(data);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const handleCopyLink = (slug) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleDelete = async (id) => {
    await deleteForm(id);
    setForms(f => f.filter(form => form.id !== id));
  };

  const handleToggleActive = async (form) => {
    await updateForm(form.id, { active: !form.active });
    setForms(f => f.map(fr => fr.id === form.id ? { ...fr, active: !fr.active } : fr));
  };

  if (viewingForm) {
    const fullForm = forms.find(f => f.id === viewingForm);
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <SubmissionsPanel form={fullForm} onBack={() => setViewingForm(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Lead Forms</h1>
            <p className="text-sm text-gray-400 mt-0.5">Create embeddable forms that auto-create contacts</p>
          </div>
          <button
            onClick={() => { setEditingForm(null); setShowBuilder(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90"
          >
            <Plus size={15} /> New Form
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ClipboardList size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-500">No lead forms yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a form to start capturing leads</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map(form => {
              const submissionCount = form.lead_submissions?.[0]?.count ?? 0;
              return (
                <div key={form.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: form.theme_color }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{form.name}</p>
                          {!form.active && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">/f/{form.slug}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500">
                            {(form.lead_form_fields?.length ?? 0)} fields
                          </span>
                          <span className="text-xs text-gray-400">·</span>
                          <button
                            onClick={() => setViewingForm(form.id)}
                            className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
                          >
                            <Users size={11} /> {submissionCount} submissions
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(form)}
                        className={`p-1.5 rounded-lg transition-colors ${form.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}
                        title={form.active ? 'Deactivate' : 'Activate'}
                      >
                        {form.active ? <CheckCircle2 size={15} /> : <X size={15} />}
                      </button>
                      <button
                        onClick={() => handleCopyLink(form.slug)}
                        className="p-1.5 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        title="Copy link"
                      >
                        {copied === form.slug ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                      </button>
                      <a
                        href={`/f/${form.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Preview form"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        onClick={() => { setEditingForm(form); setShowBuilder(true); }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(form.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showBuilder && (
        <FormBuilderModal
          existingForm={editingForm}
          orgId={activeOrgId}
          userId={profile?.id}
          onClose={() => { setShowBuilder(false); setEditingForm(null); }}
          onSaved={() => { setShowBuilder(false); setEditingForm(null); load(); }}
        />
      )}
    </div>
  );
}
