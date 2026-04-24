/**
 * CustomFieldsSettings.jsx
 * Phase 7: Settings UI for defining org-level custom fields on contacts and deals.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, GripVertical } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  fetchFieldDefs,
  createFieldDef,
  deleteFieldDef,
  toFieldKey,
} from '../../lib/customFieldsData';

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url',      label: 'URL / Link' },
];

const TYPE_BADGES = {
  text:     'bg-gray-100 text-gray-600',
  number:   'bg-blue-50 text-blue-600',
  date:     'bg-purple-50 text-purple-600',
  select:   'bg-amber-50 text-amber-700',
  checkbox: 'bg-green-50 text-green-700',
  url:      'bg-cyan-50 text-cyan-700',
};

function AddFieldForm({ orgId, entityType, onAdded, onCancel }) {
  const [name,      setName]      = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [options,   setOptions]   = useState('');  // comma-separated for select
  const [required,  setRequired]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const opts = fieldType === 'select'
      ? options.split(',').map(o => o.trim()).filter(Boolean)
      : null;
    const { data, error: err } = await createFieldDef(orgId, {
      name: name.trim(),
      entityType,
      fieldType,
      options: opts,
      required,
    });
    setSaving(false);
    if (err) {
      setError(err.message || 'Failed to create field.');
      return;
    }
    onAdded(data);
  };

  const preview = name.trim() ? toFieldKey(name) : '';

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-700">New Field</p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Field name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Annual Revenue"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
          />
          {preview && <p className="text-[10px] text-gray-400 mt-0.5">Key: <code>{preview}</code></p>}
        </div>
        <div className="w-40">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
          <select
            value={fieldType}
            onChange={e => setFieldType(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {fieldType === 'select' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Options <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input
            type="text"
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder="Option A, Option B, Option C"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
          />
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={required}
          onChange={e => setRequired(e.target.checked)}
          className="rounded border-gray-300 text-accent focus:ring-accent/30"
        />
        <span className="text-sm text-gray-600">Required field</span>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
          style={{ backgroundColor: '#c9703a' }}
        >
          {saving ? 'Adding…' : 'Add Field'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldRow({ def, onDelete, canAdmin }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete the "${def.name}" field? Existing values stored on records will remain in the database but won't be shown.`)) return;
    setDeleting(true);
    await deleteFieldDef(def.id);
    onDelete(def.id);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">
      <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800">{def.name}</p>
          {def.required && (
            <span className="text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">Required</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          key: <code className="font-mono">{def.field_key}</code>
          {def.field_type === 'select' && def.options?.length > 0 && (
            <> &middot; {def.options.join(', ')}</>
          )}
        </p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGES[def.field_type] || 'bg-gray-100 text-gray-500'}`}>
        {FIELD_TYPES.find(t => t.value === def.field_type)?.label || def.field_type}
      </span>
      {canAdmin && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all disabled:opacity-50"
          title="Delete field"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      )}
    </div>
  );
}

function EntityTab({ orgId, entityType, label, canAdmin }) {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    fetchFieldDefs(orgId, entityType).then(d => { setDefs(d); setLoading(false); });
  }, [orgId, entityType]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          {defs.length === 0 && !showAdd && (
            <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-sm font-medium text-gray-400">No custom fields yet for {label}</p>
              <p className="text-xs text-gray-300 mt-1">Add fields to capture extra data on each {label.toLowerCase().replace('s', '')} record.</p>
            </div>
          )}
          {defs.map(def => (
            <FieldRow
              key={def.id}
              def={def}
              canAdmin={canAdmin}
              onDelete={id => setDefs(prev => prev.filter(d => d.id !== id))}
            />
          ))}
          {showAdd ? (
            <AddFieldForm
              orgId={orgId}
              entityType={entityType}
              onAdded={def => { setDefs(prev => [...prev, def]); setShowAdd(false); }}
              onCancel={() => setShowAdd(false)}
            />
          ) : canAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/5 transition-colors"
            >
              <Plus size={15} /> Add Field
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function CustomFieldsSettings() {
  const { activeOrgId } = useAuth();
  const { can } = usePermissions();
  const canAdmin = can('settings.manage');
  const [entityTab, setEntityTab] = useState('contact');

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: 'contact', label: 'Contacts' },
          { value: 'deal',    label: 'Deals' },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => setEntityTab(t.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${entityTab === t.value ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!canAdmin && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
          Only owners and admins can manage custom fields.
        </div>
      )}

      <EntityTab
        key={entityTab}
        orgId={activeOrgId}
        entityType={entityTab}
        label={entityTab === 'contact' ? 'Contacts' : 'Deals'}
        canAdmin={canAdmin}
      />
    </div>
  );
}
