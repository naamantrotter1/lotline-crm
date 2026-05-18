import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, MessageCircle, ShieldCheck } from 'lucide-react';
import LikeButton from './LikeButton';
import { postComment } from '../../lib/university';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function displayName(p) {
  if (!p) return 'Member';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Member';
}

function bodyPreview(body) {
  const max = 280;
  if (!body) return '';
  return body.length > max ? body.slice(0, max).trim() + '…' : body;
}

export default function PostCard({ post }) {
  const [showComment, setShowComment] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);

  const isAdmin = !!post.is_admin_post;

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await postComment({ post_id: post.id, body: commentBody.trim() });
      setCommentBody('');
      setShowComment(false);
      setCommentCount(c => c + 1);
    } catch { /* noop */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-sm transition-shadow overflow-hidden">
      {/* Clickable content area → navigates to post detail */}
      <Link to={`/university/feed/post/${post.id}`} className="block px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
            {post.author_profile?.avatar_url
              ? <img src={post.author_profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : displayName(post.author_profile).slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800 truncate">{displayName(post.author_profile)}</p>
              {isAdmin && (
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
              {post.author_org?.name || 'LotLine'} · {timeAgo(post.last_activity_at || post.created_at)} · {post.category?.name}
            </p>
          </div>
        </div>
        {post.title && <p className="text-base font-semibold text-gray-900 mb-1">{post.title}</p>}
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{bodyPreview(post.body)}</p>
        {post.image_urls?.length > 0 && (
          <div className={`mt-3 grid gap-2 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {post.image_urls.slice(0, 4).map((u, i) => (
              <img key={i} src={u} alt="" className="rounded-xl w-full h-40 object-cover" />
            ))}
          </div>
        )}
      </Link>

      {/* Action bar — outside the Link so clicks don't navigate */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3">
          <LikeButton postId={post.id} count={post.like_count} liked={!!post.liked_by_me} />
          <button
            onClick={() => setShowComment(v => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              showComment ? 'text-accent bg-orange-50' : 'text-gray-500 hover:text-accent hover:bg-orange-50/50'
            }`}
          >
            <MessageCircle size={12} /> {commentCount}
          </button>
        </div>

        {showComment && (
          <form onSubmit={handleComment} className="mt-3 flex gap-2">
            <input
              autoFocus
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || submitting}
              className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-xl disabled:opacity-40 hover:bg-accent/90 transition-colors"
            >
              Post
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
