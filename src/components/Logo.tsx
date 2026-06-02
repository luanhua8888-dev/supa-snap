import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 128 128" 
      fill="none" 
      className={`logo-glow cursor-pointer text-slate-800 dark:text-zinc-100 ${className}`}
    >
      {/* Outer Teardrop */}
      <path 
        d="M 64 26 C 80 46, 90 64, 90 78 A 26 26 0 0 1 38 78 C 38 64, 48 46, 64 26 Z" 
        stroke="currentColor" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Inner Teardrop */}
      <path 
        d="M 64 44 C 73 56, 78 68, 78 78 A 14 14 0 0 1 50 78 C 50 68, 55 56, 64 44 Z" 
        stroke="currentColor" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Interlocking Circle */}
      <circle cx="74" cy="80" r="18" stroke="currentColor" strokeWidth="7" />
    </svg>
  );
};
