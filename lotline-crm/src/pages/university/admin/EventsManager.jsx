// /university/admin/events — hub admin events management
import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Radio, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { createEvent, patchEvent, deleteEvent } from '../../../lib/university';

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}
function defaultEnd() {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function EventsManager() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('university_events').select('*').order('starts_at', { ascending: false });
    if (error) setError(error.message); else setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSave = async (form) => {
    if (form.id) { await patchEvent(form.id, form); }
    else         { await createEvent(form); }
    setEditing(null);
    await load();
  };
  const onDelete = async (id) => {
    if (!window.confirm('Delete event?')) return;
    await deleteEvent(id);
    await load();
  };
  const onMarkLive = async (id) => {
    await patchEvent(id, { status: 'live' });
    await load();
  };
  const onUploadRecording = async (id) => {
    const url = window.prompt('Recording URL?');
    if (!url) return;
    await patchEvent(id, { recording_url: url, status: 'completed' });
    await load();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-800">Events</h1>
          <button onClick={() => setEditing({})} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">
            <Plus size={13} /> New event
          </button>
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">No events yet.</div>
        )}

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {rows.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{e.title}</p>
                  <p className="text-xs text-gray-400">{new Date(e.starts_at).toLocaleString()} · {e.status}</p>
                </div>
                {e.status === 'scheduled' && (
                  <button onClick={() => onMarkLive(e.id)} className="text-xs text-rose-600 hover:underline inline-flex items-center gap-1"><Radio size={11} /> Live</button>
                )}
                {e.status !== 'completed' && (
                  <button onClick={() => onUploadRecording(e.id)} className="text-xs text-gray-600 hover:underline inline-flex items-center gap-1"><CheckCircle2 size={11} /> Recording</button>
                )}
                <button onClick={() => setEditing(e)} className="p-1.5 text-gray-400 hover:text-accent"><Pencil size={13} /></button>
                <button onClick={() => onDelete(e.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}

        {editing && <EventForm initial={editing} onSave={onSave} onClose={() => setEditing(null)} />}
      </div>
    </div>
  );
}

function EventForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title:           initial.title || '',
    description:     initial.description || '',
    cover_image_url: initial.cover_image_url || '',
    host_name:       initial.host_name || '',
    starts_at:       initial.starts_at ? initial.starts_at.slice(0, 16) : defaultStart(),
    ends_at:         initial.ends_at   ? initial.ends_at.slice(0, 16)   : defaultEnd(),
    timezone:        initial.timezone || 'America/New_York',
    join_url:        initial.join_url || '',
    location:        initial.location || 'Virtual',
  });
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at:   new Date(form.ends_at).toISOString(),
      };
      if (initial.id) payload.id = initial.id;
      await onSave(payload);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">{initial.id ? 'Edit event' : 'New event'}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">Close</button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
          <Input label="Title"      val={form.title}      onChange={v => setForm({ ...form, title: v })} />
          <Input label="Host"       val={form.host_name}  onChange={v => setForm({ ...form, host_name: v })} />
          <Input label="Cover image URL" val={form.cover_image_url} onChange={v => setForm({ ...form, cover_image_url: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Starts" type="datetime-local" val={form.starts_at} onChange={v => setForm({ ...form, starts_at: v })} />
            <Input label="Ends"   type="datetime-local" val={form.ends_at}   onChange={v => setForm({ ...form, ends_at: v })} />
          </div>
          <Input label="Timezone"   val={form.timezone}   onChange={v => setForm({ ...form, timezone: v })} />
          <Input label="Join URL"   val={form.join_url}   onChange={v => setForm({ ...form, join_url: v })} placeholder="https://zoom.us/..." />
          <Input label="Location"   val={form.location}   onChange={v => setForm({ ...form, location: v })} />
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null} Save
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, val, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <input type={type} value={val} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
    </div>
  );
}
