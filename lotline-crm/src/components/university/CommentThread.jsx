import { useState } from 'react';
import { CornerDownRight, Trash2 } from 'lucide-react';
import LikeButton from './LikeButton';

function displayName(p) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Member';
}

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString();
}

export default function CommentThread({
  comments,
  likedSet,
  currentUserId,
  isAdmin,
  onReply,
  onDelete,
}) {
  // Build tree
  const byParent = {};
  comments.forEach(c => {
    const k = c.parent_comment_id || '__root';
    (byParent[k] ||= []).push(c);
  });

  const renderTree = (list, depth = 0) =>
    list.map(c => (
      <div key={c.id} className={depth === 0 ? '' : 'pl-8 border-l-2 border-gray-100 ml-3'}>
        <CommentRow
          comment={c}
          liked={likedSet?.has(c.id)}
          canDelete={c.author_user_id === currentUserId || isAdmin}
          onReply={onReply}
          onDelete={onDelete}
        />
        {byParent[c.id] && <div className="mt-2">{renderTree(byParent[c.id], depth + 1)}</div>}
      </div>
    ));

  return <div className="space-y-3">{renderTree(byParent.__root || [])}</div>;
}

function CommentRow({ comment, liked, canDelete, onReply, onDelete }) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
        {comment.author_profile?.avatar_url && (
          <img src={comment.author_profile.avatar_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-2xl px-3 py-2">
          <p className="text-xs font-semibold text-gray-800">
            {displayName(comment.author_profile)}
            <span className="font-normal text-gray-400 ml-2">{timeAgo(comment.created_at)}</span>
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{comment.body}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 pl-2">
          <LikeButton commentId={comment.id} count={comment.like_count} liked={liked} />
          <button onClick={() => setShowReply(s => !s)} className="text-xs text-gray-500 hover:text-accent inline-flex items-center gap-1">
            <CornerDownRight size={11} /> Reply
          </button>
          {canDelete && (
            <button onClick={() => onDelete?.(comment.id)} className="text-xs text-gray-400 hover:text-red-500 inline-flex items-center gap-1">
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>
        {showReply && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-accent focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!replyBody.trim()) return;
                await onReply?.(replyBody, comment.id);
                setReplyBody(''); setShowReply(false);
              }}
              className="px-3 py-2 text-xs rounded-xl bg-accent text-white"
            >Send</button>
          </div>
        )}
      </div>
    </div>
  );
}
