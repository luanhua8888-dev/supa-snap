import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Music, Trash2, MoreHorizontal } from 'lucide-react';
import {
  resolveCaptionBackground,
  resolveCaptionTextStyle,
  getCaptionTextEffectClass,
  needsMarqueeWrapper,
} from '../lib/captionStyles';
import { SnapStickersDisplay } from './SnapStickersDisplay';
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
  stickers_json?: string | null;
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
  userAvatars?: Record<string, string>;
  isFollowing?: boolean;
  onFollowToggle?: (targetUsername: string) => Promise<void>;
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
  userAvatars,
  isFollowing = false,
  onFollowToggle,
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

  if (isDetail) {
    return (
      <motion.div
        initial={skipFeedEntrance ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 120 }}
        className="w-full max-w-sm mx-auto mb-0 bg-white dark:bg-threads-surface rounded-[2.5rem] p-4 shadow-cute dark:shadow-cute-dark border border-slate-100 dark:border-threads-border relative overflow-hidden"
      >
        {/* Dynamic Background Aurora Glow if music is playing */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              exit={{ opacity: 0 }}
              className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-slate-200 via-zinc-450 to-slate-800 blur-3xl pointer-events-none -z-10 ambient-blob"
            />
          )}
        </AnimatePresence>

        {/* User header */}
        <div className="flex items-center justify-between mb-3 px-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-zinc-450 dark:from-zinc-800 dark:to-zinc-200 flex items-center justify-center font-extrabold text-xs text-slate-700 dark:text-zinc-150 font-rounded shadow-sm border border-white/20 overflow-hidden">
              {userAvatars?.[photo.username] ? (
                <img src={userAvatars[photo.username]} alt="" className="w-full h-full object-cover" />
              ) : (
                photo.username.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="font-rounded font-extrabold text-sm text-slate-800 dark:text-zinc-100 leading-tight flex items-center gap-1.5">
                {photo.username}
                {currentUser.toLowerCase() !== photo.username.toLowerCase() && onFollowToggle && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowToggle(photo.username);
                    }}
                    className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                      isFollowing
                        ? 'bg-transparent border-slate-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-550'
                        : 'bg-slate-950 dark:bg-white text-white dark:text-black border-transparent'
                    }`}
                  >
                    {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                  </button>
                )}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">
                {formatTime(photo.created_at)}
              </p>
            </div>
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
                className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 cursor-pointer"
                title="Xóa bài (Admin)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Main media */}
        <div
          onClick={handleImageClick}
          className="relative w-full aspect-square rounded-[2rem] overflow-hidden cursor-pointer select-none bg-slate-50 dark:bg-zinc-800/60 shadow-inner group [container-type:size]"
        >
          {/* Blur-up Placeholder */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-zinc-200 to-slate-100 dark:from-zinc-850 dark:via-zinc-800 dark:to-zinc-850 animate-pulse flex items-center justify-center">
              <span className="text-xs text-slate-400 dark:text-zinc-550 font-rounded font-bold animate-bounce">Loading snap... 🌸</span>
            </div>
          )}

          {isVideoMedia(photo) ? (
            <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
              <DetailVideoPlayer src={photo.image_url} onLoaded={() => setIsLoaded(true)} />
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
          <div className="absolute inset-0 pointer-events-none border border-black/5 dark:border-white/5 rounded-[2rem]" />

          <SnapStickersDisplay json={photo.stickers_json} />

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
                  <img src={photo.song_album_art} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <Music className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </motion.div>

              <div className="flex flex-col min-w-0 pr-1 select-none text-left">
                <span className="text-[10px] font-extrabold text-white leading-tight truncate max-w-[85px]">
                  {photo.song_title}
                </span>
                <span className="text-[8px] text-white/70 font-semibold leading-none truncate max-w-[85px] mt-0.5">
                  {photo.song_artist || 'Unknown'}
                </span>
              </div>
            </div>
          )}

          {/* Double Tap Floating Hearts */}
          <AnimatePresence>
            {floatingReactions.map(r => (
              <motion.div
                key={r.id}
                initial={{ scale: 0, opacity: 0.9, x: r.x, y: r.y, rotate: 0 }}
                animate={
                  r.angle === 0
                    ? {
                        scale: [0, r.scale, r.scale * 0.9, 0],
                        y: r.y - 120,
                        opacity: [0.9, 1, 0.9, 0],
                        rotate: [0, -10, 10, 0]
                      }
                    : {
                        scale: [0, r.scale, 0],
                        x: r.x + Math.sin(r.angle * Math.PI / 180) * 90,
                        y: r.y + Math.cos(r.angle * Math.PI / 180) * -90,
                        opacity: [0.9, 1, 0]
                      }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: r.duration, ease: "easeOut" }}
                className="absolute z-35 pointer-events-none select-none text-3xl drop-shadow-lg"
                style={{ originX: 0.5, originY: 0.5 }}
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Music Floating Notes */}
          <AnimatePresence>
            {floatingNotes.map(note => (
              <motion.div
                key={note.id}
                initial={{ y: '110%', x: `${note.left}%`, opacity: 0, scale: 0.5, rotate: 0 }}
                animate={{
                  y: ['90%', '0%'],
                  x: [`${note.left}%`, `${note.left + (Math.sin(note.left) * 12)}%`],
                  opacity: [0, 0.9, 0.9, 0],
                  scale: [0.6, 1.1, 0.8],
                  rotate: [-15, 15, -10, 10]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: note.duration, ease: 'easeOut' }}
                className="absolute bottom-2 z-30 pointer-events-none select-none text-shadow-glow"
                style={{ fontSize: `${note.size}px` }}
              >
                {note.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Caption pill on media — detail / Locket */}
          {photo.caption &&
            (() => {
              const bgStyle = resolveCaptionBackground(photo.caption_bg_style, photo.caption_bg_color);
              const textStyle = resolveCaptionTextStyle(photo.caption_text_color);
              const fxClass = getCaptionTextEffectClass(photo.caption_text_effect);
              return (
                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[85%] w-auto backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-2xl shadow-lg text-center pointer-events-none select-none"
                  style={bgStyle}
                >
                  <p
                    className={`text-[11px] font-extrabold font-rounded leading-normal break-words ${fxClass} ${
                      needsMarqueeWrapper(photo.caption_text_effect) ? 'caption-fx-marquee block' : ''
                    }`}
                    style={textStyle}
                  >
                    {needsMarqueeWrapper(photo.caption_text_effect) ? (
                      <span className="caption-marquee-wrap block overflow-hidden">
                        {photo.caption}
                      </span>
                    ) : (
                      photo.caption
                    )}
                  </p>
                </div>
              );
            })()}
        </div>

        {/* Reactions */}
        <div className="mt-3.5 px-1.5">
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
                        ? 'bg-slate-100 dark:bg-threads-hover text-slate-900 dark:text-threads-text border-transparent'
                        : 'bg-slate-55 border-slate-100 hover:bg-slate-100 text-slate-600 dark:bg-zinc-800/60 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-450'
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
                className="p-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 dark:bg-zinc-800/60 dark:border-zinc-800 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full flex items-center justify-center transition-colors shadow-sm"
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
                      className="absolute bottom-full left-0 mb-2.5 z-40 backdrop-blur-md rounded-2xl shadow-xl p-2 flex items-center space-x-1.5 bg-white/95 dark:bg-zinc-900/95 border border-slate-100 dark:border-zinc-800"
                    >
                      {emojis.map(emoji => (
                        <motion.button
                          key={emoji}
                          whileHover={{ scale: 1.25, rotate: 10 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="w-8.5 h-8.5 text-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
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
              threadsStyle={false}
              onRequireAuth={onRequireAuth}
              onAddComment={onAddComment}
              onReactComment={onReactComment}
              userAvatars={userAvatars}
            />
          )}
        </div>
      </motion.div>
    );
  } else {
    // variant === 'feed' -> Threads layout style (2 columns)
    return (
      <motion.div
        initial={skipFeedEntrance ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 120 }}
        className="w-full max-w-none mx-0 px-3 sm:px-4 py-4 bg-white dark:bg-threads-bg border-b border-slate-200/30 dark:border-zinc-800/40 relative overflow-hidden"
      >
        {/* Two-Column Feed Item */}
        <div className="flex gap-3 relative z-10">
          
          {/* Left Column: Avatar and Vertical Thread Connection Line */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-threads-elevated flex items-center justify-center text-[11px] font-bold text-slate-650 dark:text-threads-text overflow-hidden relative shadow-sm">
              {userAvatars?.[photo.username] ? (
                <img src={userAvatars[photo.username]} alt="" className="w-full h-full object-cover" />
              ) : (
                photo.username.substring(0, 2).toUpperCase()
              )}
            </div>
            {/* Thread line connecting posts and replies */}
            <div className="w-[1.5px] bg-slate-200/70 dark:bg-zinc-800/60 flex-1 my-1.5 rounded-full min-h-[40px]" />
          </div>

          {/* Right Column: User content, media, interactions */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Row 1: Username & Meta info */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-sm min-w-0 flex-wrap">
                <span className="font-semibold text-slate-900 dark:text-threads-text hover:underline cursor-pointer truncate">
                  {photo.username}
                </span>
                {currentUser.toLowerCase() !== photo.username.toLowerCase() && onFollowToggle && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowToggle(photo.username);
                    }}
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                      isFollowing
                        ? 'bg-transparent border-slate-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-550'
                        : 'bg-slate-950 dark:bg-white text-white dark:text-black border-transparent hover:scale-105'
                    }`}
                  >
                    {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                  </button>
                )}
                <span className="text-slate-400 dark:text-threads-muted text-[13px]">·</span>
                <span className="text-slate-400 dark:text-threads-muted text-[12.5px] font-medium shrink-0">
                  {formatTime(photo.created_at)}
                </span>
              </div>

              {/* Action buttons (Trash & More options) */}
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && onRequestDelete && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(photo.id);
                    }}
                    className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                    title="Xóa bài (Admin)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                )}
                <button
                  type="button"
                  className="p-1.5 rounded-full text-slate-400 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover"
                  aria-label="More"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Row 2: Caption (if any) */}
            {photo.caption && (
              <div className="mb-2.5 max-w-full">
                {needsMarqueeWrapper(photo.caption_text_effect) ? (
                  <div className="caption-marquee-wrap max-w-full overflow-hidden">
                    <p
                      className={`text-[14.5px] leading-snug text-slate-800 dark:text-threads-text ${getCaptionTextEffectClass(photo.caption_text_effect)}`}
                      style={resolveCaptionTextStyle(photo.caption_text_color)}
                    >
                      {photo.caption}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`text-[14.5px] leading-snug text-slate-800 dark:text-threads-text ${getCaptionTextEffectClass(photo.caption_text_effect)}`}
                    style={resolveCaptionTextStyle(photo.caption_text_color)}
                  >
                    {photo.caption}
                  </p>
                )}
              </div>
            )}

            {/* Row 3: Media (Image or Video) */}
            <div
              onClick={isVideoMedia(photo) ? undefined : handleImageClick}
              className="relative w-full aspect-square rounded-xl overflow-hidden cursor-pointer select-none bg-slate-100 dark:bg-threads-surface group [container-type:size]"
            >
              {/* Blur-up Placeholder */}
              {!isLoaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-zinc-150 to-slate-100 dark:from-zinc-850 dark:via-zinc-800 dark:to-zinc-850 animate-pulse flex items-center justify-center">
                  <span className="text-xs text-slate-400 dark:text-zinc-550 font-rounded font-bold animate-bounce">Loading snap... 🌸</span>
                </div>
              )}

              {isVideoMedia(photo) ? (
                <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
                  <SnapVideo
                    src={photo.image_url}
                    autoPlay={autoPlay}
                    onLoaded={() => setIsLoaded(true)}
                    className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-80'}`}
                  />
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
              <div className="absolute inset-0 pointer-events-none border border-black/5 dark:border-white/5 rounded-xl" />

              <SnapStickersDisplay json={photo.stickers_json} />

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
                      <img src={photo.song_album_art} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <Music className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </motion.div>

                  <div className="flex flex-col min-w-0 pr-1 select-none text-left">
                    <span className="text-[10px] font-extrabold text-white leading-tight truncate max-w-[85px]">
                      {photo.song_title}
                    </span>
                    <span className="text-[8px] text-white/70 font-semibold leading-none truncate max-w-[85px] mt-0.5">
                      {photo.song_artist || 'Unknown'}
                    </span>
                  </div>
                </div>
              )}

              {/* Double Tap Heart Burst overlay */}
              <AnimatePresence>
                {floatingReactions.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ scale: 0, opacity: 0.9, x: r.x, y: r.y, rotate: 0 }}
                    animate={
                      r.angle === 0
                        ? {
                            scale: [0, r.scale, r.scale * 0.9, 0],
                            y: r.y - 120,
                            opacity: [0.9, 1, 0.9, 0],
                            rotate: [0, -10, 10, 0]
                          }
                        : {
                            scale: [0, r.scale, 0],
                            x: r.x + Math.sin(r.angle * Math.PI / 180) * 90,
                            y: r.y + Math.cos(r.angle * Math.PI / 180) * -90,
                            opacity: [0.9, 1, 0]
                          }
                    }
                    exit={{ opacity: 0 }}
                    transition={{ duration: r.duration, ease: "easeOut" }}
                    className="absolute z-35 pointer-events-none select-none text-3xl drop-shadow-lg"
                    style={{ originX: 0.5, originY: 0.5 }}
                  >
                    {r.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Music Note Particles overlay */}
              <AnimatePresence>
                {floatingNotes.map(note => (
                  <motion.div
                    key={note.id}
                    initial={{ y: '110%', x: `${note.left}%`, opacity: 0, scale: 0.5, rotate: 0 }}
                    animate={{
                      y: ['90%', '0%'],
                      x: [`${note.left}%`, `${note.left + (Math.sin(note.left) * 12)}%`],
                      opacity: [0, 0.9, 0.9, 0],
                      scale: [0.6, 1.1, 0.8],
                      rotate: [-15, 15, -10, 10]
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: note.duration, ease: 'easeOut' }}
                    className="absolute bottom-2 z-30 pointer-events-none select-none text-shadow-glow"
                    style={{ fontSize: `${note.size}px` }}
                  >
                    {note.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Row 4: Reactions and Comments */}
            <div className="mt-3">
              {/* Interaction icons or Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(reactionData).map(([emoji, data]) => {
                  const hasReacted = userReactedTo(emoji);
                  const userListStr = data.users.join(', ');
                  
                  return (
                    <div key={emoji} className="relative group/pill">
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/90 dark:bg-black/90 text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md z-30 border border-white/10 font-rounded">
                        {userListStr}
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onReact(photo.id, emoji)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-bold font-rounded transition-all duration-300 border ${
                          hasReacted
                            ? 'bg-slate-100 dark:bg-threads-hover text-slate-900 dark:text-threads-text border-transparent'
                            : 'text-slate-600 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover border-transparent'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[11px] font-extrabold">{data.count}</span>
                      </motion.button>
                    </div>
                  );
                })}

                {/* Smile drawer toggle */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-slate-550 dark:text-threads-muted hover:bg-slate-100 dark:hover:bg-threads-hover rounded-full flex items-center justify-center transition-colors"
                    aria-label="Add reaction"
                  >
                    <Smile className="w-4 h-4 text-slate-500 dark:text-zinc-455" />
                  </motion.button>

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
                          className="absolute bottom-full left-0 mb-2.5 z-40 backdrop-blur-md bg-white dark:bg-threads-elevated border border-slate-100 dark:border-threads-border rounded-xl p-2 flex items-center space-x-1.5"
                        >
                          {emojis.map(emoji => (
                            <motion.button
                              key={emoji}
                              whileHover={{ scale: 1.25, rotate: 10 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="w-8.5 h-8.5 text-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
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

              {/* Feed Comment lists */}
              {onAddComment && onRequireAuth && (
                <CommentSection
                  photoId={photo.id}
                  photoAuthor={photo.username}
                  comments={comments}
                  currentUser={currentUser}
                  isLoggedIn={isLoggedIn}
                  defaultExpanded={autoPlay}
                  threadsStyle={true}
                  onRequireAuth={onRequireAuth}
                  onAddComment={onAddComment}
                  onReactComment={onReactComment}
                  userAvatars={userAvatars}
                />
              )}
            </div>

          </div>
        </div>
      </motion.div>
    );
  }
};
