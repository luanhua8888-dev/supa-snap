import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart } from 'lucide-react';

interface NicknameModalProps {
  onSelect: (nickname: string) => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ onSelect }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please type a cute nickname! ✨');
      return;
    }
    if (trimmed.length < 2) {
      setError('Nickname must be at least 2 characters! 💕');
      return;
    }
    if (trimmed.length > 15) {
      setError('Too long! Keep it under 15 characters. 🌸');
      return;
    }
    
    localStorage.setItem('supasnap_nickname', trimmed);
    onSelect(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0708]/30 backdrop-blur-lg dark:bg-black/75">
      {/* Background Decorative Glowing Blobs */}
      <div className="absolute w-56 h-56 rounded-full bg-pink-400/20 blur-3xl animate-pulse" />
      <div className="absolute w-48 h-48 rounded-full bg-purple-400/10 blur-3xl animate-pulse delay-700 translate-x-20 -translate-y-10" />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        className="w-full max-w-sm p-7 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl rounded-[2.5rem] shadow-cute dark:shadow-cute-dark border border-pink-100/40 dark:border-zinc-800 z-10 relative overflow-hidden"
      >
        <div className="flex flex-col items-center text-center space-y-5">
          {/* Animated Header Badge */}
          <motion.div 
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="p-3.5 bg-gradient-to-tr from-pink-100 to-rose-50 dark:from-pink-950/40 dark:to-purple-950/20 rounded-2xl shadow-inner"
          >
            <Sparkles className="w-7 h-7 text-pink-500 dark:text-pink-300" />
          </motion.div>
          
          <div className="space-y-1.5">
            <h2 className="text-2xl font-black font-rounded text-slate-800 dark:text-pink-100 tracking-tight">
              Welcome to SupaSnap!
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
              Choose a cute nickname to start snapping and reacting with friends! <Heart className="w-3 h-3 inline fill-pink-400 text-pink-400" />
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-2">
            <div className="relative">
              <input
                id="nickname-input"
                type="text"
                placeholder="Type your nickname..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full px-5 py-3.5 text-center text-lg font-rounded font-bold rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border-2 border-slate-100 dark:border-zinc-800/80 focus:border-pink-300 dark:focus:border-pink-900/60 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none transition-all text-slate-700 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-550 shadow-inner"
                maxLength={15}
              />
              <AnimatePresence>
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-xs text-rose-500 dark:text-rose-400 mt-2 font-semibold flex items-center justify-center space-x-1"
                  >
                    <span>{error}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              id="nickname-submit-btn"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="shimmer-btn w-full py-4 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white font-extrabold font-rounded rounded-2xl shadow-cute dark:shadow-md transition-all duration-300"
            >
              Let's Snap! ✨
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
