// /university/admin/forum — hub admin moderation
import { useEffect, useState } from 'react';
import { Loader2, Pin, ShieldCheck, Trash2, Plus } from 'lucide-react';
import { adminListPosts, adminPatchPost, fetchCategories, addCategory, patchCategory } from '../../../lib/university';

export default function ForumModeration() {
  const [tab, setTab]     = useState('posts');
  const [posts, setPosts] = useState([]);
  const [cats, setCats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([adminListPosts(), fetchCategories()]);
      setPosts(p); setCats(c);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onTogglePin = async (p) => { await adminPatchPost(p.id, { is_pinned: !p.is_pinned }); load(); };
  const onToggleAdmin = async (p) => { await adminPatchPost(p.id, { is_admin_post: !p.is_admin_post }); load(); };
  const onSoftDelete = async (p) => {
    if (!window.confirm('Hide this post from the feed?')) return;
    await adminPatchPost(p.id, { deleted_at: new Date().toISOString() });
    load();
  };
  const onUndelete = async (p) => { await adminPatchPost(p.id, { deleted_at: null }); load(); };

  const onAddCategory = async () => {
    const name = window.prompt('Category name?'); if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await addCategory({ slug, name, sort_order: cats.length });
    load();
  };
  const onRenameCategory = async (c) => {
    const name = window.prompt('New name?', c.name); if (!name) return;
    await patchCategory(c.id, { name });
    load();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-800">Forum moderation</h1>
          <div className="flex border border-gray-200 rounded-xl bg-white">
            {['posts', 'categories'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs capitalize ${tab === t ? 'bg-accent text-white' : 'text-gray-500'}`}>{t}</button>
            ))}
          </div>
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}

        {tab === 'posts' && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {posts.map(p => (
              <div key={p.id} className={`px-4 py-3 ${p.deleted_at ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.title || p.body?.slice(0, 80) + (p.body?.length > 80 ? '…' : '')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.author_profile ? `${p.author_profile.first_name || ''} ${p.author_profile.last_name || ''}`.trim() : 'Unknown'} ·
                      {' '}{p.category?.name} · {new Date(p.created_at).toLocaleString()}
                      {p.deleted_at && <span className="text-red-500 ml-2">(hidden)</span>}
                    </p>
                  </div>
                  <button onClick={() => onTogglePin(p)} title="Pin" className={`p-1.5 ${p.is_pinned ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}>
                    <Pin size={13} />
                  </button>
                  <button onClick={() => onToggleAdmin(p)} title="Admin badge" className={`p-1.5 ${p.is_admin_post ? 'text-accent' : 'text-gray-400 hover:text-accent'}`}>
                    <ShieldCheck size={13} />
                  </button>
                  {p.deleted_at
                    ? <button onClick={() => onUndelete(p)} className="text-xs text-gray-600 hover:underline">Restore</button>
                    : <button onClick={() => onSoftDelete(p)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
            {posts.length === 0 && <p className="text-center py-8 text-sm text-gray-400">No posts.</p>}
          </div>
        )}

        {tab === 'categories' && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Forum categories</p>
              <button onClick={onAddCategory} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <Plus size={11} /> Add
              </button>
            </div>
            {cats.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">/{c.slug}</p>
                </div>
                <button onClick={() => onRenameCategory(c)} className="text-xs text-gray-500 hover:text-accent">Rename</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
