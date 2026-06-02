import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { Bell } from 'lucide-react';

interface HeaderProps {
  notificationCount: number;
  onNotificationClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ notificationCount, onNotificationClick }) => {
  return (
    <header className="w-full px-4 safe-area-pt sm:pt-8 pb-3 border-b border-rose-100/20 dark:border-threads-border bg-white/80 dark:bg-threads-bg z-40 relative flex-shrink-0">
      <div className="max-w-md mx-auto w-full flex items-center justify-between">
        <div className="flex items-center space-x-0 select-none group">
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
        <button
          type="button"
          onClick={onNotificationClick}
          className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Thông báo"
        >
          <Bell className="w-5 h-5 text-slate-800 dark:text-white" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[1.4rem] h-5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center px-1.5">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
