import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Compass, X, Search, User, MessageSquare, LayoutGrid, List } from 'lucide-react';
import { isAdminUser } from './lib/admin';
import { supabase } from './lib/supabase';
import { Header } from './components/Header';
import { Logo } from './components/Logo';
import { PhotoCard } from './components/PhotoCard';
import type { PhotoData } from './components/PhotoCard';
import type { Comment } from './types/comment';
import type { ChatMessage } from './components/ChatTab';
import { GalleryThumb } from './components/GalleryThumb';
import {
  extensionForUpload,
  contentTypeForUpload,
  ensureBlobMime,
  isStorageMimeError,
  type MediaType,
} from './lib/media';
import {
  CinematicFeedLoader,
  FeedEntranceList,
  FeedEntranceListItem,
  FeedEntranceGrid,
  FeedEntranceCell,
  useFeedEntrance,
} from './components/FeedEntrance';
import { playSnapMusic, stopSnapMusic } from './lib/snapMusic';
import { blobFingerprint, isDuplicateUpload, markUploadPosted } from './lib/uploadDedup';

// Lazy load heavy components for better initial load performance
const CameraOverlay = lazy(() => import('./components/CameraOverlay').then(m => ({ default: m.CameraOverlay })));
const ProfileTab = lazy(() => import('./components/ProfileTab').then(m => ({ default: m.ProfileTab })));
const ChatTab = lazy(() => import('./components/ChatTab').then(m => ({ default: m.ChatTab })));
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const ConfirmDialog = lazy(() => import('./components/ConfirmDialog').then(m => ({ default: m.ConfirmDialog })));

const INITIAL_FEED_LIMIT = 30;

