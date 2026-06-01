import React from 'react';
import { Moon, Sun, Sparkles, User, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  nickname: string;
  onLogout?: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  nickname,
  onLogout,
  isDark,
  onToggleDark,
}) => {
  return (
    <header className="w-full glass px-4 pt-4 sm:pt-9 pb-3.5 border-b border-rose-150/15 dark:border-zinc-800/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-40 relative flex-shrink-0">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo with micro-animations */}
        <div className="flex items-center space-x-2 group cursor-pointer select-none">
          <motion.div
            whileHover={{ scale: 1.12, rotate: 12 }}
            animate={{ 
              rotate: [0, 6, -6, 0],
              scale: [1, 1.04, 0.98, 1]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 5, 
              ease: 'easeInOut' 
            }}
            className="p-1.5 bg-gradient-to-tr from-pink-500 to-violet-500 rounded-xl shadow-[0_4px_10px_rgba(244,63,94,0.3)] border border-white/20"
          >
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </motion.div>
          
          <h1 className="font-rounded font-black text-lg tracking-tight bg-gradient-to-r from-pink-500 via-rose-450 to-indigo-400 dark:from-pink-300 dark:via-rose-350 dark:to-indigo-300 bg-clip-text text-transparent group-hover:brightness-110 transition-all duration-300">
            SupaSnap
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* User Nickname & Logout Badge */}
          <div className="flex items-center bg-white/45 dark:bg-zinc-900/60 rounded-full border border-rose-100/30 dark:border-zinc-800/80 p-0.5 shadow-sm">
            <span className="flex items-center px-3 py-1 text-rose-500 dark:text-pink-300 text-[10px] font-extrabold font-rounded uppercase tracking-wider">
              <User className="w-3 h-3 mr-1 text-rose-400 dark:text-pink-400" />
              <span className="truncate max-w-[70px]">{nickname}</span>
            </span>
            
            {onLogout && (
              <motion.button
                id="header-logout-btn"
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
                whileTap={{ scale: 0.9 }}
                onClick={onLogout}
                className="p-1.5 rounded-full text-rose-400 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-3 h-3" />
              </motion.button>
            )}
          </div>

          {/* Theme Toggle Button */}
          <motion.button
            id="header-darkmode-btn"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleDark}
            className="p-2 rounded-full bg-white/40 dark:bg-zinc-900/50 border border-rose-100/20 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-amber-200 transition-colors shadow-sm cursor-pointer"
            aria-label="Toggle dark mode"
          >
            <motion.div
              initial={false}
              animate={{ rotate: isDark ? 180 : 0, scale: isDark ? 0.9 : 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-rose-450" />
              )}
            </motion.div>
          </motion.button>
        </div>
      </div>
    </header>
  );
};
