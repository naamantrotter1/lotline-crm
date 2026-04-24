/**
 * LeadFormPublic.jsx
 * Phase 17: Public lead form page — no auth required.
 * Accessible at /f/:slug
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchFormBySlug, submitForm } from '../lib/leadFormData';

export default function LeadFormPublic() {
  const { slug } = useParams();
  const [form, setForm]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    fetchFormBySlug(slug).then(f => {
      setForm(f);
      setLoading(false);
    });
  }, [slug]);

  const fields = (form?.lead_form_fields ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  const handleChange = (label, value) => {
    setValues(v => ({ ...v, [label]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitForm(form.id, form.organization_id, values);
      setSubmitted(true);
      if (form.redirect_url) {
        setTimeout(() => { window.location.href = form.redirect_url; }, 2000);
      }
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const themeColor = form?.theme_color ?? '#c9703a';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">This form is not available.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-6">
          <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: themeColor }} />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 text-sm">Your response has been submitted. We'll be in touch soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header bar */}
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: themeColor }} />
        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">{form.name}</h1>
          {form.description && (
            <p className="text-sm text-gray-500 mb-6">{form.description}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.field_type === 'textarea' ? (
                  <textarea
                    value={values[field.label] ?? ''}
                    onChange={e => handleChange(field.label, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': themeColor + '40' }}
                  />
                ) : field.field_type === 'select' ? (
                  <select
                    value={values[field.label] ?? ''}
                    onChange={e => handleChange(field.label, e.target.value)}
                    required={field.required}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values[field.label]}
                      onChange={e => handleChange(field.label, e.target.checked)}
                      required={field.required}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: themeColor }}
                    />
                    <span className="text-sm text-gray-600">{field.placeholder ?? field.label}</span>
                  </label>
                ) : (
                  <input
                    type={field.field_type === 'email' ? 'email' : field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'phone' ? 'tel' : 'text'}
                    value={values[field.label] ?? ''}
                    onChange={e => handleChange(field.label, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  />
                )}
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                <AlertCircle size={12} />{error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: themeColor }}
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                : form.submit_button_text}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-300 mt-4">Powered by LotLine</p>
      </div>
    </div>
  );
}
