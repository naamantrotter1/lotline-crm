// Modal lesson editor — title, description, video upload, resources.
// Renders inside CourseEditor when a lesson row is selected.
import { useEffect, useState } from 'react';
import { X, UploadCloud, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { updateLesson, requestCloudflareUploadUrl, addResource, deleteResource } from '../../../lib/university';

export default function LessonEditor({ lessonId, onClose }) {
  const [lesson, setLesson]       = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);

  const load = async () => {
    const [{ data: l }, { data: rs }] = await Promise.all([
      supabase.from('university_lessons').select('*').eq('id', lessonId).single(),
      supabase.from('university_lesson_resources').select('*').eq('lesson_id', lessonId).order('sort_order'),
    ]);
    setLesson(l);
    setResources(rs || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await load(); } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [lessonId]);

  const onPatch = (patch) => setLesson(l => ({ ...l, ...patch }));

  const onSave = async () => {
    setSaving(true);
    try {
      await updateLesson(lessonId, {
        title:            lesson.title,
        description:      lesson.description,
        video_provider:   lesson.video_provider || 'cf_stream',
        video_id_or_url:  lesson.video_id_or_url || '',
        duration_seconds: lesson.duration_seconds || null,
      });
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };

  const onUpload = async (file) => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const { uploadUrl, uid } = await requestCloudflareUploadUrl();
      // Cloudflare's Direct Upload endpoint expects a multipart POST with the file
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      // Save UID immediately; duration is filled in by a separate poll
      await updateLesson(lessonId, {
        video_provider: 'cf_stream',
        video_id_or_url: uid,
      });
      onPatch({ video_provider: 'cf_stream', video_id_or_url: uid });
      // Try to fetch duration shortly after — non-blocking
      pollForDuration(uid).then(dur => {
        if (dur) updateLesson(lessonId, { duration_seconds: dur }).then(() => onPatch({ duration_seconds: dur }));
      }).catch(() => {});
    } catch (e) { setError(e.message); }
    finally     { setUploading(false); }
  };

  const onAddResource = async () => {
    const label = window.prompt('Resource label (e.g. "Worksheet PDF")');
    if (!label) return;
    const url = window.prompt('Resource URL');
    if (!url) return;
    const mime = /\.pdf(\?|$)/i.test(url) ? 'application/pdf' : null;
    await addResource(lessonId, label, url, mime);
    await load();
  };

  const onDeleteResource = async (rid) => {
    if (!window.confirm('Remove this resource?')) return;
    await deleteResource(rid);
    await load();
  };

  if (loading) return modalShell(<div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>, onClose);
  if (error)   return modalShell(<div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>, onClose);
  if (!lesson) return null;

  return modalShell(
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Title</label>
        <input value={lesson.title} onChange={e => onPatch({ title: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Description</label>
        <textarea rows={3} value={lesson.description || ''} onChange={e => onPatch({ description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Video</label>
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
          {lesson.video_id_or_url
            ? <p className="text-xs text-gray-600">
                <span className="font-mono">{lesson.video_provider}</span> · {lesson.video_id_or_url.slice(0, 32)}…
                {lesson.duration_seconds ? ` · ${Math.round(lesson.duration_seconds / 60)}m` : ''}
              </p>
            : <p className="text-xs text-gray-400 mb-2">Drag &amp; drop or click to upload a .mp4 / .mov</p>}
          <label className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 cursor-pointer">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
            {uploading ? 'Uploading…' : (lesson.video_id_or_url ? 'Replace video' : 'Upload video')}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => onUpload(e.target.files?.[0])}
              disabled={uploading}
            />
          </label>
          <div className="mt-3 text-[10px] text-gray-400">or paste a URL/HLS manifest:</div>
          <div className="mt-1 flex gap-2">
            <select
              value={lesson.video_provider}
              onChange={e => onPatch({ video_provider: e.target.value })}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200"
            >
              <option value="cf_stream">cf_stream</option>
              <option value="mux">mux</option>
              <option value="url">url</option>
            </select>
            <input
              value={lesson.video_id_or_url}
              onChange={e => onPatch({ video_id_or_url: e.target.value })}
              placeholder={lesson.video_provider === 'url' ? 'https://…m3u8' : 'video uid'}
              className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Resources</label>
          <button onClick={onAddResource} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
            <Plus size={11} /> Add
          </button>
        </div>
        <ul className="space-y-1">
          {resources.map(r => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 text-sm">
              <span className="flex-1 truncate text-gray-800">{r.label}</span>
              <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-accent"><ExternalLink size={12} /></a>
              <button onClick={() => onDeleteResource(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
            </li>
          ))}
          {!resources.length && <li className="text-xs text-gray-400">No resources yet.</li>}
        </ul>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={async () => { await onSave(); onClose(); }} disabled={saving} className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
          Save lesson
        </button>
      </div>
    </div>,
    onClose,
  );
}

function modalShell(content, onClose) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Edit lesson</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">{content}</div>
      </div>
    </div>
  );
}

async function pollForDuration(uid) {
  // Poll the lesson row (publisher RLS lets us read it) every 4s up to ~60s
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const { data } = await supabase
      .from('university_lessons')
      .select('duration_seconds')
      .eq('video_id_or_url', uid)
      .maybeSingle();
    if (data?.duration_seconds && data.duration_seconds > 0) return data.duration_seconds;
  }
  return null;
}
