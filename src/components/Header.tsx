import React from 'react';
import { Moon, Sun, LogOut } from 'lucide-react';
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
    <header className="w-full px-4 safe-area-pt sm:pt-8 pb-3 border-b border-rose-100/20 dark:border-threads-border bg-white/80 dark:bg-threads-bg z-40 relative flex-shrink-0">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2.5 select-none">
          <img src="/favicon.svg" alt="SupaSnap" className="w-8 h-8 rounded-lg" />
          <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-threads-text">
            SupaSnap
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center rounded-full dark:bg-threads-surface border border-rose-100/30 dark:border-threads-border p-0.5">
            <span className="flex items-center px-2.5 py-1 text-slate-600 dark:text-threads-text text-[11px] font-semibold max-w-[88px] truncate">
              {nickname}
            </span>
            {onLogout && (
              <motion.button
                id="header-logout-btn"
                whileTap={{ scale: 0.9 }}
                onClick={onLogout}
                className="p-1.5 rounded-full text-slate-400 dark:text-threads-muted hover:text-rose-500 dark:hover:text-threads-text transition-colors cursor-pointer"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>

          <motion.button
            id="header-darkmode-btn"
            whileTap={{ scale: 0.92 }}
            onClick={onToggleDark}
            className="p-2 rounded-full dark:bg-threads-surface border border-rose-100/20 dark:border-threads-border text-slate-500 dark:text-threads-muted hover:text-slate-700 dark:hover:text-threads-text transition-colors cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>
        </div>
      </div>
    </header>
  );
};
