import { Heart } from 'lucide-react';
import { useState } from 'react';
import { toggleLike } from '../../lib/university';

export default function LikeButton({ postId, commentId, count, liked: initialLiked, onChange }) {
  const [liked, setLiked] = useState(!!initialLiked);
  const [n, setN]         = useState(count || 0);
  const [busy, setBusy]   = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const optimistic = !liked;
    setLiked(optimistic);
    setN(prev => prev + (optimistic ? 1 : -1));
    try {
      await toggleLike({ post_id: postId, comment_id: commentId, liked });
      onChange?.(optimistic);
    } catch {
      // rollback
      setLiked(liked);
      setN(prev => prev + (liked ? 1 : -1));
    } finally { setBusy(false); }
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
        liked ? 'text-rose-500 bg-rose-50' : 'text-gray-500 hover:text-rose-500 hover:bg-rose-50/50'
      }`}
    >
      <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
      <span>{n}</span>
    </button>
  );
}
