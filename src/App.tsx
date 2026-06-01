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
  isStorageMimeError,
  type MediaType,
} from './lib/media';
import { AuthModal } from './components/AuthModal';
import { ConfirmDialog } from './components/ConfirmDialog';

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
  const [isDark, setIsDark] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

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
    captionBgColor?: string | null
  ) => {
    if (!sessionUser) {
      showToast('Log in first to upload snaps! 🌸', 'error');
      setIsCameraOpen(false);
      setIsAuthModalOpen(true);
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = extensionForUpload(blob, mediaType);
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 10000)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, blob, {
          contentType: contentTypeForUpload(blob, mediaType),
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { data: insertedRow, error: insertError } = await supabase
        .from('photos')
        .insert([
          {
            image_url: publicUrl,
            caption: caption || null,
            username: nickname,
            reactions: [],
            user_id: sessionUser.id,
          },
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Try to update extra columns separately (safe — won't crash if columns don't exist yet)
      if (insertedRow?.id) {
        const extraData: Record<string, any> = {};
        if (songTitle)         extraData.song_title       = songTitle;
        if (songArtist)        extraData.song_artist      = songArtist;
        if (songAlbumArt)      extraData.song_album_art   = songAlbumArt;
        if (songPreviewUrl)    extraData.song_preview_url = songPreviewUrl;
        if (captionTextColor)  extraData.caption_text_color = captionTextColor;
        if (captionBgStyle)    extraData.caption_bg_style   = captionBgStyle;
        if (captionTextEffect) extraData.caption_text_effect = captionTextEffect;
        if (captionBgColor) extraData.caption_bg_color = captionBgColor;
        extraData.media_type = mediaType;

        if (Object.keys(extraData).length > 0) {
          const { error: extraError } = await supabase
            .from('photos')
            .update(extraData)
            .eq('id', insertedRow.id);

          if (extraError) {
            console.warn('⚠️ Extra columns not saved. Run schema migration in Supabase:', extraError.message);
            showToast('Snap posted! ⚠️ Run SQL migration to enable music & styling.', 'info');
          }
        }
      }

      showToast('Snap shared successfully! 🚀✨', 'success');
      setIsCameraOpen(false);
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
    return list;
  }, [photos, galleryUserFilter, friendSearch]);

  return (
    <div className="min-h-screen w-full bg-[#f4eff2] dark:bg-[#070408] text-slate-800 dark:text-zinc-100 flex items-center justify-center p-0 sm:p-4 md:p-6 transition-colors duration-500 relative overflow-hidden font-sans">
      {/* Animated ambient backdrop glows (Desktop background) */}
      <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-pink-500/10 to-indigo-500/5 blur-[130px] pointer-events-none ambient-blob" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-500/10 to-rose-500/5 blur-[130px] pointer-events-none ambient-blob-reverse" />

      {/* Simulated smartphone device container */}
      <div className="w-full h-screen sm:h-[830px] sm:max-w-[395px] sm:rounded-[3.2rem] sm:border-[10px] sm:border-slate-900/90 dark:sm:border-zinc-800/95 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] bg-[#faf6f8] dark:bg-[#0a0709] overflow-hidden flex flex-col relative transition-all duration-500">
        
        {/* Ambient background glows INSIDE the simulated phone screen */}
        <div className="absolute top-[8%] left-[-25%] w-[70%] h-[35%] rounded-full bg-pink-500/8 dark:bg-pink-600/5 blur-[75px] pointer-events-none z-0 ambient-blob" />
        <div className="absolute bottom-[18%] right-[-25%] w-[70%] h-[35%] rounded-full bg-indigo-500/8 dark:bg-purple-600/4 blur-[75px] pointer-events-none z-0 ambient-blob-reverse" />

        {/* Phone Notch/Speaker mockup on desktop screen */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-slate-900/95 dark:bg-zinc-800/95 rounded-b-2xl z-50">
          <div className="w-10 h-1 bg-zinc-700/60 rounded-full mx-auto mt-2" />
        </div>

        {/* Simulated Screen Glare Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] dark:via-white/[0.018] to-transparent pointer-events-none z-30" />

        {/* Space notch offset */}
        <div className="hidden sm:block h-2 w-full bg-transparent flex-shrink-0" />

        {/* Global App Header */}
        {nickname ? (
          <Header
            nickname={nickname}
            onLogout={handleLogout}
            isDark={isDark}
            onToggleDark={handleToggleDark}
          />
        ) : (
          <header className="w-full glass px-4 pt-4 sm:pt-9 pb-3.5 border-b border-rose-150/15 dark:border-zinc-800/30 shadow-soft z-40 relative flex-shrink-0">
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
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-28 no-scrollbar relative z-10">
          
          {/* Personalized Greeting Section */}
          {!isLoadingFeed && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-1 pt-1.5 select-none greeting-card rounded-[1.75rem] px-4 py-3.5 shadow-sm"
            >
              <h2 className="text-xl font-black font-rounded text-slate-800 dark:text-pink-100 tracking-tight">
                {nickname ? `Xin chào, ${nickname}! 👋` : 'Khám phá Snaps 🚀'}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-extrabold uppercase tracking-widest mt-1">
                {nickname ? 'Khoảnh khắc mới nhất · ảnh & video' : 'Đăng nhập để đăng snap & tương tác'}
              </p>
            </motion.div>
          )}

          {activeTab === 'feed' && !isLoadingFeed && photos.length > 0 && (
            <div className="mb-3 px-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Tìm bạn bè theo tên..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-rounded bg-white/70 dark:bg-zinc-900/70 border border-rose-100/30 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400/25"
                />
              </div>
            </div>
          )}

          {/* Feed Header toolbar */}
          {!isLoadingFeed && (activeTab === 'feed' ? photos.length > 0 : userPhotos.length > 0) && (
            <div className="flex items-center justify-between gap-2 mb-4 px-1">
              <span className="font-rounded font-extrabold text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider pl-0.5 shrink-0">
                {activeTab === 'feed' ? '✨ Bạn bè' : '📌 Của tôi'}
              </span>
              
              <div className="flex items-center gap-2 min-w-0 glass-darker p-1 rounded-2xl">
              {activeTab === 'feed' && galleryUsernames.length > 0 && (
                <select
                  value={galleryUserFilter}
                  onChange={(e) => setGalleryUserFilter(e.target.value)}
                  className="max-w-[100px] truncate text-[10px] font-extrabold font-rounded px-2.5 py-1.5 rounded-xl bg-white/60 dark:bg-zinc-900/80 border border-rose-100/25 dark:border-zinc-700 text-slate-600 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-400/30 cursor-pointer"
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
              <div className="flex items-center space-x-1 bg-white/40 dark:bg-zinc-900/40 p-1 rounded-xl border border-rose-100/15 dark:border-zinc-800/60 shadow-sm shrink-0">
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    layoutMode === 'grid'
                      ? 'bg-white dark:bg-zinc-850 text-pink-500 dark:text-pink-300 shadow-sm border border-pink-100/10'
                      : 'text-slate-400 dark:text-zinc-550 hover:text-slate-600'
                  }`}
                  title="Grid View"
                  aria-label="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setLayoutMode('list')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    layoutMode === 'list'
                      ? 'bg-white dark:bg-zinc-850 text-pink-500 dark:text-pink-300 shadow-sm border border-pink-100/10'
                      : 'text-slate-400 dark:text-zinc-550 hover:text-slate-600'
                  }`}
                  title="List View"
                  aria-label="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              </div>
            </div>
          )}

          {isLoadingFeed ? (
            /* Loading Feed skeleton */
            <div className="flex flex-col items-center justify-center py-28 space-y-4">
              <div className="w-10 h-10 border-[3px] border-pink-200 border-t-pink-500 rounded-full animate-spin" />
              <p className="font-rounded text-xs text-slate-400 dark:text-zinc-500 font-bold animate-pulse">
                Opening snaps... 🌸
              </p>
            </div>
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
              <div className="space-y-5">
                {feedPhotos.map((photo) => (
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
              /* Locket Grid Layout with metadata indicators */
              <div className="grid grid-cols-3 gap-2.5 pb-6">
                {feedPhotos.map((photo) => (
                  <motion.div
                    key={photo.id}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedPhoto(photo)}
                    className="gallery-cell relative aspect-square rounded-[1.35rem] overflow-hidden cursor-pointer ring-1 ring-rose-100/30 dark:ring-zinc-800/80 bg-white/50 dark:bg-zinc-900/70 group transition-all duration-300"
                  >
                    <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
                  </motion.div>
                ))}
              </div>
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
                      className="gallery-cell relative aspect-square rounded-[1.35rem] overflow-hidden cursor-pointer ring-1 ring-rose-100/30 dark:ring-zinc-800/80 bg-white/50 dark:bg-zinc-900/70 group transition-all duration-300"
                    >
                      <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          )}
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
              <div className="absolute inset-0" onClick={() => setSelectedPhoto(null)} />
              
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 15 }}
                className="relative w-full max-w-[340px] z-10 flex flex-col items-center"
              >
                {/* Close Button above card */}
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="self-end mb-2.5 p-2 rounded-full bg-white/10 text-white hover:bg-white/15 transition-all border border-white/10 cursor-pointer shadow-md"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <PhotoCard
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

        {/* Embedded Bottom Navigation Bar (Glassmorphic Floating Capsule) */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-35 w-[88%] glass rounded-[2.2rem] border border-white/15 dark:border-zinc-800/80 p-2 flex items-center justify-between px-6 shadow-[0_15px_35px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.55)]">
          {/* Feed Tab Button */}
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3.5 rounded-2xl transition-all relative cursor-pointer group select-none`}
          >
            {activeTab === 'feed' && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute inset-0 bg-pink-500/10 dark:bg-pink-500/15 rounded-2xl -z-10 border border-pink-500/20"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.93 }}>
              <Compass className={`w-5 h-5 transition-colors ${
                activeTab === 'feed' 
                  ? 'text-pink-500 dark:text-pink-300' 
                  : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
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
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-indigo-500 blur-sm opacity-60 group-hover:opacity-90 transition-opacity animate-pulse pointer-events-none" />
            
            <motion.button
              id="floating-snap-btn"
              whileHover={{ scale: 1.08, y: -4 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCameraTrigger}
              className="relative w-13 h-13 bg-gradient-to-tr from-pink-500 via-rose-500 to-indigo-500 text-white rounded-full shadow-lg border-[3.5px] border-[#faf6f8] dark:border-[#0a0709] flex items-center justify-center cursor-pointer group z-10 overflow-hidden"
              aria-label="Open Camera"
            >
              <div className="absolute inset-0 bg-white/5 group-hover:bg-white/15 transition-colors" />
              <Camera className="w-5.5 h-5.5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform group-hover:rotate-6" />
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
                className="absolute inset-0 bg-pink-500/10 dark:bg-pink-500/15 rounded-2xl -z-10 border border-pink-500/20"
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
            <div className="absolute top-22 left-1/2 -translate-x-1/2 z-50 w-[80%] max-w-xs px-2 pointer-events-none">
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
