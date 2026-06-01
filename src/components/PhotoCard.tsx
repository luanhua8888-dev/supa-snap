import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Sparkles, Play, Music, Trash2, MoreHorizontal } from 'lucide-react';
import { resolveCaptionBackground, getCaptionTextEffectClass } from '../lib/captionStyles';
import { isVideoMedia } from '../lib/media';
import { isSnapMusicPlaying, playSnapMusic, stopSnapMusic, subscribeSnapMusic } from '../lib/snapMusic';
import { SnapVideo } from './SnapVideo';
import { DetailVideoPlayer } from './DetailVideoPlayer';
import { CommentSection } from './CommentSection';
import type { Comment } from '../types/comment';

// Deezer preview URLs are CORS-enabled — play directly, no proxy needed

interface Reaction {
  id: string;
  username: string;
  emoji: string;
}

export interface PhotoData {
  id: string;
  created_at: string;
  image_url: string;
  caption: string | null;
  username: string;
  reactions: Reaction[];
  user_id?: string;
  song_title?: string | null;
  song_artist?: string | null;
  song_album_art?: string | null;
  song_preview_url?: string | null;
  caption_text_color?: string | null;
  caption_bg_style?: string | null;
  caption_text_effect?: string | null;
  caption_bg_color?: string | null;
  media_type?: string | null;
}

interface PhotoCardProps {
  photo: PhotoData;
  currentUser: string;
  onReact: (photoId: string, emoji: string) => Promise<void>;
  autoPlay?: boolean;
  comments?: Comment[];
  isLoggedIn?: boolean;
  onRequireAuth?: () => void;
  onAddComment?: (photoId: string, body: string) => Promise<void>;
  onReactComment?: (photoId: string, commentId: string, emoji: string) => Promise<void>;
  isAdmin?: boolean;
  onRequestDelete?: (photoId: string) => void;
  /** Skip card's own entrance when parent handles feed cinematic */
  skipFeedEntrance?: boolean;
  /** feed = Threads list; detail = lightbox / Locket card cũ */
  variant?: 'feed' | 'detail';
}

interface FloatingReaction {
  id: number;
  x: number;
  y: number;
  emoji: string;
  angle: number;
  scale: number;
  duration: number;
}

