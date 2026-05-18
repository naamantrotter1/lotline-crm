// /university/feed/post/:id
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Pencil, Trash2, ShieldCheck, Pin } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { fetchPostDetail, postComment, deleteComment, patchPost, deletePost } from '../../lib/university';
import { supabase } from '../../lib/supabase';
import LikeButton from '../../components/university/LikeButton';
import CommentThread from '../../components/university/CommentThread';

function displayName(p) { return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Member'; }

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, orgIsUniversityPublisher, orgRole } = useAuth();

  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [comment,  setComment]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [bodyEdit, setBodyEdit] = useState('');

  const isHubAdmin = orgIsUniversityPublisher && (orgRole === 'owner' || orgRole === 'admin');

  const load = async () => {
    try { setLoading(true); setData(await fetchPostDetail(id)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`post_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'university_forum_comments', filter: `post_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'university_forum_likes' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (error)   return <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl">{error}</div>;
  if (!data?.post) return null;

  const { post, comments, liked } = data;
  const isAuthor = post.author_user_id === profile?.id;
  const editableUntil = new Date(post.created_at).getTime() + 15 * 60 * 1000;
  const canEdit = isAuthor && Date.now() < editableUntil;

  const onAddComment = async (text, parent_comment_id) => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await postComment({ post_id: post.id, body: text.trim(), parent_comment_id: parent_comment_id || null });
      setComment('');
      await load();
    } finally { setPosting(false); }
  };

  const onDeleteComment = async (cid) => {
    if (!window.confirm('Delete this comment?')) return;
    await deleteComment(cid);
    await load();
  };

  const onSaveEdit = async () => {
    await patchPost(post.id, { body: bodyEdit });
    setEditing(false);
    await load();
  };

  const onDeletePost = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    await deletePost(post.id);
    navigate('/university/feed');
  };

  const onTogglePin = async () => {
    await patchPost(post.id, { is_pinned: !post.is_pinned });
    await load();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/university/feed" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft size={13} /> Feed
        </Link>

        <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <header className="px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 overflow-hidden">
                {post.author_profile?.avatar_url && <img src={post.author_profile.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{displayName(post.author_profile)}</p>
                  {post.is_admin_post && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-orange-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck size={10} /> ADMIN
                    </span>
                  )}
                  {post.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Pin size={10} /> PINNED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {post.author_org?.name || 'LotLine'} · {new Date(post.created_at).toLocaleString()} · {post.category?.name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={() => { setBodyEdit(post.body); setEditing(true); }} className="p-1.5 text-gray-400 hover:text-accent">
                    <Pencil size={13} />
                  </button>
                )}
                {(isAuthor || isHubAdmin) && (
                  <button onClick={onDeletePost} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                )}
                {isHubAdmin && (
                  <button onClick={onTogglePin} className={`p-1.5 ${post.is_pinned ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}>
                    <Pin size={13} />
                  </button>
                )}
              </div>
            </div>
            {post.title && <h1 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h1>}
            {editing
              ? (
                <>
                  <textarea
                    rows={5}
                    value={bodyEdit}
                    onChange={e => setBodyEdit(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                    <button onClick={onSaveEdit} className="text-xs px-3 py-1.5 rounded-xl bg-accent text-white">Save</button>
                  </div>
                </>
              )
              : <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.body}</p>}
            {post.image_urls?.length > 0 && !editing && (
              <div className={`mt-3 grid gap-2 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.image_urls.map((u, i) => (
                  <img key={i} src={u} alt="" className="rounded-xl w-full h-60 object-cover" />
                ))}
              </div>
            )}
          </header>
          <footer className="flex items-center gap-3 px-5 py-3 border-t border-gray-100">
            <LikeButton postId={post.id} count={post.like_count} liked={liked?.post} />
            <span className="text-xs text-gray-500">{post.comment_count} comments</span>
          </footer>
        </article>

        {/* Comment composer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <textarea
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => onAddComment(comment, null)}
              disabled={posting || !comment.trim()}
              className="text-xs px-3 py-1.5 rounded-xl bg-accent text-white disabled:opacity-50"
            >
              {posting ? <Loader2 size={11} className="animate-spin inline mr-1" /> : null}
              Post
            </button>
          </div>
        </div>

        <CommentThread
          comments={comments}
          likedSet={new Set(liked?.comments || [])}
          currentUserId={profile?.id}
          isAdmin={isHubAdmin}
          onReply={onAddComment}
          onDelete={onDeleteComment}
        />
      </div>
    </div>
  );
}
