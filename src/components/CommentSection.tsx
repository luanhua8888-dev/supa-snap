import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send } from 'lucide-react';
import type { Comment } from '../types/comment';

const COMMENT_EMOJIS = ['❤️', '✨', '🔥', '😂', '👏', '😮'];

interface CommentSectionProps {
  photoId: string;
  photoAuthor: string;
  comments: Comment[];
  currentUser: string;
  isLoggedIn: boolean;
  defaultExpanded?: boolean;
  onRequireAuth: () => void;
  onAddComment: (photoId: string, body: string) => Promise<void>;
  onReactComment?: (photoId: string, commentId: string, emoji: string) => Promise<void>;
}

function formatCommentTime(isoString: string) {
  try {
    const diffMins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (diffMins < 1) return 'vừa xong';
    if (diffMins < 60) return `${diffMins} phút`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} giờ`;
    return new Date(isoString).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function CommentSection({
  photoId,
  photoAuthor,
  comments,
  currentUser,
  isLoggedIn,
  defaultExpanded = false,
  onRequireAuth,
  onAddComment,
  onReactComment,
}: CommentSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const count = comments.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    setIsSending(true);
    try {
      await onAddComment(photoId, body);
      setText('');
      setExpanded(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleReact = (commentId: string, emoji: string) => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    onReactComment?.(photoId, commentId, emoji);
  };

  return (
    <div className="mt-3 border-t border-pink-100/40 dark:border-zinc-800/80 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-1 cursor-pointer group"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold font-rounded text-slate-500 dark:text-zinc-400 group-hover:text-pink-500 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          Bình luận {count > 0 && `(${count})`}
        </span>
        <span className="text-[10px] text-zinc-400 font-bold">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3 max-h-52 overflow-y-auto no-scrollbar">
              {count === 0 ? (
                <p className="text-[10px] text-zinc-400 text-center py-2">
                  Hãy bình luận snap của {photoAuthor}!
                </p>
              ) : (
                comments.map((c) => {
                  const reactions = c.reactions || [];
                  const grouped = reactions.reduce(
                    (acc, r) => {
                      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
                      acc[r.emoji].count += 1;
                      if (r.username === currentUser) acc[r.emoji].mine = true;
                      return acc;
                    },
                    {} as Record<string, { count: number; mine: boolean }>
                  );

                  return (
                    <div
                      key={c.id}
                      className={`flex gap-2 ${c.username === currentUser ? 'flex-row-reverse' : ''}`}
                    >
                      <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-extrabold border border-slate-200/50 dark:border-zinc-700">
                        {c.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 max-w-[88%]">
                        <div
                          className={`rounded-2xl px-3 py-2 border ${
                            c.username === currentUser
                              ? 'bg-pink-500/10 border-pink-200/40 dark:border-pink-800/40'
                              : 'bg-slate-50 border-slate-100 dark:bg-zinc-800/60 dark:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold text-pink-600 dark:text-pink-300">
                              {c.username}
                            </span>
                            <span className="text-[9px] text-zinc-400">
                              {formatCommentTime(c.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-zinc-200 mt-0.5 break-words">
                            {c.body}
                          </p>
                        </div>
                        {onReactComment && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(grouped).map(([emoji, data]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(c.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                                  data.mine
                                    ? 'bg-pink-100 border-pink-200 text-pink-600 dark:bg-pink-950/40 dark:border-pink-800 dark:text-pink-300'
                                    : 'bg-white/80 border-slate-100 text-slate-500 dark:bg-zinc-900 dark:border-zinc-800'
                                }`}
                              >
                                {emoji} {data.count}
                              </button>
                            ))}
                            {COMMENT_EMOJIS.filter((e) => !grouped[e]).slice(0, 3).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(c.id, emoji)}
                                className="w-7 h-7 rounded-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 hover:scale-110 transition-transform cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-2.5 flex gap-2 items-end">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                placeholder={isLoggedIn ? `Bình luận ${photoAuthor}...` : 'Đăng nhập để bình luận'}
                disabled={!isLoggedIn || isSending}
                className="flex-1 px-3.5 py-2.5 rounded-2xl text-[11px] font-semibold font-rounded bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-pink-400/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!text.trim() || isSending || !isLoggedIn}
                className="w-10 h-10 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-400 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
