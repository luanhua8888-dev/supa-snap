import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  User,
  LogOut,
  Check,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Users,
  MessageSquare,
  Image,
  Upload,
  PenLine,
} from 'lucide-react';
import type { PhotoData } from './PhotoCard';
import { GalleryThumb } from './GalleryThumb';

const PRESET_AVATARS = ['🦊', '🐱', '🐼', '🦁', '🐨', '🦄', '🐰', '🐯', '🐧', '👾', '👻', '🌟', '🔮', '🍀'];

interface ProfileTabProps {
  nickname: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  userPhotos: PhotoData[];
  onUpdateProfile: (newNickname: string, newAvatar: string, newStatus: string) => Promise<void>;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  isDark: boolean;
  onToggleDark: () => void;
  onSelectPhoto: (photo: PhotoData) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  nickname,
  email,
  avatarUrl,
  status,
  followersCount,
  followingCount,
  likesCount,
  userPhotos,
  onUpdateProfile,
  onLogout,
  showToast,
  isDark,
  onToggleDark,
  onSelectPhoto,
}) => {
  const [name, setName] = useState(nickname);
  const [avatar, setAvatar] = useState(avatarUrl || '🦊');
  const [bio, setBio] = useState(status || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(nickname);
  }, [nickname]);

  useEffect(() => {
    setAvatar(avatarUrl || '🦊');
  }, [avatarUrl]);

  useEffect(() => {
    setBio(status || '');
  }, [status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Kích thước ảnh phải nhỏ hơn 2MB!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatar(base64String);
      showToast('Đã chọn ảnh đại diện mới.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Biệt danh không được để trống.', 'error');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 15) {
      showToast('Biệt danh phải từ 2 đến 15 ký tự.', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateProfile(trimmed, avatar, bio.trim());
      showToast('Cập nhật hồ sơ thành công.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi cập nhật: ' + (err?.message || 'Không rõ'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const isCustomImage = avatar.startsWith('data:image/') || avatar.startsWith('http');

  const isLive = (createdAt: string) => {
    try {
      const timeDiff = Date.now() - new Date(createdAt).getTime();
      return timeDiff < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const stats = [
    { label: 'Theo dõi', value: followersCount, icon: Users },
    { label: 'Đang theo dõi', value: followingCount, icon: User },
    { label: 'Lượt thích', value: likesCount, icon: Heart },
    { label: 'Snaps', value: userPhotos.length, icon: Image },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-3 py-3 pb-28 select-none space-y-4 text-slate-900 dark:text-threads-text">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 dark:border-threads-border bg-white dark:bg-threads-bg shadow-[0_18px_55px_rgba(15,23,42,0.10)] dark:shadow-none"
      >
        <div className="h-24 bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.30),transparent_34%),linear-gradient(135deg,#111827,#334155_52%,#e5e7eb)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(135deg,#050505,#18181b_55%,#3f3f46)]" />

        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="w-24 h-24 rounded-full bg-white dark:bg-threads-bg p-1 shadow-[0_16px_40px_rgba(0,0,0,0.20)]"
              >
                <div className="w-full h-full rounded-full bg-slate-100 dark:bg-threads-surface flex items-center justify-center overflow-hidden border border-white/80 dark:border-threads-border">
                  {isCustomImage ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{avatar}</span>
                  )}
                </div>
              </motion.div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={triggerUpload}
                type="button"
                className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-slate-950 dark:bg-white text-white dark:text-black border-2 border-white dark:border-threads-bg shadow-lg flex items-center justify-center cursor-pointer"
                title="Tải ảnh lên"
              >
                <Camera className="w-4 h-4" />
              </motion.button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-2 pb-1">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={onToggleDark}
                type="button"
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-threads-surface border border-slate-200 dark:border-threads-border text-slate-700 dark:text-threads-text flex items-center justify-center cursor-pointer"
                aria-label="Toggle theme"
                title="Đổi giao diện"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={onLogout}
                type="button"
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-threads-surface border border-slate-200 dark:border-threads-border text-slate-700 dark:text-threads-text flex items-center justify-center cursor-pointer"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-rounded text-2xl font-black tracking-normal truncate text-slate-950 dark:text-white">
                {nickname}
              </h2>
              <Sparkles className="w-4 h-4 shrink-0 text-rose-500 dark:text-zinc-300" />
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-threads-muted truncate">
              {email}
            </p>
            <p className="mt-3 min-h-[38px] text-sm leading-relaxed text-slate-700 dark:text-zinc-300 font-medium">
              {bio.trim() || 'Chưa có trạng thái.'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="min-w-0 rounded-2xl bg-slate-50 dark:bg-threads-surface border border-slate-100 dark:border-threads-border px-2.5 py-3 text-center"
                >
                  <Icon className="w-4 h-4 mx-auto text-slate-500 dark:text-threads-muted" />
                  <p className="mt-1.5 text-base font-black text-slate-950 dark:text-white">{item.value}</p>
                  <p className="mt-0.5 text-[8.5px] leading-tight font-extrabold text-slate-400 dark:text-threads-muted uppercase tracking-wide">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        onSubmit={handleSave}
        className="rounded-[2rem] border border-slate-200/70 dark:border-threads-border bg-white dark:bg-threads-bg p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-rounded font-black text-sm text-slate-950 dark:text-white">Chỉnh sửa hồ sơ</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-threads-muted truncate">
              Cập nhật avatar, tên và trạng thái
            </p>
          </div>
          <PenLine className="w-4 h-4 text-slate-400 dark:text-threads-muted shrink-0" />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 dark:text-threads-muted uppercase tracking-wider mb-2">
            Avatar
          </label>
          <div className="flex gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar snap-x">
            {PRESET_AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                className={`w-10 h-10 flex-shrink-0 text-xl flex items-center justify-center rounded-2xl border transition-all cursor-pointer snap-center ${
                  avatar === emoji
                    ? 'bg-slate-950 dark:bg-white text-white dark:text-black border-slate-950 dark:border-white shadow-md scale-105'
                    : 'bg-slate-50 dark:bg-threads-surface border-slate-200 dark:border-threads-border hover:scale-105'
                }`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={triggerUpload}
              className="w-10 h-10 flex-shrink-0 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-threads-surface text-slate-500 dark:text-threads-muted flex items-center justify-center cursor-pointer"
              title="Tải ảnh lên"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-threads-muted uppercase tracking-wider mb-1.5">
              Biệt danh
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-threads-muted" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-threads-surface border border-slate-200 dark:border-threads-border focus:bg-white dark:focus:bg-threads-elevated focus:outline-none focus:ring-2 focus:ring-slate-950/10 dark:focus:ring-white/10 transition-all text-sm font-bold text-slate-900 dark:text-white"
                placeholder="Nhập biệt danh"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-threads-muted uppercase tracking-wider mb-1.5">
              Trạng thái
            </label>
            <div className="relative flex items-center">
              <MessageSquare className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-threads-muted" />
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={60}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-threads-surface border border-slate-200 dark:border-threads-border focus:bg-white dark:focus:bg-threads-elevated focus:outline-none focus:ring-2 focus:ring-slate-950/10 dark:focus:ring-white/10 transition-all text-sm font-bold text-slate-900 dark:text-white"
                placeholder="Hôm nay bạn thế nào?"
              />
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isUpdating}
          className="w-full h-12 bg-slate-950 dark:bg-white text-white dark:text-black font-rounded font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-[0_14px_35px_rgba(15,23,42,0.20)] dark:shadow-none"
        >
          {isUpdating ? (
            <span className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Lưu thay đổi</span>
            </>
          )}
        </motion.button>
      </motion.form>

      <section className="w-full space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black font-rounded text-slate-950 dark:text-white">Snap của tôi</h3>
          <span className="text-[10px] font-extrabold font-rounded bg-white dark:bg-threads-surface border border-slate-200 dark:border-threads-border px-3 py-1 rounded-full text-slate-500 dark:text-threads-muted">
            {userPhotos.length} snaps
          </span>
        </div>

        {userPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 space-y-3 bg-white dark:bg-threads-bg border border-slate-200 dark:border-threads-border rounded-[2rem]">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-threads-surface flex items-center justify-center border border-slate-200 dark:border-threads-border text-slate-500 dark:text-threads-muted">
              <Image className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 dark:text-threads-muted font-semibold max-w-[220px] leading-relaxed">
              Bạn chưa đăng snap nào.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-6">
            {userPhotos.map((photo) => (
              <motion.button
                key={photo.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectPhoto(photo)}
                className="gallery-cell relative aspect-square rounded-2xl overflow-hidden cursor-pointer ring-1 ring-slate-200/80 dark:ring-threads-border bg-slate-100 dark:bg-threads-surface group shadow-[0_12px_30px_rgba(15,23,42,0.10)]"
              >
                <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
              </motion.button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
