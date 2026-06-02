import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, User, LogOut, Check, Sparkles, Sun, Moon, Heart, Users, MessageSquare } from 'lucide-react';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Kích thước ảnh phải nhỏ hơn 2MB! 🌸', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatar(base64String);
      showToast('Đã chọn ảnh đại diện mới! ✨', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Biệt danh không được để trống! 💕', 'error');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 15) {
      showToast('Biệt danh phải từ 2 đến 15 ký tự! 🌸', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateProfile(trimmed, avatar, bio.trim());
      showToast('Cập nhật hồ sơ thành công! 🎉', 'success');
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

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-28 text-gray-100 select-none space-y-6">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-black border border-gray-800 rounded-[2rem] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.32)] relative overflow-hidden"
      >
        <div className="flex flex-col items-center text-center mb-6">
          {/* Avatar frame */}
          <div className="relative group">
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="w-22 h-22 rounded-full bg-gray-900 p-0.5 shadow-[0_18px_45px_rgba(0,0,0,0.32)] flex items-center justify-center relative overflow-hidden"
            >
              <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                {isCustomImage ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{avatar}</span>
                )}
              </div>
            </motion.div>

            {/* Custom file upload overlay trigger */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={triggerUpload}
              className="absolute bottom-0 right-0 p-2 bg-gray-900 text-white rounded-full shadow-[0_14px_32px_rgba(0,0,0,0.28)] hover:bg-gray-800 transition-colors border border-gray-700 cursor-pointer"
              title="Tải ảnh lên"
            >
              <Camera className="w-3.5 h-3.5" />
            </motion.button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <h2 className="mt-3.5 text-lg font-black font-rounded flex items-center gap-1.5 justify-center text-white">
            {nickname} <Sparkles className="w-4 h-4 text-gray-400" />
          </h2>
          <p className="text-[11px] text-gray-500 font-bold mt-0.5">{email}</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4.5">
            <div className="p-4 rounded-3xl bg-black/95 border border-gray-800 shadow-[0_18px_52px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">
                    Người theo dõi
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{followersCount}</p>
                </div>
                <Users className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-black/95 border border-gray-800 shadow-[0_18px_52px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">
                    Đang theo dõi
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{followingCount}</p>
                </div>
                <User className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-black/95 border border-gray-800 shadow-[0_18px_52px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">
                    Lượt thích
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{likesCount}</p>
                </div>
                <Heart className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-black/95 border border-gray-800 shadow-[0_18px_52px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">
                    Bài đăng
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{userPhotos.length}</p>
                </div>
                <Sparkles className="w-5 h-5 text-gray-300" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Preset Avatar Selector */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">
              Chọn Avatar Cute
            </label>
            <div className="flex gap-2 overflow-x-auto py-2 px-0.5 no-scrollbar snap-x">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`w-10 h-10 flex-shrink-0 text-xl flex items-center justify-center rounded-xl border transition-all cursor-pointer snap-center ${
                    avatar === emoji
                      ? 'bg-gray-700 border-gray-500 scale-105 shadow-[0_10px_22px_rgba(0,0,0,0.20)]'
                      : 'bg-gray-900 border-gray-700 hover:scale-105'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 pl-1">
                Biệt danh (Nickname)
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-4 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={15}
                  className="w-full pl-11 pr-5 py-3 rounded-2xl bg-gray-900 border border-gray-700 focus:bg-gray-800 focus:outline-none transition-all text-xs font-semibold shadow-inner text-white"
                  placeholder="Nhập biệt danh mới..."
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 pl-1">
                Trạng thái (Status/Bio)
              </label>
              <div className="relative flex items-center">
                <MessageSquare className="absolute left-4 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={60}
                  className="w-full pl-11 pr-5 py-3 rounded-2xl bg-gray-900 border border-gray-700 focus:bg-gray-800 focus:outline-none transition-all text-xs font-semibold shadow-inner text-white"
                  placeholder="Hôm nay tâm trạng thế nào? ✨"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isUpdating}
            className="w-full py-3.5 bg-gray-800 text-white font-extrabold rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs disabled:opacity-50 border border-gray-700"
          >
            {isUpdating ? (
              <span className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Lưu Thay Đổi</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Settings & Theme Section */}
        <div className="border-t border-gray-800 mt-5 pt-4.5 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
              Chế độ tối (Dark Mode)
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleDark}
              type="button"
              className="p-2.5 rounded-2xl bg-gray-900 border border-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.20)]"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-gray-200" />
              ) : (
                <Moon className="w-4 h-4 text-gray-400" />
              )}
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className="w-full py-3 border border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200 hover:text-white rounded-2xl font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 text-[11px] shadow-[0_12px_32px_rgba(0,0,0,0.20)]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất tài khoản</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Snap Board Gallery Section */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black font-rounded text-white">
            Của tôi
          </h3>
          <span className="text-[10px] font-extrabold font-rounded bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-gray-400">
            Đã đăng {userPhotos.length} snaps
          </span>
        </div>

        {userPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 space-y-4 bg-black border border-gray-800 rounded-[2rem]">
            <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center border border-gray-700 text-gray-400">
              🦊
            </div>
            <p className="text-xs text-gray-400 font-medium max-w-[200px]">
              Bạn chưa đăng snap nào. Hãy chụp và chia sẻ snap đầu tiên!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-6">
            {userPhotos.map((photo) => (
              <motion.div
                key={photo.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectPhoto(photo)}
                className="gallery-cell relative aspect-square rounded-2xl overflow-hidden cursor-pointer ring-1 ring-gray-800 bg-black group shadow-[0_16px_40px_rgba(0,0,0,0.20)]"
              >
                <GalleryThumb photo={photo} live={isLive(photo.created_at)} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
