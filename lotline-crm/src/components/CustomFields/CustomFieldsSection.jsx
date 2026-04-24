/**
 * CustomFieldsSection.jsx
 * Phase 7: Renders custom field values on a contact or deal record.
 * Fetches definitions from Supabase; values are read from / written to
 * the record's `custom_fields` JSONB object.
 */
import { useState, useEffect } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchFieldDefs } from '../../lib/customFieldsData';

function FieldValue({ def, value }) {
  if (def.field_type === 'checkbox') {
    return <span className={`text-sm font-medium ${value ? 'text-green-600' : 'text-gray-400'}`}>{value ? 'Yes' : 'No'}</span>;
  }
  if (def.field_type === 'url' && value) {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline truncate">{value}</a>;
  }
  if (!value && value !== 0) return <span className="text-sm text-gray-300 italic">—</span>;
  return <span className="text-sm text-gray-700">{value}</span>;
}

function FieldInput({ def, value, onChange }) {
  const base = "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  if (def.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="rounded border-gray-300 text-accent focus:ring-accent/30"
        />
        <span className="text-sm text-gray-600">{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }
  if (def.field_type === 'select') {
    const opts = Array.isArray(def.options) ? def.options : [];
    return (
      <select value={value || ''} onChange={e => onChange(e.target.value)} className={base}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (def.field_type === 'number') {
    return <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} className={base} />;
  }
  if (def.field_type === 'date') {
    return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={base} />;
  }
  if (def.field_type === 'url') {
    return <input type="url" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="https://" className={base} />;
  }
  return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={base} />;
}

export default function CustomFieldsSection({ orgId, entityType, values = {}, onSave, canEdit }) {
  const navigate = useNavigate();
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    fetchFieldDefs(orgId, entityType).then(d => { setDefs(d); setLoading(false); });
  }, [orgId, entityType]);

  // No definitions → render nothing
  if (!loading && defs.length === 0) return null;

  const startEdit = () => {
    setDraft({ ...values });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ custom_fields: draft });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Custom Fields</p>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="text-xs text-accent hover:underline font-medium"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => navigate('/settings?tab=custom-fields')}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 ml-1"
          title="Manage custom fields"
        >
          <Settings size={12} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
      ) : editing ? (
        <div className="space-y-3">
          {defs.map(def => (
            <div key={def.id}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                {def.name}{def.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <FieldInput
                def={def}
                value={draft[def.field_key]}
                onChange={v => setDraft(prev => ({ ...prev, [def.field_key]: v }))}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#c9703a' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {defs.map(def => (
            <div key={def.id}>
              <label className="block text-xs font-semibold text-gray-500 mb-0.5">{def.name}</label>
              <FieldValue def={def} value={values[def.field_key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
