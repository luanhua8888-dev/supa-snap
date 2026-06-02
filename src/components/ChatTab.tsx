import React, { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ArrowLeft, Search, User, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender_username: string;
  receiver_username: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

interface ChatTabProps {
  currentUser: string;
  userAvatars: Record<string, string>;
  messages: ChatMessage[];
  onSendMessage: (receiver: string, text: string) => Promise<void>;
  usernamesList: string[];
  activeRecipient: string | null;
  onSelectRecipient: (recipient: string | null) => void;
  unreadCounts: Record<string, number>;
  userStatuses: Record<string, { last_seen_at?: string; status?: string }>;
  readCutoffs?: Record<string, string>;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  currentUser,
  userAvatars,
  messages,
  onSendMessage,
  usernamesList,
  activeRecipient,
  onSelectRecipient,
  unreadCounts,
  userStatuses,
  readCutoffs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages or active recipient changes without scrolling the main viewport
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, activeRecipient]);

  // Unique list of users we have chatted with
  const chatPartners = useMemo(() => {
    const partners = new Set<string>();
    const current = currentUser.toLowerCase();

    messages.forEach((msg) => {
      const sender = msg.sender_username.toLowerCase();
      const receiver = msg.receiver_username.toLowerCase();

      if (sender === current && receiver !== current) {
        partners.add(msg.receiver_username);
      } else if (receiver === current && sender !== current) {
        partners.add(msg.sender_username);
      }
    });

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const searchResults = usernamesList.filter(
      (username) =>
        username.toLowerCase() !== current &&
        username.toLowerCase().includes(normalizedSearch)
    );

    const merged = Array.from(partners);
    if (normalizedSearch) {
      searchResults.forEach((user) => {
        if (!merged.some((u) => u.toLowerCase() === user.toLowerCase())) {
          merged.push(user);
        }
      });
    }

    if (merged.length === 0) {
      return searchResults;
    }

    return merged;
  }, [messages, currentUser, usernamesList, searchQuery]);

  // Last message and time for each partner
  const partnerDetails = useMemo(() => {
    const details: Record<string, { lastMessage: string; lastTime: string; timestamp: number }> = {};
    
    chatPartners.forEach((partner) => {
      const partnerMsgs = messages.filter((msg) => {
        const s = msg.sender_username.toLowerCase();
        const r = msg.receiver_username.toLowerCase();
        const p = partner.toLowerCase();
        const c = currentUser.toLowerCase();
        return (s === c && r === p) || (s === p && r === c);
      });

      if (partnerMsgs.length > 0) {
        const last = partnerMsgs[partnerMsgs.length - 1];
        const date = new Date(last.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        details[partner.toLowerCase()] = {
          lastMessage: last.body,
          lastTime: timeStr,
          timestamp: date.getTime(),
        };
      } else {
        details[partner.toLowerCase()] = {
          lastMessage: 'Chưa có tin nhắn. Bắt đầu trò chuyện! ✨',
          lastTime: '',
          timestamp: 0,
        };
      }
    });

    return details;
  }, [chatPartners, messages, currentUser]);

  // Sort partners by last message timestamp (most recent first)
  const sortedPartners = useMemo(() => {
    return [...chatPartners].sort((a, b) => {
      const timeA = partnerDetails[a.toLowerCase()]?.timestamp || 0;
      const timeB = partnerDetails[b.toLowerCase()]?.timestamp || 0;
      return timeB - timeA;
    });
  }, [chatPartners, partnerDetails]);

  // Filter messages for active thread
  const getStatusText = (username: string) => {
    const status = userStatuses[username.toLowerCase()];
    if (!status?.last_seen_at) return 'Offline';
    const ageMs = Date.now() - new Date(status.last_seen_at).getTime();
    if (ageMs < 120000) return 'Online';
    const minutes = Math.max(1, Math.round(ageMs / 60000));
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(minutes / 60);
    return `${hours} giờ trước`;
  };

  const activeMessages = useMemo(() => {
    if (!activeRecipient) return [];
    const rLower = activeRecipient.toLowerCase();
    const cLower = currentUser.toLowerCase();

    return messages.filter((msg) => {
      const s = msg.sender_username.toLowerCase();
      const r = msg.receiver_username.toLowerCase();
      return (s === cLower && r === rLower) || (s === rLower && r === cLower);
    });
  }, [messages, activeRecipient, currentUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeRecipient || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(activeRecipient, text.trim());
      setText('');
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
    } finally {
      setIsSending(false);
    }
  };

  const getPartnerAvatar = (partner: string) => {
    return userAvatars[partner.toLowerCase()] || '';
  };

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col bg-white dark:bg-threads-bg border border-slate-100/20 dark:border-threads-border rounded-[2rem] overflow-hidden shadow-cute dark:shadow-none relative">
      <AnimatePresence mode="wait">
        {!activeRecipient ? (
          // Conversation list view
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-150/10 dark:border-threads-border flex items-center justify-between">
              <h2 className="text-lg font-black font-rounded text-slate-800 dark:text-threads-text flex items-center gap-1.5 pl-1.5">
                <MessageSquare className="w-5 h-5 text-slate-900 dark:text-white" />
                Trò chuyện
              </h2>
              <span className="text-[10px] font-extrabold font-rounded bg-slate-900/5 dark:bg-white/5 border px-2.5 py-1 rounded-full text-slate-500 dark:text-threads-muted">
                {currentUser}
              </span>
            </div>

            {/* Search Box */}
            <div className="p-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-threads-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm bạn trò chuyện..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-slate-50 dark:bg-threads-surface border border-slate-100 dark:border-threads-border text-slate-700 dark:text-threads-text placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-6">
              {sortedPartners.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-center mx-auto border border-slate-100 dark:border-zinc-800">
                    <User className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                  </div>
                  <p className="text-xs text-slate-450 dark:text-zinc-500 font-medium">
                    Không tìm thấy người dùng nào 🌸
                  </p>
                </div>
              ) : (
                sortedPartners.map((partner) => {
                  const avatar = getPartnerAvatar(partner);
                  const detail = partnerDetails[partner.toLowerCase()];
                  // debug partner/unread mapping
                  // eslint-disable-next-line no-console
                  console.debug('ChatTab partner render', partner, 'lower:', partner.toLowerCase(), 'unread:', unreadCounts[partner.toLowerCase()]);
                  
                  return (
                    <motion.button
                      key={partner}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectRecipient(partner);
                      }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-threads-hover transition-colors text-left border-b border-slate-100/10 dark:border-threads-border/20 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-threads-elevated flex items-center justify-center font-bold text-xs overflow-hidden relative shadow-sm border border-slate-200/40 dark:border-zinc-800">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          partner.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-sm text-slate-800 dark:text-threads-text">
                              {partner}
                            </span>
                            <span className="ml-2 text-[9px] text-slate-500 dark:text-threads-muted font-medium">
                              {getStatusText(partner)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-threads-muted font-medium">
                            {detail?.lastTime}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-450 dark:text-threads-muted truncate font-medium">
                            {detail?.lastMessage}
                          </p>
                          {unreadCounts[partner.toLowerCase()] && partner.toLowerCase() !== (activeRecipient || '').toLowerCase() ? (
                            <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                              {unreadCounts[partner.toLowerCase()] > 9 ? '9+' : unreadCounts[partner.toLowerCase()]}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : (
          // Active chat window view
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-threads-bg"
          >
            {/* Active thread header */}
            <div className="p-3.5 bg-white dark:bg-threads-bg border-b border-slate-150/10 dark:border-threads-border flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectRecipient(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-threads-hover text-slate-500 dark:text-threads-muted cursor-pointer transition-colors"
                aria-label="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-threads-elevated flex items-center justify-center font-bold text-xs overflow-hidden relative border border-slate-200/40 dark:border-zinc-800">
                {getPartnerAvatar(activeRecipient || '') ? (
                  <img src={getPartnerAvatar(activeRecipient || '')} alt="" className="w-full h-full object-cover" />
                ) : (
                  (activeRecipient || '').substring(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-800 dark:text-threads-text truncate">
                  {activeRecipient}
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-threads-muted font-extrabold flex items-center gap-1 mt-0.5">
                  {activeRecipient ? getStatusText(activeRecipient) : 'Đang hoạt động'}
                </span>
              </div>
            </div>

            {/* Messages box stream */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 pb-8"
            >
              {activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-threads-surface flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-threads-muted font-bold max-w-[200px] leading-relaxed">
                    Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện với {activeRecipient}!
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMine = msg.sender_username.toLowerCase() === currentUser.toLowerCase();
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-sm break-words border ${
                          isMine
                            ? 'bg-slate-950 text-white border-transparent rounded-tr-none'
                            : 'bg-white dark:bg-threads-surface text-slate-800 dark:text-threads-text border-slate-100/50 dark:border-threads-border rounded-tl-none'
                        }`}
                      >
                        <p>{msg.body}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[8.5px]">
                          <span className={`block ${isMine ? 'text-white/60' : 'text-slate-400 dark:text-threads-muted'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && msg.read_at ? (
                            <span className="text-[8px] text-emerald-500 font-bold">Đã xem</span>
                          ) : !isMine && !msg.read_at ? (
                            (() => {
                              const sender = msg.sender_username.toLowerCase();
                              const cutoff = readCutoffs?.[sender];
                              const createdMs = Date.parse(msg.created_at || '') || 0;
                              const cutoffMs = cutoff ? Date.parse(cutoff) || 0 : 0;
                              if (cutoff && createdMs <= cutoffMs) return null;
                              return <span className="text-[8px] text-rose-500 font-bold">Mới</span>;
                            })()
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form container */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-white dark:bg-threads-bg border-t border-slate-150/10 dark:border-threads-border flex items-end gap-2"
            >
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-4 py-3 rounded-2xl text-xs font-semibold bg-slate-50 dark:bg-threads-surface border border-slate-100 dark:border-threads-border text-slate-700 dark:text-threads-text focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || isSending}
                className="w-10 h-10 rounded-2xl bg-slate-950 dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
                aria-label="Gửi tin nhắn"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
