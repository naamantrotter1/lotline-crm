import { useState } from 'react';
import { Image as ImageIcon, X, Send, Loader2 } from 'lucide-react';
import { createPost } from '../../lib/university';

export default function ForumComposer({ categories, defaultCategoryId, onPosted }) {
  const [open, setOpen]                 = useState(false);
  const [categoryId, setCategoryId]     = useState(defaultCategoryId || categories[0]?.id || '');
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [imageUrls, setImageUrls]       = useState([]);
  const [posting, setPosting]           = useState(false);
  const [error, setError]               = useState(null);

  const onSubmit = async (e) => {
    e?.preventDefault();
    if (!body.trim()) return;
    setPosting(true); setError(null);
    try {
      const post = await createPost({ category_id: categoryId, title: title.trim() || null, body, image_urls: imageUrls });
      setOpen(false); setTitle(''); setBody(''); setImageUrls([]);
      onPosted?.(post);
    } catch (e) { setError(e.message); }
    finally     { setPosting(false); }
  };

  const onAddImageUrl = () => {
    const u = window.prompt('Image URL?');
    if (!u) return;
    setImageUrls(prev => [...prev, u].slice(0, 4));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-accent/40 text-sm text-gray-400"
      >
        Share an update, a win, or ask the community…
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-xl border border-gray-200"
        >
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-gray-300 hover:text-gray-700">
          <X size={14} />
        </button>
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full text-sm font-semibold px-0 py-1 mb-2 border-0 focus:outline-none"
      />
      <textarea
        rows={4}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full text-sm px-0 py-1 border-0 focus:outline-none resize-none"
      />
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {imageUrls.map((u, i) => (
            <div key={i} className="relative">
              <img src={u} alt="" className="rounded-xl w-full h-28 object-cover" />
              <button type="button"
                onClick={() => setImageUrls(p => p.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={onAddImageUrl} disabled={imageUrls.length >= 4}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent disabled:opacity-40">
          <ImageIcon size={12} /> Add image
        </button>
        <button
          type="submit"
          disabled={posting || !body.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
        >
          {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Post
        </button>
      </div>
    </form>
  );
}