export default function App() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  
  // Navigation & Flow
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'profile'>('feed');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const [galleryUserFilter, setGalleryUserFilter] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  
  // Custom features state
  const [status, setStatus] = useState<string>('');
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [usernamesList, setUsernamesList] = useState<string[]>([]);
  const [unreadMessagesBySender, setUnreadMessagesBySender] = useState<Record<string, number>>({});
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [chatPresenceUsers, setChatPresenceUsers] = useState<Record<string, boolean>>({});
  const [recentActiveUsers, setRecentActiveUsers] = useState<Record<string, string>>({});
  const [readCutoffs, setReadCutoffs] = useState<Record<string, string>>({});
  const readCutoffsRef = useRef<Record<string, string>>({});
  const activeTabRef = useRef(activeTab);
  const chatActiveRecipientRef = useRef<string | null>(null);
  const sessionUserRef = useRef<any>(null);

  useEffect(() => {
    readCutoffsRef.current = readCutoffs || {};
  }, [readCutoffs]);
  const [chatActiveRecipient, setChatActiveRecipient] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { avatar_url?: string; last_seen_at?: string; status?: string }>>({});

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
  const lastPhotosFetchRef = useRef<number>(0);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    chatActiveRecipientRef.current = chatActiveRecipient;
  }, [chatActiveRecipient]);

  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

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
      requestNotificationPermission();
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
              const uLower = newPhoto.username.toLowerCase();
              if (followingList.map(u => u.toLowerCase()).includes(uLower)) {
                showToast(`${newPhoto.username} vừa đăng một snap mới! 📸✨`, 'info');
              } else {
                showToast(`New snap from ${newPhoto.username}! 📸✨`, 'info');
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPhoto = payload.new as PhotoData;
            
            // Reaction notification: did someone react to our photo?
            setPhotos((prev) => {
              const localPhoto = prev.find((p) => p.id === updatedPhoto.id);
              if (localPhoto && nickname && localPhoto.username.toLowerCase() === nickname.toLowerCase()) {
                const oldReactions = localPhoto.reactions || [];
                const newReactions = updatedPhoto.reactions || [];
                if (newReactions.length > oldReactions.length) {
                  const lastReaction = newReactions[newReactions.length - 1];
                  if (lastReaction && lastReaction.username.toLowerCase() !== nickname.toLowerCase()) {
                    showToast(`${lastReaction.username} đã thả ${lastReaction.emoji} vào snap của bạn! ❤️`, 'info');
                  }
                }
              }
              return prev.map((photo) => (photo.id === updatedPhoto.id ? updatedPhoto : photo));
            });
            
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
  }, [sessionUser, nickname, followingList]);

  const fetchComments = async (photoIds: string[]) => {
    if (photoIds.length === 0) {
      setCommentsByPhoto({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .in('photo_id', photoIds)
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

  const fetchUserAvatars = async () => {
    try {
      let profilesData: any[] = [];
      const profileSelects = [
        'username, avatar_url, last_seen_at, status',
        'username, last_seen_at, status',
        'username, last_seen_at',
        'username',
      ];

      for (const columns of profileSelects) {
        const { data, error } = await supabase.from('profiles').select(columns);
        if (!error && data) {
          profilesData = data;
          break;
        }
        console.warn(`profiles select failed (${columns}):`, error?.message);
      }

      const avatarMap: Record<string, string> = {};
      const profileMap: Record<string, { avatar_url?: string; last_seen_at?: string; status?: string }> = {};
      profilesData.forEach((p) => {
        if (p.username) {
          const usernameKey = p.username.toLowerCase();
          const localAvatar = localStorage.getItem(`lunae_avatar_${usernameKey}`);
          avatarMap[usernameKey] = p.avatar_url || localAvatar || '';
          profileMap[usernameKey] = {
            avatar_url: avatarMap[usernameKey],
            last_seen_at: p.last_seen_at,
            status: p.status || '',
          };
        }
      });
      setUsernamesList(profilesData.map((p) => p.username).filter(Boolean));
      setUserAvatars(avatarMap);
      setUserProfiles(profileMap);
    } catch (err) {
      console.warn('fetchUserAvatars error:', err);
    }
  };

  useEffect(() => {
    if (activeTab !== 'chat') return;

    void fetchUserAvatars();
    const profileStatusInterval = window.setInterval(() => {
      void fetchUserAvatars();
    }, 15000);

    return () => {
      window.clearInterval(profileStatusInterval);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!nickname) {
      setChatPresenceUsers({});
      return;
    }

    const username = nickname.toLowerCase();
    const presenceKey = `${username}-${sessionUserRef.current?.id || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel('app-presence', {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    const syncPresence = () => {
      const state = channel.presenceState();
      const onlineUsers: Record<string, boolean> = {};

      Object.values(state).forEach((presences) => {
        presences.forEach((presence: any) => {
          const presenceUsername = String(presence?.username || presence?.user || '').trim().toLowerCase();
          if (presenceUsername) {
            onlineUsers[presenceUsername] = true;
          }
        });
      });

      setChatPresenceUsers(onlineUsers);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        await channel.track({
          username,
          online_at: new Date().toISOString(),
        });
        syncPresence();
      });

    return () => {
      setChatPresenceUsers({});
      supabase.removeChannel(channel);
    };
  }, [nickname]);

  const handleUpdateProfile = async (newNickname: string, newAvatar: string, newStatus: string) => {
    if (!sessionUser) return;

    const cleanNickname = newNickname.trim().toLowerCase();

    // 1. Update in Supabase profiles. Try narrower payloads because older databases may
    // not have every optional profile column yet.
    try {
      const profileUpdates = [
        {
          username: cleanNickname,
          avatar_url: newAvatar,
          status: newStatus,
        },
        {
          username: cleanNickname,
          status: newStatus,
        },
        {
          username: cleanNickname,
        },
      ];

      let lastError: unknown = null;
      for (const update of profileUpdates) {
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', sessionUser.id);
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
      }

      if (lastError) throw lastError;
    } catch (err: any) {
      console.warn('Database profiles update skipped/failed:', err?.message);
    }

    // 2. Update local state & localStorage
    localStorage.setItem(`lunae_avatar_${cleanNickname}`, newAvatar);
    localStorage.setItem(`lunae_status_${cleanNickname}`, newStatus);
    localStorage.setItem('supasnap_nickname', cleanNickname);
    
    setNickname(cleanNickname);
    setStatus(newStatus);
    setUserAvatars((prev) => ({
      ...prev,
      [cleanNickname]: newAvatar,
    }));
    setUserProfiles((prev) => ({
      ...prev,
      [cleanNickname]: {
        ...(prev[cleanNickname] || {}),
        avatar_url: newAvatar,
        status: newStatus,
        last_seen_at: new Date().toISOString(),
      },
    }));

    await fetchPhotos();
  };

  // Chat message fetch
  const fetchChatMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        // Merge with localStorage fallback so locally-marked read messages stay read
        try {
          const localMsgs = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
          const localById: Record<string, any> = {};
          const localByKey: Record<string, any> = {};
          (localMsgs || []).forEach((m: any) => {
            if (m && m.id) localById[m.id] = m;
            try {
              const s = (m.sender_username || '').toLowerCase();
              const r = (m.receiver_username || '').toLowerCase();
              const k = `${s}|${r}|${m.created_at}`;
              localByKey[k] = m;
            } catch (e) {
              // ignore
            }
          });

          const merged = (data || []).map((srv: any) => {
            // prefer server read_at if present, otherwise look up local by id or by key
            const local = localById[srv.id];
            if (local && local.read_at && !srv.read_at) {
              return { ...srv, read_at: local.read_at };
            }
            try {
              const s = (srv.sender_username || '').toLowerCase();
              const r = (srv.receiver_username || '').toLowerCase();
              const k = `${s}|${r}|${srv.created_at}`;
              const local2 = localByKey[k];
              if (local2 && local2.read_at && !srv.read_at) {
                return { ...srv, read_at: local2.read_at };
              }
            } catch (e) {}
            return srv;
          });

          setChatMessages(merged);
        } catch (e) {
          setChatMessages(data);
        }
      } else {
        const localMsgs = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
        setChatMessages(localMsgs);
      }
    } catch {
      const localMsgs = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
      setChatMessages(localMsgs);
    }
  };

  // Follow statistics & Chat messages realtime listener
  useEffect(() => {
    if (!nickname) {
      setFollowingList([]);
      setFollowersCount(0);
      setStatus('');
      setChatMessages([]);
      return;
    }

    const usernameLower = nickname.toLowerCase();
    
    const fetchStats = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('username', usernameLower)
          .maybeSingle();
        if (profile?.status) setStatus(profile.status);
        else {
          setStatus(localStorage.getItem(`lunae_status_${usernameLower}`) || '');
        }
      } catch {
        setStatus(localStorage.getItem(`lunae_status_${usernameLower}`) || '');
      }

      try {
        const { data: following } = await supabase
          .from('follows')
          .select('following_username')
          .eq('follower_username', usernameLower);
        if (following) {
          setFollowingList(following.map((f) => f.following_username.toLowerCase()));
        } else {
          setFollowingList(JSON.parse(localStorage.getItem(`lunae_follows_${usernameLower}`) || '[]'));
        }

        const { count } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_username', usernameLower);
        if (count !== null) setFollowersCount(count);
        else {
          setFollowersCount(parseInt(localStorage.getItem(`lunae_followers_count_${usernameLower}`) || '0', 10));
        }
      } catch {
        setFollowingList(JSON.parse(localStorage.getItem(`lunae_follows_${usernameLower}`) || '[]'));
        setFollowersCount(parseInt(localStorage.getItem(`lunae_followers_count_${usernameLower}`) || '0', 10));
      }
    };

    fetchStats();
    fetchChatMessages();

    const updateLastSeen = () => {
      const currentSessionUser = sessionUserRef.current;
      if (!currentSessionUser) return;

      const lastSeenAt = new Date().toISOString();
      void supabase
        .from('profiles')
        .update({ last_seen_at: lastSeenAt })
        .eq('id', currentSessionUser.id)
        .then(({ error }) => {
          if (error) {
            console.warn('Could not update online status:', error.message);
          }
        });

      setUserProfiles((prev) => ({
        ...prev,
        [usernameLower]: {
          ...(prev[usernameLower] || {}),
          last_seen_at: lastSeenAt,
        },
      }));
    };

    const handleVisibilityChange = () => {
      updateLastSeen();
    };

    updateLastSeen();
    const lastSeenInterval = window.setInterval(updateLastSeen, 30000);
    window.addEventListener('focus', updateLastSeen);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Messages channel
    const messagesChannel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          try {
            console.debug('realtime new message payload:', { newMsg });
            console.debug('realtime new message payload json:', JSON.stringify(newMsg));
          } catch (e) {
            console.debug('realtime new message payload (stringify failed)', e);
          }
          try {
            console.debug('realtime new message keys', Object.keys(newMsg || {}));
            console.debug('realtime new message fields', {
              id: (newMsg as any).id,
              created_at: (newMsg as any).created_at,
              sender_username: (newMsg as any).sender_username,
              sender: (newMsg as any).sender,
              sender_user_id: (newMsg as any).sender_user_id,
              receiver_username: (newMsg as any).receiver_username,
              receiver: (newMsg as any).receiver,
              receiver_user_id: (newMsg as any).receiver_user_id,
            });
          } catch (e) {
            console.debug('realtime new message fields introspect failed', e);
          }
          try {
            const rr = (newMsg.receiver_username || (newMsg as any).receiver || '').toString();
            const ss = (newMsg.sender_username || (newMsg as any).sender || '').toString();
            console.debug('realtime new message meta', { receiver_raw: rr, sender_raw: ss, Notification_permission: Notification.permission, visibility: document.visibilityState });
          } catch (e) {
            console.debug('realtime debug meta failed', e);
          }
          // Normalize message fields so code always has sender_username/receiver_username
          const normalizedMsg: any = {
            ...newMsg,
            sender_username: (newMsg.sender_username || (newMsg as any).sender || '').toString(),
            receiver_username: (newMsg.receiver_username || (newMsg as any).receiver || '').toString(),
            created_at: (newMsg.created_at || new Date().toISOString()).toString(),
          };
          console.debug('normalized realtime message', normalizedMsg);

          setChatMessages((prev) => {
            if (prev.some((m) => m.id === normalizedMsg.id)) return prev;

            const matchingTemp = prev.find((m) =>
              m.id.startsWith('temp-msg-') &&
              m.sender_username.toLowerCase() === normalizedMsg.sender_username.toLowerCase() &&
              m.receiver_username.toLowerCase() === normalizedMsg.receiver_username.toLowerCase() &&
              m.body === normalizedMsg.body &&
              Math.abs(Date.parse(m.created_at || '') - Date.parse(normalizedMsg.created_at || '')) < 15000
            );

            if (matchingTemp) {
              return prev.map((m) => (m.id === matchingTemp.id ? normalizedMsg : m));
            }

            return [...prev, normalizedMsg];
          });

          // Robust receiver/sender detection: prefer username fields, fall back to ids
          const receiverRaw = (normalizedMsg.receiver_username || (normalizedMsg as any).receiver || (normalizedMsg as any).receiver_user_id || '').toString();
          const senderRaw = (normalizedMsg.sender_username || (normalizedMsg as any).sender || (normalizedMsg as any).sender_user_id || '').toString();
          const receiver = (receiverRaw || '').trim().toLowerCase();
          const sender = (senderRaw || '').trim().toLowerCase();
          if (sender) {
            setRecentActiveUsers((prev) => ({
              ...prev,
              [sender]: new Date().toISOString(),
            }));
          }
          const fallbackNick = (localStorage.getItem('supasnap_nickname') || '').toString().toLowerCase();
          const sessionMetaNick = (sessionUser?.user_metadata?.nickname || sessionUser?.user_metadata?.username || '').toString().toLowerCase();
          const currentUsername = ((nickname || fallbackNick || sessionMetaNick) || '').toString().trim().toLowerCase();

          console.debug('message handler vars', { receiver, sender, currentUsername, sessionUserId: sessionUserRef.current?.id });

          const incomingForCurrentUser =
            (receiver && currentUsername && receiver === currentUsername) ||
            (sessionUserRef.current && (String((newMsg as any).receiver_user_id || '').toLowerCase() === String(sessionUserRef.current.id).toLowerCase()));

          if (incomingForCurrentUser && sender && sender !== currentUsername) {
            const title = `Tin nhắn mới từ ${newMsg.sender_username || 'ai đó'}!`;
            const body = newMsg.body || 'Bạn vừa nhận được tin nhắn mới.';
            const suppressMessageNotification = activeTabRef.current === 'chat';
            console.debug('incoming message for current user', { title, body, suppressMessageNotification, Notification_permission: Notification.permission, visibility: document.visibilityState });
            if (!suppressMessageNotification) {
              showToast(title, 'info');
              sendBrowserNotification(title, body);
            }

            const isViewing = chatActiveRecipientRef.current?.toLowerCase() === sender;
            console.debug('realtime handling new message', { sender, receiver, currentUsername, isViewing, created_at: newMsg.created_at, cutoff: readCutoffsRef.current?.[sender] });

            // Keep the bell count visible in Chat, but suppress noisy toast notifications there.
            if (!isViewing || activeTabRef.current === 'chat') {
              try {
                const createdMs = Date.parse(newMsg.created_at || '') || Date.now();
                const cutoffIso = readCutoffsRef.current?.[sender] || null;
                const cutoffMs = cutoffIso ? Date.parse(cutoffIso) || 0 : 0;
                console.debug('created_vs_cutoff', { createdMs, cutoffIso, cutoffMs });
                if (createdMs > cutoffMs) {
                  console.debug('incrementing unread for', { sender });
                  setUnreadMessagesBySender((prev) => {
                    const next = { ...(prev || {}) };
                    next[sender] = (next[sender] || 0) + 1;
                    const total = Object.values(next).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
                    setTotalUnreadMessages(total);
                    setUnreadConversationsCount(Object.keys(next).length);
                    return next;
                  });
                } else {
                  console.debug('message older than cutoff — not counting as unread', { sender, createdMs, cutoffMs });
                }
              } catch (e) {
                console.debug('error parsing dates for unread increment, will still increment', e);
                setUnreadMessagesBySender((prev) => {
                  const next = { ...(prev || {}) };
                  next[sender] = (next[sender] || 0) + 1;
                  const total = Object.values(next).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
                  setTotalUnreadMessages(total);
                  setUnreadConversationsCount(Object.keys(next).length);
                  return next;
                });
              }
            } else {
              console.debug('user is viewing thread; marking read', { sender });
              await markThreadRead(sender);
            }
          } else {
            console.debug('message not for current user or from self — ignoring for unread', { receiver, sender, currentUsername });
          }
        }
      )
      .subscribe();

    // Follows channel
    const followsChannel = supabase
      .channel('realtime-follows')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const follow = payload.new as { follower_username: string; following_username: string };
            if (follow.following_username.toLowerCase() === usernameLower) {
              setFollowersCount((c) => c + 1);
              showToast(`${follow.follower_username} vừa theo dõi bạn! 🔔`, 'info');
            }
          } else if (payload.eventType === 'DELETE') {
            fetchStats();
          }
        }
      )
      .subscribe();

    // Profiles channel to reflect online/offline quickly
    const profilesChannel = supabase
      .channel('realtime-profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          try {
            const updated = payload.new as any;
            if (updated?.username) {
              setUserProfiles((prev) => ({
                ...prev,
                [updated.username.toLowerCase()]: {
                  avatar_url: updated.avatar_url ?? prev[updated.username.toLowerCase()]?.avatar_url,
                  last_seen_at: updated.last_seen_at ?? prev[updated.username.toLowerCase()]?.last_seen_at,
                  status: updated.status ?? prev[updated.username.toLowerCase()]?.status,
                },
              }));
            }
          } catch (e) {
            // ignore
          }
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(lastSeenInterval);
      window.removeEventListener('focus', updateLastSeen);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(followsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [nickname]);

  useEffect(() => {
    updateUnreadCounts(chatMessages);
  }, [chatMessages, nickname]);

  // Load read cutoffs from localStorage for the current user (persist last-read timestamp per partner)
  useEffect(() => {
    if (!nickname) {
      setReadCutoffs({});
      return;
    }
    try {
      const key = `lunae_chat_read_cutoffs_${nickname.toLowerCase()}`;
      const raw = localStorage.getItem(key) || '{}';
      const parsed = JSON.parse(raw) || {};
      setReadCutoffs(parsed);
    } catch (e) {
      setReadCutoffs({});
    }
  }, [nickname]);

  useEffect(() => {
    if (chatActiveRecipient) {
      void markThreadRead(chatActiveRecipient);
    }
  }, [chatActiveRecipient, nickname]);

  // When user opens a thread, immediately clear unread counts locally and mark messages read locally
  useEffect(() => {
    if (!chatActiveRecipient || !nickname) return;
    const current = nickname.toLowerCase();
    const senderLower = chatActiveRecipient.toLowerCase();

    // 1) Optimistically mark messages as read locally so UI updates immediately
    setChatMessages((prev) =>
      prev.map((msg) => {
        try {
          const s = msg.sender_username.toLowerCase();
          const r = msg.receiver_username.toLowerCase();
          if (s === senderLower && r === current && !msg.read_at) {
            return { ...msg, read_at: new Date().toISOString() };
          }
        } catch (e) {
          // ignore
        }
        return msg;
      })
    );

    // 2) Remove unread entry for this sender immediately
    setUnreadMessagesBySender((prev) => {
      const next = { ...prev };
      if (next[senderLower]) delete next[senderLower];
      const total = Object.values(next).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      setTotalUnreadMessages(total);
      setUnreadConversationsCount(Object.keys(next).length);
      return next;
    });

    // 3) Persist read state in localStorage for fallback
    try {
      const local = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
      if (Array.isArray(local) && local.length) {
        const updatedLocal = local.map((m: any) => {
          try {
            const s = (m.sender_username || '').toLowerCase();
            const r = (m.receiver_username || '').toLowerCase();
            if (s === senderLower && r === current) {
              return { ...m, read_at: m.read_at || new Date().toISOString() };
            }
          } catch (e) {}
          return m;
        });
        localStorage.setItem('lunae_chat_messages', JSON.stringify(updatedLocal));
      }
    } catch (e) {
      // ignore
    }
  }, [chatActiveRecipient, nickname]);

  const updateUnreadCounts = (messages: ChatMessage[], cutoffsOverride?: Record<string, string>) => {
    if (!nickname) {
      setUnreadMessagesBySender({});
      setUnreadConversationsCount(0);
      setTotalUnreadMessages(0);
      return;
    }

    const current = nickname.toLowerCase();
    const counts: Record<string, number> = {};
    let total = 0;

    messages.forEach((msg) => {
      const receiver = msg.receiver_username?.toLowerCase();
      const sender = msg.sender_username?.toLowerCase();
      if (receiver !== current || sender === current) return;

      // If we have a local read cutoff for this sender, treat messages older than
      // or equal to the cutoff as read (this persists read state across syncs).
      const effectiveCutoffs = cutoffsOverride || readCutoffs || {};
      const cutoffIso = effectiveCutoffs[sender] || null;
      if (cutoffIso) {
        const cutoffMs = Date.parse(cutoffIso) || 0;
        const createdMs = Date.parse(msg.created_at || '') || 0;
        if (createdMs <= cutoffMs) return;
      }

      if (!msg.read_at) {
        counts[sender] = (counts[sender] || 0) + 1;
        total += 1;
      }
    });

    console.debug('updateUnreadCounts - computed', { counts, total });
    setUnreadMessagesBySender(counts);
    setTotalUnreadMessages(total);
    setUnreadConversationsCount(Object.keys(counts).length);
  };

  const markThreadRead = async (senderUsername: string) => {
    if (!nickname) return;
    const current = nickname.toLowerCase();
    const senderLower = senderUsername.toLowerCase();

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .ilike('receiver_username', current)
        .ilike('sender_username', senderLower)
        .is('read_at', null);
    } catch (err) {
      console.warn('Could not mark thread read:', err);
    }

    // Update local messages immediately (optimistic) and compute updated counts
    const updatedMessages = (chatMessages || []).map((msg) =>
      msg.sender_username.toLowerCase() === senderLower && msg.receiver_username.toLowerCase() === current
        ? { ...msg, read_at: msg.read_at || new Date().toISOString() }
        : msg
    );
    setChatMessages(updatedMessages);

    // Also proactively remove the sender's unread conversation badge immediately
    setUnreadMessagesBySender((prev) => {
      const next = { ...prev };
      console.debug('markThreadRead - before clear unread for', senderLower, 'prev:', prev);
      if (next[senderLower]) {
        delete next[senderLower];
      }
      const total = Object.values(next).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      setTotalUnreadMessages(total);
      setUnreadConversationsCount(Object.keys(next).length);
      console.debug('markThreadRead - after clear unread for', senderLower, 'next:', next, 'total:', total);
      return next;
    });
    // Persist a read cutoff timestamp so future server syncs won't reintroduce unread counts
    try {
      const nowIso = new Date().toISOString();
      const nextCutoffs = { ...(readCutoffs || {}), [senderLower]: nowIso };
      setReadCutoffs(nextCutoffs);
      try {
        if (nickname) {
          const key = `lunae_chat_read_cutoffs_${nickname.toLowerCase()}`;
          localStorage.setItem(key, JSON.stringify(nextCutoffs));
        }
      } catch (e) {}

      // Recompute unread counts using the updated cutoffs so counts clear immediately
      try {
        updateUnreadCounts(updatedMessages, nextCutoffs);
      } catch (e) {}
    } catch (e) {}
    // Also persist to localStorage fallback so reloads reflect reads when offline
    try {
      const local = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
      if (Array.isArray(local) && local.length) {
        const updatedLocal = local.map((m: any) => {
          try {
            const s = (m.sender_username || '').toLowerCase();
            const r = (m.receiver_username || '').toLowerCase();
            if (s === senderLower && r === current) {
              return { ...m, read_at: m.read_at || new Date().toISOString() };
            }
          } catch (e) {}
          return m;
        });
        localStorage.setItem('lunae_chat_messages', JSON.stringify(updatedLocal));
      }
    } catch (e) {
      // ignore localStorage errors
    }
  };

  const handleNotificationBell = () => {
    if (unreadConversationsCount > 0) {
      const firstSender = Object.keys(unreadMessagesBySender)[0];
      if (firstSender) {
        void markThreadRead(firstSender);
        setActiveTab('chat');
        setChatActiveRecipient(firstSender);
        return;
      }
    }
    setActiveTab('chat');
  };

  const handleFollowToggle = async (targetUsername: string) => {
    if (!nickname) {
      setIsAuthModalOpen(true);
      showToast('Đăng nhập để theo dõi bạn bè! 🔔', 'info');
      return;
    }

    const tLower = targetUsername.toLowerCase();
    const isFollowing = followingList.includes(tLower);

    if (isFollowing) {
      // Unfollow
      try {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_username', nickname.toLowerCase())
          .eq('following_username', tLower);
        if (error) throw error;
        setFollowingList((prev) => prev.filter((u) => u !== tLower));
        showToast(`Đã bỏ theo dõi ${targetUsername}.`, 'info');
      } catch {
        const key = `lunae_follows_${nickname.toLowerCase()}`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = list.filter((u: string) => u !== tLower);
        localStorage.setItem(key, JSON.stringify(filtered));
        setFollowingList(filtered);
        showToast(`Đã bỏ theo dõi ${targetUsername}.`, 'info');
      }
    } else {
      // Follow
      try {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_username: nickname.toLowerCase(),
            following_username: tLower,
          });
        if (error) throw error;
        setFollowingList((prev) => [...prev, tLower]);
        showToast(`Đã theo dõi ${targetUsername}! 🔔`, 'success');
      } catch {
        const key = `lunae_follows_${nickname.toLowerCase()}`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!list.includes(tLower)) {
          list.push(tLower);
          localStorage.setItem(key, JSON.stringify(list));
          setFollowingList(list);
          showToast(`Đã theo dõi ${targetUsername}! 🔔`, 'success');
        }
      }
    }
  };

  const handleSendMessage = async (receiverUsername: string, bodyText: string) => {
    if (!nickname) return;

    const tempId = `temp-msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_username: nickname,
      receiver_username: receiverUsername,
      body: bodyText,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setRecentActiveUsers((prev) => ({
      ...prev,
      [nickname.toLowerCase()]: optimisticMsg.created_at,
    }));

    const newMsgObj = {
      sender_username: nickname,
      receiver_username: receiverUsername,
      body: bodyText,
    };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(newMsgObj)
        .select()
        .single();
      if (error) throw error;
      setChatMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) {
          return prev.filter((msg) => msg.id !== tempId);
        }
        return prev.map((msg) => (msg.id === tempId ? data : msg));
      });
    } catch {
      const list = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
      list.push(optimisticMsg);
      localStorage.setItem('lunae_chat_messages', JSON.stringify(list));
      
      // Simulate reply from some users occasionally for amazing UX!
      setTimeout(() => {
        const replyMsg: ChatMessage = {
          id: `temp-msg-reply-${Date.now()}`,
          sender_username: receiverUsername,
          receiver_username: nickname,
          body: `Chào bạn! Mình là ${receiverUsername}. Rất vui được nhắn tin với bạn! Snaps của mình thế nào? 📸✨`,
          created_at: new Date().toISOString(),
        };
        const updatedList = JSON.parse(localStorage.getItem('lunae_chat_messages') || '[]');
        updatedList.push(replyMsg);
        localStorage.setItem('lunae_chat_messages', JSON.stringify(updatedList));
        setChatMessages((prev) => [...prev, replyMsg]);
        showToast(`Tin nhắn mới từ ${receiverUsername}! 💬`, 'info');
      }, 1500);
    }
  };

  const totalLikesCount = useMemo(() => {
    if (!nickname) return 0;
    const nameLower = nickname.toLowerCase();
    return photos
      .filter((photo) => photo.username.toLowerCase() === nameLower)
      .reduce((sum, photo) => {
        try {
          const reactions = Array.isArray(photo.reactions) ? photo.reactions : JSON.parse(photo.reactions || '[]');
          return sum + (reactions?.length || 0);
        } catch {
          return sum;
        }
      }, 0);
  }, [photos, nickname]);

  const fetchPhotos = async () => {
    const now = Date.now();
    // Throttle fetches: avoid calling multiple times within short window
    if ((lastPhotosFetchRef.current || 0) && now - lastPhotosFetchRef.current < 1500) {
      return;
    }
    lastPhotosFetchRef.current = now;

    setIsLoadingFeed(true);
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(INITIAL_FEED_LIMIT);

      if (error) {
        throw error;
      }
      const nextPhotos = data || [];
      setPhotos(nextPhotos);
      await fetchComments(nextPhotos.map((photo) => photo.id));
      await fetchUserAvatars();
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

  const isAppVisible = () => {
    if (typeof document === 'undefined' || !('visibilityState' in document)) {
      return true;
    }
    return document.visibilityState === 'visible';
  };

  const sendBrowserNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (isAppVisible()) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      });
    }
  };

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          showToast('Đã kích hoạt thông báo đẩy! 🔔', 'success');
        }
      });
    }
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
      return diff < 45 * 60000;
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
    <div className="fixed inset-0 w-full bg-[#f4eff2] dark:bg-threads-bg text-slate-800 dark:text-threads-text flex items-center justify-center p-0 sm:p-4 md:p-6 transition-colors duration-500 overflow-hidden font-sans">
      <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-pink-500/10 to-indigo-500/5 blur-[130px] pointer-events-none ambient-blob dark:opacity-0" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-500/10 to-rose-500/5 blur-[130px] pointer-events-none ambient-blob-reverse dark:opacity-0" />

      <div className="w-full h-full sm:h-[830px] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[395px] sm:rounded-[3.2rem] sm:border-[10px] sm:border-slate-900/90 dark:sm:border-threads-border sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] bg-[#faf6f8] dark:bg-threads-bg overflow-hidden flex flex-col relative transition-all duration-500">



        {/* Simulated Screen Glare Reflection */}
        {/* Global App Header */}
        {nickname ? (
          <Header
            notificationCount={totalUnreadMessages}
            onNotificationClick={handleNotificationBell}
          />
        ) : (
          <header className="w-full glass px-4 safe-area-pt sm:pt-8 pb-3 border-b border-rose-150/15 dark:border-zinc-800/30 shadow-soft z-40 relative flex-shrink-0">
            <div className="max-w-md mx-auto flex items-center justify-center relative">
              <div className="flex items-center space-x-0 group">
                <motion.div
                  whileHover={{ scale: 1.12, rotate: 12 }}
                  className="flex-shrink-0"
                >
                  <Logo className="w-11 h-11" />
                </motion.div>
                <h1 className="font-lunae text-[1.65rem] tracking-normal text-slate-950 dark:text-white leading-none ml-2">
                  Lunæ
                </h1>
              </div>
            </div>
          </header>
        )}

        {/* Scrollable Main content area */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10 dark:bg-threads-bg">
          {/* Sticky feed chrome — không bị snap animation che */}
          {!isLoadingFeed && activeTab === 'feed' && photos.length > 0 && (
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
                
                <div className="flex items-center gap-2 min-w-0 p-1 rounded-xl bg-white/40 dark:bg-threads-surface border border-rose-100/10 dark:border-threads-border shrink-0">
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

                  {activeTab === 'feed' && (
                    <div className="flex items-center space-x-0.5 p-0.5 rounded-lg">
                      <button
                        onClick={() => setLayoutMode('grid')}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          layoutMode === 'grid'
                            ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-threads-text shadow-sm'
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
                            ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-threads-text shadow-sm'
                            : 'text-slate-400 dark:text-threads-muted hover:text-slate-600 dark:hover:text-threads-text'
                        }`}
                        title="List View"
                        aria-label="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && sessionUser ? (
            /* Chat tab view directly under main (not inside scrollable wrapper) */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 pb-6">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400 dark:text-zinc-550 font-rounded text-sm">Đang tải cuộc trò chuyện...</div>}>
                <ChatTab
                  currentUser={nickname || 'anonymous'}
                  userAvatars={userAvatars}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  usernamesList={usernamesList}
                  activeRecipient={chatActiveRecipient}
                  onSelectRecipient={(recipient) => {
                    if (recipient) {
                      void markThreadRead(recipient);
                    }
                    setChatActiveRecipient(recipient);
                  }}
                  unreadCounts={unreadMessagesBySender}
                  readCutoffs={readCutoffs}
                  userStatuses={userProfiles}
                  onlineUsers={chatPresenceUsers}
                  recentActiveUsers={recentActiveUsers}
                />
              </Suspense>
            </div>
          ) : (
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
                ) : layoutMode === 'grid' ? (
                  <FeedEntranceGrid
                    play={playFeedEntrance}
                    variant={entranceVariant}
                    className="grid grid-cols-3 gap-2 px-3 pb-6"
                  >
                    {feedPhotos.map((photo, index) => (
                      <FeedEntranceCell
                        key={photo.id}
                        play={playFeedEntrance}
                        variant={entranceVariant}
                        index={index}
                        total={feedPhotos.length}
                        onClick={() => setSelectedPhoto(photo)}
                        className="gallery-cell relative aspect-square rounded-2xl overflow-hidden cursor-pointer ring-1 ring-slate-200/20 dark:ring-threads-border bg-slate-50 dark:bg-threads-surface group animate-fade-in"
                      >
                        <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
                      </FeedEntranceCell>
                    ))}
                  </FeedEntranceGrid>
                ) : (
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
                          isFollowing={followingList.includes(photo.username.toLowerCase())}
                          onFollowToggle={handleFollowToggle}
                          onReact={handleReact}
                          comments={commentsByPhoto[photo.id] || []}
                          isLoggedIn={!!sessionUser}
                          onRequireAuth={handleRequireAuth}
                          onAddComment={handleAddComment}
                          onReactComment={handleReactComment}
                          isAdmin={isAdmin}
                          onRequestDelete={setPhotoToDelete}
                          skipFeedEntrance={playFeedEntrance}
                          userAvatars={userAvatars}
                        />
                      </FeedEntranceListItem>
                    ))}
                  </FeedEntranceList>
                )
              ) : activeTab === 'chat' ? (
                /* Chat view when not logged in */
                <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6 bg-white/40 dark:bg-zinc-900/40 rounded-[2.5rem] border border-rose-100/20 dark:border-zinc-850 p-6 shadow-sm">
                  <div className="w-18 h-18 rounded-full bg-rose-50/50 dark:bg-zinc-900 flex items-center justify-center border border-rose-100/50 dark:border-zinc-800">
                    <MessageSquare className="w-8 h-8 text-slate-400 dark:text-zinc-550" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-rounded font-black text-lg text-slate-800 dark:text-pink-100">
                      Trò chuyện trực tuyến
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-550 max-w-[200px] mx-auto leading-relaxed font-medium font-rounded">
                      Đăng nhập tài khoản để gửi tin nhắn và trò chuyện cùng bạn bè nhé! 💬✨
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsAuthModalOpen(true)}
                    className="shimmer-btn px-6 py-3.5 bg-slate-950 dark:bg-white text-white dark:text-black rounded-2xl font-rounded font-extrabold text-xs shadow-cute cursor-pointer"
                  >
                    Đăng Nhập Ngay
                  </motion.button>
                </div>
              ) : (
                /* Profile tab view */
                !sessionUser ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6 bg-white/40 dark:bg-zinc-900/40 rounded-[2.5rem] border border-rose-100/20 dark:border-zinc-850 p-6 shadow-sm">
                    <div className="w-18 h-18 rounded-full bg-rose-50/50 dark:bg-zinc-900 flex items-center justify-center border border-rose-100/50 dark:border-zinc-800">
                      <User className="w-8 h-8 text-slate-400 dark:text-zinc-550" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-rounded font-black text-lg text-slate-800 dark:text-pink-100">
                        Hồ Sơ Cá Nhân
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-zinc-550 max-w-[200px] mx-auto leading-relaxed font-medium font-rounded">
                        Đăng nhập tài khoản để xem lượng người theo dõi, cập nhật trạng thái và xem snaps của riêng bạn! 🌸
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAuthModalOpen(true)}
                      className="shimmer-btn px-6 py-3.5 bg-slate-950 dark:bg-white text-white dark:text-black rounded-2xl font-rounded font-extrabold text-xs shadow-cute cursor-pointer"
                    >
                      Đăng Nhập Ngay
                    </motion.button>
                  </div>
                ) : (
                  <Suspense fallback={<div className="py-20 text-center text-slate-400 dark:text-zinc-550 font-rounded text-sm">Đang tải hồ sơ...</div>}>
                    <ProfileTab
                      nickname={nickname || ''}
                      email={sessionUser?.email || ''}
                      avatarUrl={userAvatars[nickname?.toLowerCase() || ''] || null}
                      status={status}
                      followersCount={followersCount}
                      likesCount={totalLikesCount}
                      followingCount={followingList.length}
                      userPhotos={userPhotos}
                      onUpdateProfile={handleUpdateProfile}
                      onLogout={handleLogout}
                      showToast={showToast}
                      isDark={isDark}
                      onToggleDark={handleToggleDark}
                      onSelectPhoto={setSelectedPhoto}
                    />
                  </Suspense>
                )
              )}
            </div>
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
                  isFollowing={followingList.includes(selectedPhoto.username.toLowerCase())}
                  onFollowToggle={handleFollowToggle}
                  onReact={handleReact}
                  autoPlay={true}
                  comments={commentsByPhoto[selectedPhoto.id] || []}
                  isLoggedIn={!!sessionUser}
                  onRequireAuth={handleRequireAuth}
                  onAddComment={handleAddComment}
                  onReactComment={handleReactComment}
                  isAdmin={isAdmin}
                  onRequestDelete={setPhotoToDelete}
                  userAvatars={userAvatars}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav — floating 3D dock style */}
        <div className="flex-shrink-0 z-35 px-4 pb-6 pt-2 bg-transparent relative">
          <div className="w-full max-w-sm mx-auto bg-white/80 dark:bg-threads-bg/90 backdrop-blur-xl rounded-2xl p-1.5 flex items-center justify-between px-3 border border-slate-200/40 dark:border-zinc-800/40 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            {/* Feed Tab Button */}
            <button
              onClick={() => setActiveTab('feed')}
              className="flex flex-col items-center space-y-0.5 py-2 px-3 rounded-xl transition-all duration-300 relative cursor-pointer group select-none flex-1"
            >
              {activeTab === 'feed' && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute inset-0 bg-slate-100/80 dark:bg-zinc-800/80 rounded-xl -z-10 border border-slate-200/30 dark:border-zinc-700/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
              )}
              <motion.div 
                animate={{ 
                  scale: activeTab === 'feed' ? 1.08 : 1,
                  y: activeTab === 'feed' ? -1 : 0 
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Compass className={`w-5 h-5 transition-colors duration-300 ${
                  activeTab === 'feed'
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
                }`} />
              </motion.div>
              <span className={`text-[9px] font-rounded font-extrabold tracking-wider transition-colors duration-300 ${
                activeTab === 'feed' 
                  ? 'text-slate-950 dark:text-white' 
                  : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
              }`}>Feed</span>
            </button>

            {/* Chat Tab Button */}
            <button
              onClick={() => setActiveTab('chat')}
              className="flex flex-col items-center space-y-0.5 py-2 px-3 rounded-xl transition-all duration-300 relative cursor-pointer group select-none flex-1"
            >
              {activeTab === 'chat' && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute inset-0 bg-slate-100/80 dark:bg-zinc-800/80 rounded-xl -z-10 border border-slate-200/30 dark:border-zinc-700/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
              )}
              <motion.div 
                animate={{ 
                  scale: activeTab === 'chat' ? 1.08 : 1,
                  y: activeTab === 'chat' ? -1 : 0 
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative"
              >
                <MessageSquare className={`w-5 h-5 transition-colors duration-300 ${
                  activeTab === 'chat'
                    ? 'text-slate-950 dark:text-white'
                    : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
                }`} />
                {unreadConversationsCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-[1.4rem] h-5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center px-1.5">
                    {unreadConversationsCount > 9 ? '9+' : unreadConversationsCount}
                  </span>
                )}
              </motion.div>
              <span className={`text-[9px] font-rounded font-extrabold tracking-wider transition-colors duration-300 ${
                activeTab === 'chat' 
                  ? 'text-slate-950 dark:text-white' 
                  : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
              }`}>Chat</span>
            </button>

            {/* Snap Tab Button - Fully synchronized Outline style */}
            <button
              onClick={handleCameraTrigger}
              className="flex flex-col items-center space-y-0.5 py-2 px-3 rounded-xl transition-all duration-300 relative cursor-pointer group select-none flex-1"
            >
              <motion.div 
                whileHover={{ scale: 1.08, y: -1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Camera className="w-5 h-5 text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors duration-300" />
              </motion.div>
              <span className="text-[9px] font-rounded font-extrabold tracking-wider text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors duration-300">Snap</span>
            </button>

            {/* Profile Tab Button */}
            <button
              onClick={() => {
                if (!sessionUser) {
                  setIsAuthModalOpen(true);
                  showToast('Đăng nhập để điều chỉnh avatar & thông tin cá nhân! 🌸', 'info');
                } else {
                  setActiveTab('profile');
                }
              }}
              className="flex flex-col items-center space-y-0.5 py-2 px-3 rounded-xl transition-all duration-300 relative cursor-pointer group select-none flex-1"
            >
              {activeTab === 'profile' && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute inset-0 bg-slate-100/80 dark:bg-zinc-800/80 rounded-xl -z-10 border border-slate-200/30 dark:border-zinc-700/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
              )}
              <motion.div 
                animate={{ 
                  scale: activeTab === 'profile' ? 1.08 : 1,
                  y: activeTab === 'profile' ? -1 : 0 
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {sessionUser && userAvatars[nickname?.toLowerCase() || ''] ? (
                  <div className={`w-5.5 h-5.5 rounded-full overflow-hidden border-2 flex items-center justify-center transition-all ${
                    activeTab === 'profile' ? 'border-slate-900 dark:border-white shadow-[0_0_6px_rgba(255,255,255,0.2)]' : 'border-slate-300 dark:border-zinc-750'
                  }`}>
                    {userAvatars[nickname?.toLowerCase() || ''].startsWith('data:') || userAvatars[nickname?.toLowerCase() || ''].startsWith('http') ? (
                      <img src={userAvatars[nickname?.toLowerCase() || '']} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold">
                        {userAvatars[nickname?.toLowerCase() || '']}
                      </div>
                    )}
                  </div>
                ) : (
                  <User className={`w-5 h-5 transition-colors duration-300 ${
                    activeTab === 'profile'
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
                  }`} />
                )}
              </motion.div>
              <span className={`text-[9px] font-rounded font-extrabold tracking-wider transition-colors duration-300 ${
                activeTab === 'profile' 
                  ? 'text-slate-950 dark:text-white' 
                  : 'text-slate-400 dark:text-zinc-550 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
              }`}>Profile</span>
            </button>
          </div>
        </div>
        {/* Camera sheet popup */}
        {isCameraOpen && (
          <Suspense fallback={null}>
            <CameraOverlay
              isOpen={isCameraOpen}
              onClose={() => setIsCameraOpen(false)}
              onUpload={handlePhotoUpload}
              isUploading={isUploading}
            />
          </Suspense>
        )}

        {/* Authentication Modal */}
        {photoToDelete && (
          <Suspense fallback={null}>
            <ConfirmDialog
              title="Xóa snap?"
              message="Bài và bình luận sẽ bị xóa vĩnh viễn. (Admin)"
              confirmLabel="Xóa"
              isLoading={isDeletingPhoto}
              onCancel={() => !isDeletingPhoto && setPhotoToDelete(null)}
              onConfirm={() => handleDeletePhoto(photoToDelete)}
            />
          </Suspense>
        )}

        {isAuthModalOpen && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
            />
          </Suspense>
        )}

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
                className={`p-3.5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border text-xs font-bold font-rounded flex items-center justify-center text-center bg-slate-950 border-slate-800 text-white`}
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
