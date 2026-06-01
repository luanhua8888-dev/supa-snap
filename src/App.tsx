import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Compass, History, LogIn, Sun, Moon, LayoutGrid, List, X, Search } from 'lucide-react';
import { isAdminUser } from './lib/admin';
import { supabase } from './lib/supabase';
import { Header } from './components/Header';
import { PhotoCard } from './components/PhotoCard';
import type { PhotoData } from './components/PhotoCard';
import type { Comment } from './types/comment';
import { CameraOverlay } from './components/CameraOverlay';
import { GalleryThumb } from './components/GalleryThumb';
import {
  extensionForUpload,
  contentTypeForUpload,
  ensureBlobMime,
  isStorageMimeError,
  type MediaType,
} from './lib/media';
import { AuthModal } from './components/AuthModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import {
  CinematicFeedLoader,
  FeedEntranceCell,
  FeedEntranceGrid,
  FeedEntranceList,
  FeedEntranceListItem,
  useFeedEntrance,
} from './components/FeedEntrance';
import { playSnapMusic, stopSnapMusic } from './lib/snapMusic';
import { blobFingerprint, isDuplicateUpload, markUploadPosted } from './lib/uploadDedup';

export default function App() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  
  // Navigation & Flow
  const [activeTab, setActiveTab] = useState<'feed' | 'history'>('feed');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [galleryUserFilter, setGalleryUserFilter] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // App Feed
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, Comment[]>>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [feedLoadTick, setFeedLoadTick] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const { play: playFeedEntrance, variant: entranceVariant } = useFeedEntrance(
    photos.length,
    !isLoadingFeed,
    feedLoadTick
  );

  // Phát nhạc khi mở chi tiết snap (ảnh & video)
  useEffect(() => {
    if (!selectedPhoto?.song_title) {
      stopSnapMusic();
      return;
    }
    const { song_preview_url, song_title, song_artist } = selectedPhoto;
    const timer = window.setTimeout(() => {
      void playSnapMusic(song_preview_url, song_title, song_artist);
    }, 450);
    return () => {
      clearTimeout(timer);
      stopSnapMusic();
    };
  }, [selectedPhoto?.id, selectedPhoto?.song_title, selectedPhoto?.song_preview_url, selectedPhoto?.song_artist]);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('supasnap_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
    
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, []);

  // Listen to Supabase Auth changes
  useEffect(() => {
    const loadProfile = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      setSessionUser(user);
      const metaName =
        (user.user_metadata?.nickname as string) ||
        (user.user_metadata?.username as string) ||
        user.email?.split('@')[0] ||
        'Friend';
      setNickname(metaName);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, username')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.username) setNickname(profile.username);
      setIsAdmin(isAdminUser(user, profile?.is_admin));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setSessionUser(null);
        setNickname(null);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch photos and subscribe to Realtime changes
  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel('realtime-photos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        (payload) => {
          console.log('Realtime change received:', payload);
          if (payload.eventType === 'INSERT') {
            const newPhoto = payload.new as PhotoData;
            setPhotos((prev) => [newPhoto, ...prev]);
            
            if (sessionUser && newPhoto.user_id !== sessionUser.id) {
              showToast(`New snap from ${newPhoto.username}! 📸✨`, 'info');
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPhoto = payload.new as PhotoData;
            setPhotos((prev) =>
              prev.map((photo) => (photo.id === updatedPhoto.id ? updatedPhoto : photo))
            );
            
            setSelectedPhoto((prev) => {
              if (prev && prev.id === updatedPhoto.id) {
                return updatedPhoto;
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedPhoto = payload.old as { id: string };
            setPhotos((prev) => prev.filter((photo) => photo.id !== deletedPhoto.id));
            setSelectedPhoto((prev) => {
              if (prev && prev.id === deletedPhoto.id) {
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('realtime-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          const comment = payload.new as Comment;
          setCommentsByPhoto((prev) => {
            const existing = prev[comment.photo_id] || [];
            if (existing.some((c) => c.id === comment.id)) return prev;
            return {
              ...prev,
              [comment.photo_id]: [...existing, comment],
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments' },
        (payload) => {
          const updated = payload.new as Comment;
          setCommentsByPhoto((prev) => ({
            ...prev,
            [updated.photo_id]: (prev[updated.photo_id] || []).map((c) =>
              c.id === updated.id ? updated : c
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(commentsChannel);
    };
  }, [sessionUser, nickname]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Comments not loaded (run supabase_schema.sql):', error.message);
        return;
      }

      const grouped: Record<string, Comment[]> = {};
      for (const comment of data || []) {
        if (!grouped[comment.photo_id]) grouped[comment.photo_id] = [];
        grouped[comment.photo_id].push({
          ...comment,
          reactions: comment.reactions || [],
        });
      }
      setCommentsByPhoto(grouped);
    } catch (err) {
      console.warn('fetchComments error:', err);
    }
  };

  const fetchPhotos = async () => {
    setIsLoadingFeed(true);
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setPhotos(data || []);
      await fetchComments();
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      showToast('Could not load snaps. Check your database tables! 🌸', 'error');
    } finally {
      setIsLoadingFeed(false);
      setFeedLoadTick((t) => t + 1);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleToggleDark = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem('supasnap_theme', nextDark ? 'dark' : 'light');
    if (nextDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const handleAuthSuccess = (userNickname: string) => {
    setIsAuthModalOpen(false);
    showToast(`Logged in as ${userNickname}! 💕`, 'success');
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showToast('See you again! 🌸', 'info');
      setActiveTab('feed');
    } catch (err: any) {
      showToast(err.message || 'Error logging out.', 'error');
    }
  };

  const handleRequireAuth = () => {
    setIsAuthModalOpen(true);
    showToast('Đăng nhập để bình luận! 💬', 'info');
  };

  const handleAddComment = async (photoId: string, body: string) => {
    if (!sessionUser || !nickname) {
      handleRequireAuth();
      return;
    }

    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      photo_id: photoId,
      user_id: sessionUser.id,
      username: nickname,
      body,
      created_at: new Date().toISOString(),
    };

    setCommentsByPhoto((prev) => ({
      ...prev,
      [photoId]: [...(prev[photoId] || []), optimistic],
    }));

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          photo_id: photoId,
          user_id: sessionUser.id,
          username: nickname,
          body,
        })
        .select()
        .single();

      if (error) throw error;

      setCommentsByPhoto((prev) => {
        const list = (prev[photoId] || []).filter((c) => c.id !== optimistic.id);
        if (list.some((c) => c.id === data.id)) {
          return { ...prev, [photoId]: list };
        }
        return { ...prev, [photoId]: [...list, data] };
      });

      const photo = photos.find((p) => p.id === photoId);
      if (photo && photo.user_id !== sessionUser.id) {
        showToast(`Đã bình luận snap của ${photo.username}! 💬`, 'success');
      }
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setCommentsByPhoto((prev) => ({
        ...prev,
        [photoId]: (prev[photoId] || []).filter((c) => c.id !== optimistic.id),
      }));
      if (err?.message?.includes('comments')) {
        showToast('Chạy migration SQL bảng comments trong Supabase trước nhé!', 'error');
      } else {
        showToast(err.message || 'Không gửi được bình luận 🥺', 'error');
      }
    }
  };

  const handleReactComment = async (photoId: string, commentId: string, emoji: string) => {
    if (!sessionUser || !nickname) {
      handleRequireAuth();
      return;
    }

    const comment = (commentsByPhoto[photoId] || []).find((c) => c.id === commentId);
    if (!comment) return;

    let reactions = [...(comment.reactions || [])];
    const existingIndex = reactions.findIndex(
      (r) => r.username === nickname && r.emoji === emoji
    );
    if (existingIndex > -1) reactions.splice(existingIndex, 1);
    else {
      reactions.push({
        id: Date.now().toString() + Math.random(),
        username: nickname,
        emoji,
      });
    }

    setCommentsByPhoto((prev) => ({
      ...prev,
      [photoId]: (prev[photoId] || []).map((c) =>
        c.id === commentId ? { ...c, reactions } : c
      ),
    }));

    try {
      const { error } = await supabase
        .from('comments')
        .update({ reactions })
        .eq('id', commentId);
      if (error) throw error;
    } catch (err) {
      console.error('Comment reaction error:', err);
      showToast('Không sync được reaction bình luận 🥺', 'error');
    }
  };

  const storagePathFromUrl = (url: string) => {
    const marker = '/photos/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!isAdmin) {
      showToast('Chỉ admin mới xóa được bài.', 'error');
      return;
    }

    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    setIsDeletingPhoto(true);
    try {
      const path = storagePathFromUrl(photo.image_url);
      if (path) {
        const { error: storageErr } = await supabase.storage.from('photos').remove([path]);
        if (storageErr) console.warn('Storage delete:', storageErr.message);
      }

      const { error } = await supabase.from('photos').delete().eq('id', photoId);
      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setSelectedPhoto((prev) => (prev?.id === photoId ? null : prev));
      setCommentsByPhoto((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setPhotoToDelete(null);
      showToast('Đã xóa snap 🗑️', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi xóa bài';
      showToast(message, 'error');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleReact = async (photoId: string, emoji: string) => {
    if (!sessionUser) {
      setIsAuthModalOpen(true);
      showToast('Please log in to leave reactions! 💖', 'info');
      return;
    }

    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    let updatedReactions = [...photo.reactions];
    const existingIndex = updatedReactions.findIndex(
      (r) => r.username === nickname && r.emoji === emoji
    );

    if (existingIndex > -1) {
      updatedReactions.splice(existingIndex, 1);
    } else {
      updatedReactions.push({
        id: Date.now().toString() + Math.random().toString(),
        username: nickname || 'anonymous',
        emoji,
      });
    }

    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, reactions: updatedReactions } : p))
    );

    setSelectedPhoto((prev) => {
      if (prev && prev.id === photoId) {
        return { ...prev, reactions: updatedReactions };
      }
      return prev;
    });

    try {
      const { error } = await supabase
        .from('photos')
        .update({ reactions: updatedReactions })
        .eq('id', photoId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating reaction:', err);
      fetchPhotos();
      showToast('Failed to sync reaction. 🥺', 'error');
    }
  };

  const handlePhotoUpload = async (
    blob: Blob,
    caption: string,
    mediaType: MediaType,
    songTitle?: string | null,
    songArtist?: string | null,
    songAlbumArt?: string | null,
    songPreviewUrl?: string | null,
    captionTextColor?: string | null,
    captionBgStyle?: string | null,
    captionTextEffect?: string | null,
    captionBgColor?: string | null,
    stickersJson?: string | null
  ) => {
    if (!sessionUser) {
      showToast('Log in first to upload snaps! 🌸', 'error');
      setIsCameraOpen(false);
      setIsAuthModalOpen(true);
      return;
    }

    if (isUploading) return;

    const uploadBlob = ensureBlobMime(blob, mediaType);

    const fingerprint = await blobFingerprint(uploadBlob);
    if (isDuplicateUpload(fingerprint)) {
      showToast('Snap này vừa đăng rồi — không đăng trùng.', 'info');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = extensionForUpload(uploadBlob, mediaType);
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 10000)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, uploadBlob, {
          contentType: contentTypeForUpload(uploadBlob, mediaType),
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const row: Record<string, unknown> = {
        image_url: publicUrl,
        caption: caption || null,
        username: nickname,
        reactions: [],
        user_id: sessionUser.id,
        media_type: mediaType,
      };
      if (songTitle) row.song_title = songTitle;
      if (songArtist) row.song_artist = songArtist;
      if (songAlbumArt) row.song_album_art = songAlbumArt;
      if (songPreviewUrl) row.song_preview_url = songPreviewUrl;
      if (captionTextColor) row.caption_text_color = captionTextColor;
      if (captionBgStyle) row.caption_bg_style = captionBgStyle;
      if (captionTextEffect) row.caption_text_effect = captionTextEffect;
      if (captionBgColor) row.caption_bg_color = captionBgColor;
      if (stickersJson) row.stickers_json = stickersJson;

      const { error: insertError } = await supabase.from('photos').insert([row]);

      if (insertError) {
        if (/column/i.test(insertError.message)) {
          const { error: fallbackErr } = await supabase.from('photos').insert([
            {
              image_url: publicUrl,
              caption: caption || null,
              username: nickname,
              reactions: [],
              user_id: sessionUser.id,
            },
          ]);
          if (fallbackErr) throw fallbackErr;
          showToast('Snap posted! Chạy SQL schema để bật nhạc & style.', 'info');
        } else {
          throw insertError;
        }
      }

      markUploadPosted(fingerprint);
      showToast('Snap shared successfully! 🚀✨', 'success');
      setIsCameraOpen(false);
      await fetchPhotos();
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      const msg = err?.message || '';
      if (isStorageMimeError(msg)) {
        showToast(
          'Bucket chưa cho phép video. Vào Supabase → Storage → photos → cho phép video/mp4 & video/webm, hoặc chạy SQL trong supabase_schema.sql',
          'error'
        );
      } else {
        showToast(msg || 'Error uploading snap! 🥺 Please try again.', 'error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraTrigger = () => {
    if (!sessionUser) {
      setIsAuthModalOpen(true);
      showToast('Log in to take and share snaps! 📸💕', 'info');
    } else {
      setIsCameraOpen(true);
    }
  };

  const isLive = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      return diff < 45 * 60000; // Live if within 45 minutes
    } catch {
      return false;
    }
  };

  const userPhotos = sessionUser 
    ? photos.filter(p => p.user_id === sessionUser.id)
    : [];

  const galleryUsernames = useMemo(
    () => [...new Set(photos.map((p) => p.username).filter(Boolean))].sort(),
    [photos]
  );

  const feedPhotos = useMemo(() => {
    let list = photos;
    if (galleryUserFilter) {
      list = list.filter((p) => p.username === galleryUserFilter);
    }
    const q = friendSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.username.toLowerCase().includes(q));
    }
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = p.image_url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [photos, galleryUserFilter, friendSearch]);

  return (
    <div className="min-h-screen w-full bg-[#f4eff2] dark:bg-threads-bg text-slate-800 dark:text-threads-text flex items-center justify-center p-0 sm:p-4 md:p-6 transition-colors duration-500 relative overflow-hidden font-sans">
      <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-pink-500/10 to-indigo-500/5 blur-[130px] pointer-events-none ambient-blob dark:opacity-0" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-500/10 to-rose-500/5 blur-[130px] pointer-events-none ambient-blob-reverse dark:opacity-0" />

      <div className="w-full h-screen sm:h-[830px] sm:max-w-[395px] sm:rounded-[3.2rem] sm:border-[10px] sm:border-slate-900/90 dark:sm:border-threads-border sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] bg-[#faf6f8] dark:bg-threads-bg overflow-hidden flex flex-col relative transition-all duration-500">

        {/* Phone Notch/Speaker mockup on desktop screen */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-slate-900/95 dark:bg-threads-surface rounded-b-2xl z-50">
          <div className="w-10 h-1 bg-zinc-700/60 rounded-full mx-auto mt-2" />
        </div>

        {/* Simulated Screen Glare Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] dark:via-white/[0.018] to-transparent pointer-events-none z-30" />

        {/* Desktop mock notch clearance */}
        <div className="hidden sm:block h-5 w-full bg-transparent flex-shrink-0" />

        {/* Global App Header */}
        {nickname ? (
          <Header
            nickname={nickname}
            onLogout={handleLogout}
            isDark={isDark}
            onToggleDark={handleToggleDark}
          />
        ) : (
          <header className="w-full glass px-4 safe-area-pt sm:pt-8 pb-3 border-b border-rose-150/15 dark:border-zinc-800/30 shadow-soft z-40 relative flex-shrink-0">
            <div className="max-w-md mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2 group">
                <motion.div
                  whileHover={{ scale: 1.12, rotate: 12 }}
                  className="p-1.5 bg-gradient-to-tr from-pink-500 to-violet-500 rounded-xl border border-white/20"
                >
                  <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-lg" />
                </motion.div>
                <h1 className="font-rounded font-black text-lg tracking-tight bg-gradient-to-r from-pink-500 via-rose-455 to-indigo-400 dark:from-pink-300 dark:via-rose-350 dark:to-indigo-300 bg-clip-text text-transparent">
                  SupaSnap
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  id="header-login-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsAuthModalOpen(true)}
                  className="shimmer-btn flex items-center space-x-1 px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-rose-450 text-white rounded-full text-xs font-bold font-rounded shadow-sm cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </motion.button>
                <motion.button
                  id="header-darkmode-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleDark}
                  className="p-2.5 rounded-full bg-white/40 dark:bg-zinc-900/50 border border-rose-100/20 dark:border-zinc-800 hover:bg-rose-55 dark:hover:bg-zinc-800 text-slate-500 dark:text-amber-200 transition-colors cursor-pointer"
                  aria-label="Toggle dark mode"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-rose-450" />}
                </motion.button>
              </div>
            </div>
          </header>
        )}

        {/* Scrollable Main content area */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10 dark:bg-threads-bg">
          {/* Sticky feed chrome — không bị snap animation che */}
          {!isLoadingFeed && (activeTab === 'feed' ? photos.length > 0 : userPhotos.length > 0) && (
            <div className="shrink-0 z-20 sticky top-0 px-3 sm:px-4 pt-2 pb-2 space-y-2 border-b border-rose-100/20 dark:border-threads-border bg-[#faf6f8]/95 dark:bg-threads-bg/95 backdrop-blur-md">
              {activeTab === 'feed' && photos.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-threads-muted" />
                  <input
                    type="search"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Tìm bạn bè..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-threads-surface border border-rose-100/30 dark:border-threads-border text-slate-700 dark:text-threads-text placeholder-slate-400 dark:placeholder-threads-muted focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-threads-text shrink-0">
                  {activeTab === 'feed' ? 'Dành cho bạn' : 'Của tôi'}
                </span>
                <div className="flex items-center gap-2 min-w-0 p-1 rounded-xl dark:bg-threads-surface border dark:border-threads-border">
                  {activeTab === 'feed' && galleryUsernames.length > 0 && (
                    <select
                      value={galleryUserFilter}
                      onChange={(e) => setGalleryUserFilter(e.target.value)}
                      className="max-w-[100px] truncate text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-threads-elevated border border-rose-100/25 dark:border-threads-border text-slate-600 dark:text-threads-text focus:outline-none cursor-pointer"
                      aria-label="Lọc theo người đăng"
                    >
                      <option value="">Tất cả</option>
                      {galleryUsernames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center space-x-0.5 p-0.5 rounded-lg shrink-0">
                    <button
                      onClick={() => setLayoutMode('grid')}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        layoutMode === 'grid'
                          ? 'bg-white dark:bg-threads-hover text-slate-800 dark:text-threads-text'
                          : 'text-slate-400 dark:text-threads-muted hover:text-slate-600 dark:hover:text-threads-text'
                      }`}
                      title="Grid View"
                      aria-label="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setLayoutMode('list')}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        layoutMode === 'list'
                          ? 'bg-white dark:bg-threads-hover text-slate-800 dark:text-threads-text'
                          : 'text-slate-400 dark:text-threads-muted hover:text-slate-600 dark:hover:text-threads-text'
                      }`}
                      title="List View"
                      aria-label="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-3 main-scroll-pad no-scrollbar">
          {isLoadingFeed ? (
            <CinematicFeedLoader />
          ) : activeTab === 'feed' ? (
            /* Feed tab view */
            photos.length === 0 ? (
              /* Empty Feed state */
              <div className="flex flex-col items-center justify-center text-center py-20 px-6 space-y-6">
                <motion.div 
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full bg-white/40 dark:bg-zinc-900/40 flex items-center justify-center border-2 border-dashed border-rose-200 dark:border-zinc-800 shadow-inner"
                >
                  <Camera className="w-8 h-8 text-pink-400 dark:text-zinc-500" />
                </motion.div>
                <div className="space-y-2">
                  <h3 className="font-rounded font-black text-lg text-slate-800 dark:text-pink-100">
                    No snaps yet!
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-550 leading-relaxed max-w-[200px] mx-auto font-medium">
                    Be the first to share a moment! Press the floating shutter button below. 📸✨
                  </p>
                </div>
              </div>
            ) : feedPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
                  Không tìm thấy snap. Thử đổi từ khóa tìm bạn hoặc chọn &quot;Tất cả&quot;.
                </p>
              </div>
            ) : layoutMode === 'list' ? (
              <FeedEntranceList play={playFeedEntrance} variant={entranceVariant} className="divide-y divide-rose-100/40 dark:divide-threads-border">
                {feedPhotos.map((photo, index) => (
                  <FeedEntranceListItem
                    key={photo.id}
                    play={playFeedEntrance}
                    variant={entranceVariant}
                    index={index}
                  >
                    <PhotoCard
                      photo={photo}
                      currentUser={nickname || 'anonymous'}
                      onReact={handleReact}
                      comments={commentsByPhoto[photo.id] || []}
                      isLoggedIn={!!sessionUser}
                      onRequireAuth={handleRequireAuth}
                      onAddComment={handleAddComment}
                      onReactComment={handleReactComment}
                      isAdmin={isAdmin}
                      onRequestDelete={setPhotoToDelete}
                      skipFeedEntrance={playFeedEntrance}
                    />
                  </FeedEntranceListItem>
                ))}
              </FeedEntranceList>
            ) : (
              <FeedEntranceGrid
                play={playFeedEntrance}
                variant={entranceVariant}
                className="grid grid-cols-3 gap-1.5 px-2 pb-6 overflow-hidden isolate"
              >
                {feedPhotos.map((photo, index) => (
                  <FeedEntranceCell
                    key={photo.id}
                    play={playFeedEntrance}
                    variant={entranceVariant}
                    index={index}
                    total={feedPhotos.length}
                    onClick={() => setSelectedPhoto(photo)}
                    className="gallery-cell relative aspect-square rounded-xl overflow-hidden cursor-pointer ring-1 ring-rose-100/30 dark:ring-threads-border bg-white/50 dark:bg-threads-surface group"
                  >
                    <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
                  </FeedEntranceCell>
                ))}
              </FeedEntranceGrid>
            )
          ) : (
            /* Snap history tab view */
            !sessionUser ? (
              /* Not logged in empty state */
              <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6 bg-white/40 dark:bg-zinc-900/40 rounded-[2.5rem] border border-rose-100/20 dark:border-zinc-850 p-6 shadow-sm">
                <div className="w-18 h-18 rounded-full bg-rose-50/50 dark:bg-zinc-900 flex items-center justify-center border border-rose-100/50 dark:border-zinc-800">
                  <History className="w-8 h-8 text-pink-400 dark:text-zinc-500" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-rounded font-black text-lg text-slate-800 dark:text-pink-100">
                    Snap Board
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-[200px] mx-auto leading-relaxed font-medium">
                    Log in to record snaps you've posted and see reactions from friends! 💖
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAuthModalOpen(true)}
                  className="shimmer-btn px-6 py-3.5 bg-gradient-to-r from-pink-500 to-rose-455 text-white rounded-2xl font-rounded font-extrabold text-xs shadow-cute cursor-pointer"
                >
                  Log In / Sign Up
                </motion.button>
              </div>
            ) : userPhotos.length === 0 ? (
              /* Logged in but empty snaps history */
              <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6 bg-white/40 dark:bg-zinc-900/40 rounded-[2.5rem] border border-rose-100/20 dark:border-zinc-850 p-6 shadow-sm">
                <div className="w-18 h-18 rounded-full bg-rose-50/50 dark:bg-zinc-900 flex items-center justify-center border border-rose-100/50 dark:border-zinc-800">
                  <Camera className="w-8 h-8 text-pink-450 dark:text-zinc-500 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-rounded font-black text-lg text-slate-800 dark:text-pink-100">
                    Your Snap Board
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-550 max-w-[200px] mx-auto leading-relaxed font-medium">
                    You haven't posted any snaps yet. Share your first moment to start! 📸✨
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsCameraOpen(true)}
                  className="shimmer-btn px-5 py-3.5 bg-gradient-to-r from-pink-500 to-rose-455 text-white rounded-2xl font-rounded font-extrabold text-xs shadow-cute flex items-center space-x-1.5 mx-auto cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Post Your First Snap</span>
                </motion.button>
              </div>
            ) : layoutMode === 'list' ? (
              <div className="space-y-5">
                <div className="mb-2 text-center">
                  <span className="inline-block px-3 py-1 bg-pink-50/50 dark:bg-zinc-900/60 text-pink-500 dark:text-pink-300 rounded-full text-[10px] font-extrabold font-rounded border border-pink-100/30 dark:border-zinc-800/80">
                    You have shared {userPhotos.length} snaps 🌸
                  </span>
                </div>
                {userPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    currentUser={nickname || 'anonymous'}
                    onReact={handleReact}
                    comments={commentsByPhoto[photo.id] || []}
                    isLoggedIn={!!sessionUser}
                    onRequireAuth={handleRequireAuth}
                    onAddComment={handleAddComment}
                    onReactComment={handleReactComment}
                    isAdmin={isAdmin}
                    onRequestDelete={setPhotoToDelete}
                  />
                ))}
              </div>
            ) : (
              /* 3-Column Personal Grid Gallery */
              <div className="space-y-3 pb-6">
                <div className="text-center">
                  <span className="inline-block px-3 py-1 bg-pink-50/50 dark:bg-zinc-900/60 text-pink-500 dark:text-pink-300 rounded-full text-[10px] font-extrabold font-rounded border border-pink-100/30 dark:border-zinc-800/80">
                    Shared: {userPhotos.length} snaps 🌸
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {userPhotos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      whileHover={{ scale: 1.03, y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedPhoto(photo)}
                      className="gallery-cell relative aspect-square rounded-xl overflow-hidden cursor-pointer ring-1 ring-rose-100/30 dark:ring-threads-border bg-white/50 dark:bg-threads-surface group"
                    >
                      <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          )}
          </div>
        </main>

        {/* Lightbox details modal overlay */}
        <AnimatePresence>
          {selectedPhoto && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0709]/75 dark:bg-black/90 backdrop-blur-md"
            >
              <div
                className="absolute inset-0"
                onClick={() => {
                  stopSnapMusic();
                  setSelectedPhoto(null);
                }}
              />
              
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 15 }}
                className="relative w-full max-w-[340px] z-10 flex flex-col items-center"
              >
                {/* Close Button above card */}
                <button
                  onClick={() => {
                    stopSnapMusic();
                    setSelectedPhoto(null);
                  }}
                  className="self-end mb-2.5 p-2 rounded-full bg-white/10 text-white hover:bg-white/15 transition-all border border-white/10 cursor-pointer shadow-md"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <PhotoCard
                  variant="detail"
                  photo={selectedPhoto}
                  currentUser={nickname || 'anonymous'}
                  onReact={handleReact}
                  autoPlay={true}
                  comments={commentsByPhoto[selectedPhoto.id] || []}
                  isLoggedIn={!!sessionUser}
                  onRequireAuth={handleRequireAuth}
                  onAddComment={handleAddComment}
                  onReactComment={handleReactComment}
                  isAdmin={isAdmin}
                  onRequestDelete={setPhotoToDelete}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav — in flex flow (not absolute) so it isn't clipped by overflow-hidden */}
        <div className="flex-shrink-0 z-35 px-3 pt-1.5 safe-area-pb-nav border-t border-transparent dark:border-threads-border dark:bg-threads-bg">
          <div className="w-full max-w-md mx-auto dark:bg-threads-bg rounded-2xl p-1.5 flex items-center justify-between px-4 sm:px-6">
          {/* Feed Tab Button */}
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3.5 rounded-2xl transition-all relative cursor-pointer group select-none`}
          >
            {activeTab === 'feed' && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute inset-0 bg-pink-500/10 dark:bg-threads-hover rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.93 }}>
              <Compass className={`w-5 h-5 transition-colors ${
                activeTab === 'feed'
                  ? 'text-pink-500 dark:text-threads-text'
                  : 'text-slate-400 dark:text-threads-muted group-hover:text-slate-600 dark:group-hover:text-threads-text'
              }`} />
            </motion.div>
            <span className={`text-[9px] font-rounded font-extrabold tracking-wider transition-colors ${
              activeTab === 'feed' 
                ? 'text-pink-500 dark:text-pink-300' 
                : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
            }`}>Feed</span>
          </button>

          {/* Shutter Shutter Camera button */}
          <div className="relative">
            {/* Glowing Shutter Pulse Background */}
            <div className="absolute -inset-1 rounded-full bg-white/30 dark:bg-white/10 blur-sm opacity-50 group-hover:opacity-80 transition-opacity pointer-events-none" />
            
            <motion.button
              id="floating-snap-btn"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCameraTrigger}
              className="relative w-12 h-12 bg-white dark:bg-threads-text text-black rounded-full shadow-md border-[3px] border-[#faf6f8] dark:border-threads-bg flex items-center justify-center cursor-pointer group z-10 overflow-hidden"
              aria-label="Open Camera"
            >
              <div className="absolute inset-0 bg-white/5 group-hover:bg-white/15 transition-colors" />
              <Camera className="w-5 h-5 text-black transition-transform group-hover:scale-105" />
            </motion.button>
          </div>

          {/* History Tab Button */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3.5 rounded-2xl transition-all relative cursor-pointer group select-none`}
          >
            {activeTab === 'history' && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute inset-0 bg-pink-500/10 dark:bg-threads-hover rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.93 }}>
              <History className={`w-5 h-5 transition-colors ${
                activeTab === 'history' 
                  ? 'text-pink-500 dark:text-pink-300' 
                  : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
              }`} />
            </motion.div>
            <span className={`text-[9px] font-rounded font-extrabold tracking-wider transition-colors ${
              activeTab === 'history' 
                ? 'text-pink-500 dark:text-pink-300' 
                : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
            }`}>History</span>
          </button>
          </div>
        </div>

        {/* Camera sheet popup */}
        <CameraOverlay
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onUpload={handlePhotoUpload}
          isUploading={isUploading}
        />

        {/* Authentication Modal */}
        {photoToDelete && (
          <ConfirmDialog
            title="Xóa snap?"
            message="Bài và bình luận sẽ bị xóa vĩnh viễn. (Admin)"
            confirmLabel="Xóa"
            isLoading={isDeletingPhoto}
            onCancel={() => !isDeletingPhoto && setPhotoToDelete(null)}
            onConfirm={() => handleDeletePhoto(photoToDelete)}
          />
        )}

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Cute Toast notification popup */}
        <AnimatePresence>
          {toast && (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-50 w-[80%] max-w-xs px-2 pointer-events-none"
              style={{ top: 'max(4.5rem, calc(env(safe-area-inset-top, 0px) + 3.5rem))' }}
            >
              <motion.div
                initial={{ opacity: 0, y: -15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                className={`p-3.5 rounded-2xl shadow-lg border text-xs font-bold font-rounded flex items-center justify-center text-center ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-250 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200 shadow-emerald-100/10'
                    : toast.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-250 dark:border-rose-900/60 text-rose-700 dark:text-rose-200 shadow-rose-100/10'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-250 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-250 shadow-indigo-100/10'
                }`}
              >
                <span>{toast.message}</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
