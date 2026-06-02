import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  return (
    <header className="w-full px-4 safe-area-pt sm:pt-8 pb-3 border-b border-rose-100/20 dark:border-threads-border bg-white/80 dark:bg-threads-bg z-40 relative flex-shrink-0">
      <div className="max-w-md mx-auto flex items-center justify-center">
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
      </div>
    </header>
  );
};