interface FloatingNote {
  id: number;
  left: number;
  emoji: string;
  duration: number;
  size: number;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  currentUser,
  onReact,
  autoPlay = false,
  comments = [],
  isLoggedIn = false,
  onRequireAuth,
  onAddComment,
  onReactComment,
  isAdmin = false,
  onRequestDelete,
  skipFeedEntrance = false,
  variant = 'feed',
}) => {
  const isDetail = variant === 'detail';
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Music State
  const [isPlaying, setIsPlaying] = useState(false);
  const [floatingNotes, setFloatingNotes] = useState<FloatingNote[]>([]);
  const [musicError, setMusicError] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);

  // Group reactions by emoji for rendering counts, and keep lists of users
  const reactionData = photo.reactions.reduce((acc, curr) => {
    if (!acc[curr.emoji]) {
      acc[curr.emoji] = { count: 0, users: [] };
    }
    acc[curr.emoji].count += 1;
    if (!acc[curr.emoji].users.includes(curr.username)) {
      acc[curr.emoji].users.push(curr.username);
    }
    return acc;
  }, {} as Record<string, { count: number; users: string[] }>);

  // Check if current user has reacted with a specific emoji
  const userReactedTo = (emoji: string) => {
    return photo.reactions.some(r => r.username === currentUser && r.emoji === emoji);
  };

  useEffect(() => {
    setMusicError(false);
    return subscribeSnapMusic(setIsPlaying);
  }, []);

  useEffect(() => {
    setMusicError(false);
    setIsPlaying(false);
  }, [photo.id]);

  const handleMusicToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (musicLoading || !photo.song_title) return;

    if (isSnapMusicPlaying()) {
      stopSnapMusic();
      setMusicError(false);
      return;
    }

    setMusicLoading(true);
    setMusicError(false);
    void playSnapMusic(photo.song_preview_url, photo.song_title, photo.song_artist).then((ok) => {
      setMusicLoading(false);
      setMusicError(!ok);
    });
  };

  // Spawns floating music notes when song is playing
  useEffect(() => {
    if (!isPlaying) {
      setFloatingNotes([]);
      return;
    }

    const noteEmojis = ['🎵', '🎶', '✨', '💕', '🌸', '💫'];
    const interval = setInterval(() => {
      const newNote = {
        id: Date.now() + Math.random(),
        left: 10 + Math.random() * 80, // 10% to 90%
        emoji: noteEmojis[Math.floor(Math.random() * noteEmojis.length)],
        duration: 1.8 + Math.random() * 0.8,
        size: 14 + Math.random() * 12
      };
      setFloatingNotes(prev => [...prev, newNote]);

      // Remove after animation completes
      setTimeout(() => {
        setFloatingNotes(prev => prev.filter(n => n.id !== newNote.id));
      }, 2600);
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    if (timeDiff < 300) {
      // Double tap detected!
      handleDoubleTap(e);
    }
    setLastClickTime(currentTime);
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const emoji = '❤️';
    
    // Spawn a burst of heart particles!
    const newParticles: FloatingReaction[] = [];
    const mainId = Date.now();
    
    // 1. The Main Heart (big, floats straight up)
    newParticles.push({
      id: mainId,
      x,
      y,
      emoji,
      angle: 0,
      scale: 1.8,
      duration: 0.9
    });
    
    // 2. Side mini-hearts / sparkles (fly outwards)
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i * (360 / particleCount)) + (Math.random() * 20 - 10);
      newParticles.push({
        id: mainId + i + 1,
        x,
        y,
        emoji: Math.random() > 0.4 ? '❤️' : Math.random() > 0.5 ? '✨' : '💖',
        angle,
        scale: 0.7 + Math.random() * 0.5,
        duration: 0.6 + Math.random() * 0.4
      });
    }

    setFloatingReactions(prev => [...prev, ...newParticles]);
    
    // Cleanup particles
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id < mainId || r.id > mainId + particleCount));
    }, 1200);

    onReact(photo.id, emoji);
  };

  const handleEmojiSelect = (emoji: string) => {
    onReact(photo.id, emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMins < 1) return 'Just now ⚡';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const emojis = ['❤️', '✨', '🔥', '😂', '😮', '😭'];

  return (
    <motion.div
      initial={skipFeedEntrance ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', damping: 22, stiffness: 120 }}
      className={
        isDetail
          ? 'w-full max-w-sm mx-auto mb-0 bg-white dark:bg-brand-light rounded-[2.5rem] p-4 shadow-cute dark:shadow-cute-dark border border-pink-100/30 dark:border-brand-muted/50 relative overflow-hidden'
          : 'w-full max-w-none mx-0 px-3 sm:px-4 py-4 bg-white dark:bg-threads-bg border-b border-rose-100/30 dark:border-threads-border relative overflow-hidden'
      }
    >
      {/* Dynamic Background Aurora Glow if music is playing */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.12 }}
            exit={{ opacity: 0 }}
            className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-pink-400 via-rose-300 to-indigo-300 blur-3xl pointer-events-none -z-10 ambient-blob"
          />
        )}
      </AnimatePresence>

      {/* User header */}
      <div className={`flex items-center justify-between ${isDetail ? 'mb-3 px-1.5' : 'mb-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={
              isDetail
                ? 'w-9 h-9 rounded-full bg-gradient-to-tr from-pink-300 to-rose-200 dark:from-pink-600 dark:to-purple-500 flex items-center justify-center font-extrabold text-xs text-slate-700 dark:text-pink-100 font-rounded shadow-sm border border-white/20'
                : 'w-9 h-9 shrink-0 rounded-full bg-slate-200 dark:bg-threads-elevated flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-threads-text'
            }
          >
            {photo.username.substring(0, 2).toUpperCase()}
          </div>
          {isDetail ? (
            <div>
              <h3 className="font-rounded font-extrabold text-sm text-slate-800 dark:text-pink-100 leading-tight">
                {photo.username}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                {formatTime(photo.created_at)}
              </p>
            </div>
          ) : (
            <div className="min-w-0 flex items-center gap-1 text-sm">
              <h3 className="font-semibold text-slate-900 dark:text-threads-text truncate">{photo.username}</h3>
              <span className="text-slate-400 dark:text-threads-muted">·</span>
              <span className="text-slate-400 dark:text-threads-muted text-[13px] shrink-0">
                {formatTime(photo.created_at)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && onRequestDelete && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(photo.id);
              }}
              className={
                isDetail
                  ? 'p-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 cursor-pointer'
                  : 'p-2 rounded-full text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-threads-hover cursor-pointer'
              }
              title="Xóa bài (Admin)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
          )}
          {isDetail ? (
            <div className="p-1.5 bg-rose-50 dark:bg-zinc-850 rounded-xl border border-rose-100/30 dark:border-zinc-800">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 dark:text-pink-300" />
            </div>
          ) : (
            <button
              type="button"
              className="p-2 rounded-full text-slate-400 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover"
              aria-label="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Caption above media — feed / Threads only */}
      {!isDetail && photo.caption && (
        <p
          className={`text-[15px] leading-snug text-slate-800 dark:text-threads-text mb-2.5 pl-[2.75rem] ${getCaptionTextEffectClass(photo.caption_text_effect)}`}
          style={{ color: photo.caption_text_color || undefined }}
        >
          {photo.caption}
        </p>
      )}

      {/* Main media */}
      <div
        onClick={isVideoMedia(photo) ? undefined : handleImageClick}
        className={
          isDetail
            ? 'relative w-full aspect-square rounded-[2rem] overflow-hidden cursor-pointer select-none bg-slate-50 dark:bg-zinc-800/60 shadow-inner group'
            : 'relative w-full aspect-square rounded-xl overflow-hidden cursor-pointer select-none bg-slate-100 dark:bg-threads-surface group ml-[2.75rem] max-w-[calc(100%-2.75rem)]'
        }
      >
        {/* Blur-up Placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-pink-100 via-purple-50 to-pink-50 dark:from-zinc-850 dark:via-zinc-800 dark:to-zinc-850 animate-pulse flex items-center justify-center">
            <span className="text-xs text-pink-300 dark:text-zinc-500 font-rounded font-bold animate-bounce">Loading snap... 🌸</span>
          </div>
        )}

        {isVideoMedia(photo) ? (
          <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
            {isDetail ? (
              <DetailVideoPlayer src={photo.image_url} onLoaded={() => setIsLoaded(true)} />
            ) : (
              <SnapVideo
                src={photo.image_url}
                autoPlay={autoPlay}
                onLoaded={() => setIsLoaded(true)}
                className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-80'}`}
              />
            )}
          </div>
        ) : (
          <img
            src={photo.image_url}
            alt={photo.caption || 'Snap'}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-103 ${
              isLoaded ? 'blur-0 scale-100' : 'blur-xl scale-105'
            }`}
          />
        )}

        {/* Inner shadow overlay */}
        <div
          className={`absolute inset-0 pointer-events-none border border-black/5 dark:border-white/5 ${
            isDetail ? 'rounded-[2rem]' : 'rounded-xl'
          }`}
        />

        {/* Floating Sound Widget overlay (Spotify style) */}
        {photo.song_title && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleMusicToggle}
            onKeyDown={(e) => e.key === 'Enter' && handleMusicToggle(e as unknown as React.MouseEvent)}
            className={`absolute top-4 left-4 z-50 flex items-center space-x-2 bg-black/60 backdrop-blur-lg border px-3 py-2 rounded-full hover:bg-black/75 transition-all duration-300 active:scale-95 shadow-md cursor-pointer pointer-events-auto touch-manipulation ${
              musicError ? 'border-rose-400/60' : 'border-white/15 hover:border-white/25'
            }`}
          >
            {/* Spinning Album Art */}
            <motion.div
              animate={isPlaying ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
              className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm"
            >
              {photo.song_album_art ? (
                <img src={photo.song_album_art} alt="album art" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-pink-300 flex items-center justify-center">
                  <Music className="w-4 h-4 text-white" />
                </div>
              )}
              {/* Vinyl center pin point */}
              <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-black rounded-full border border-white/30" />
            </motion.div>

            {/* Track Info */}
            <div className="flex flex-col text-left max-w-[110px] select-none pr-1">
              <span className="text-[10px] font-extrabold text-white leading-tight font-rounded truncate">
                {photo.song_title}
              </span>
              <span className="text-[8px] text-white/70 font-semibold leading-none truncate mt-0.5">
                {photo.song_artist}
              </span>
            </div>

            {/* Sound indicator / Visualizer */}
            <div className="flex items-center space-x-0.5 h-3.5 pl-2 border-l border-white/20 min-w-[18px] justify-center">
              {musicLoading ? (
                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <div className="flex items-end space-x-[2.5px] h-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-[2px] bg-pink-300 rounded-full visualizer-bar"
                      style={{
                        height: '100%',
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: `${0.6 + i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Play className={`w-2.5 h-2.5 fill-white ${musicError ? 'text-rose-300' : 'text-white'}`} />
              )}
            </div>
          </div>
        )}

        {/* Floating double-tap reaction animations */}
        <AnimatePresence>
          {floatingReactions.map(fr => {
            const rad = (fr.angle * Math.PI) / 180;
            const distance = fr.angle === 0 ? 110 : 65 + Math.random() * 25;
            const tx = Math.sin(rad) * distance;
            const ty = -Math.cos(rad) * distance;
            
            return (
              <motion.span
                key={fr.id}
                initial={{ scale: 0, opacity: 0, x: fr.x - 20, y: fr.y - 20 }}
                animate={{
                  scale: [0, fr.scale, fr.scale * 0.8, 0],
                  opacity: [0, 1, 1, 0],
                  x: fr.x - 20 + tx,
                  y: fr.y - 20 + ty,
                  rotate: [0, (fr.angle % 2 === 0 ? 15 : -15) + (Math.random() * 20 - 10)]
                }}
                transition={{ duration: fr.duration, ease: 'easeOut' }}
                className="absolute pointer-events-none text-3xl select-none z-20 drop-shadow-[0_4px_10px_rgba(255,77,109,0.5)]"
              >
                {fr.emoji}
              </motion.span>
            );
          })}
        </AnimatePresence>

        {/* Floating Music Notes Particle System */}
        <AnimatePresence>
          {floatingNotes.map(n => (
            <motion.span
              key={n.id}
              initial={{ opacity: 0, y: 350, x: `${n.left}%`, scale: 0.4 }}
              animate={{
                opacity: [0, 0.9, 0.9, 0],
                y: [330, 180, 50],
                x: [
                  `${n.left}%`, 
                  `${n.left + (Math.random() > 0.5 ? 12 : -12)}%`, 
                  `${n.left + (Math.random() > 0.5 ? -4 : 4)}%`
                ],
                scale: [0.5, 1.2, 0.8]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: n.duration, ease: 'easeOut' }}
              className="absolute pointer-events-none z-20 select-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.4)]"
              style={{ fontSize: `${n.size}px` }}
            >
              {n.emoji}
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Caption pill on media — detail / Locket */}
        {isDetail &&
          photo.caption &&
          (() => {
            const bgStyle: React.CSSProperties = {
              ...resolveCaptionBackground(photo.caption_bg_style, photo.caption_bg_color),
              color: photo.caption_text_color || '#ffffff',
            };
            const fxClass = getCaptionTextEffectClass(photo.caption_text_effect);
            return (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[85%] w-auto backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-2xl shadow-lg text-center pointer-events-none select-none"
                style={bgStyle}
              >
                <p className={`text-[11px] font-extrabold font-rounded leading-normal break-words ${fxClass}`}>
                  {photo.caption}
                </p>
              </div>
            );
          })()}
      </div>

      {/* Reactions */}
      <div className={isDetail ? 'mt-3.5 px-1.5' : 'mt-3 pl-[2.75rem]'}>
        {/* Reaction Pill Container */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(reactionData).map(([emoji, data]) => {
            const hasReacted = userReactedTo(emoji);
            const userListStr = data.users.join(', ');
            
            return (
              <div key={emoji} className="relative group/pill">
                {/* Tooltip listing users */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/90 dark:bg-black/90 text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md z-30 border border-white/10 font-rounded">
                  {userListStr}
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onReact(photo.id, emoji)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-bold font-rounded transition-all duration-300 border ${
                    hasReacted
                      ? isDetail
                        ? 'bg-pink-100/70 border-pink-200 text-pink-600 dark:bg-pink-950/40 dark:border-pink-900/70 dark:text-pink-200 shadow-sm'
                        : 'bg-pink-100/80 text-pink-600 dark:bg-threads-hover dark:text-threads-text border-transparent'
                      : isDetail
                        ? 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-600 dark:bg-zinc-800/60 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-400'
                        : 'text-slate-600 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover border-transparent'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px] font-extrabold">{data.count}</span>
                </motion.button>
              </div>
            );
          })}

          {/* Emoji Drawer Toggle Button */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={
                isDetail
                  ? 'p-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 dark:bg-zinc-800/60 dark:border-zinc-800 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full flex items-center justify-center transition-colors shadow-sm'
                  : 'p-2 text-slate-500 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover rounded-full flex items-center justify-center transition-colors'
              }
              aria-label="Add reaction"
            >
              <Smile className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            </motion.button>

            {/* Quick Emoji Picker Drawer */}
            <AnimatePresence>
              {showEmojiPicker && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowEmojiPicker(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.88, y: 12 }}
                    transition={{ type: "spring", damping: 18, stiffness: 220 }}
                    className={`absolute bottom-full left-0 mb-2.5 z-40 backdrop-blur-md rounded-2xl shadow-xl p-2 flex items-center space-x-1.5 ${
                      isDetail
                        ? 'bg-white/95 dark:bg-zinc-900/95 border border-pink-100/60 dark:border-zinc-800'
                        : 'bg-white dark:bg-threads-elevated border border-rose-100/60 dark:border-threads-border rounded-xl'
                    }`}
                  >
                    {emojis.map(emoji => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.25, rotate: 10 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-8.5 h-8.5 text-xl flex items-center justify-center hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-xl transition-colors cursor-pointer"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {onAddComment && onRequireAuth && (
          <CommentSection
            photoId={photo.id}
            photoAuthor={photo.username}
            comments={comments}
            currentUser={currentUser}
            isLoggedIn={isLoggedIn}
            defaultExpanded={autoPlay}
            threadsStyle={!isDetail}
            onRequireAuth={onRequireAuth}
            onAddComment={onAddComment}
            onReactComment={onReactComment}
          />
        )}
      </div>
    </motion.div>
  );
};
