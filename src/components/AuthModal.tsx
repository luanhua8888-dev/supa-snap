import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nickname: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (isSignUp) {
        const trimmedNickname = nickname.trim();
        if (!trimmedNickname) {
          throw new Error('Please enter a cute nickname! ✨');
        }
        if (trimmedNickname.length < 2 || trimmedNickname.length > 15) {
          throw new Error('Nickname must be between 2 and 15 characters! 💕');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname: trimmedNickname,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          onSuccess(trimmedNickname);
        } else {
          setError('Please check your email to confirm registration! 📬');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.user) {
          const userNickname = data.user.user_metadata?.nickname || email.split('@')[0];
          onSuccess(userNickname);
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0708]/30 backdrop-blur-lg dark:bg-black/75">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={onClose} />
          
          {/* Ambient Glows */}
          <div className="absolute w-64 h-64 rounded-full bg-pink-400/15 dark:bg-pink-500/10 blur-3xl pointer-events-none" />
          <div className="absolute w-48 h-48 rounded-full bg-purple-400/10 dark:bg-purple-500/5 blur-3xl pointer-events-none translate-x-24 translate-y-24" />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="relative w-full max-w-sm p-7 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-cute dark:shadow-cute-dark border border-pink-100/40 dark:border-zinc-800 z-10 overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors border border-slate-100/50 dark:border-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <motion.div 
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="p-3 bg-gradient-to-tr from-pink-100 to-rose-50 dark:from-pink-950/40 dark:to-purple-950/20 rounded-2xl shadow-inner"
              >
                <Sparkles className="w-6 h-6 text-pink-500 dark:text-pink-300 animate-pulse" />
              </motion.div>
              
              <div>
                <h2 className="text-2xl font-black font-rounded text-slate-800 dark:text-pink-100 tracking-tight">
                  {isSignUp ? 'Create Account' : 'Welcome Back!'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-[220px] mx-auto mt-1 leading-relaxed">
                  {isSignUp 
                    ? 'Sign up to save history and share snaps with friends! 🌸'
                    : 'Log in to start sharing snaps and reactions! 💖'
                  }
                </p>
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-4 pt-2 text-left">
                <AnimatePresence mode="popLayout">
                  {isSignUp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-bold font-rounded text-slate-400 dark:text-zinc-550 uppercase tracking-widest pl-1">
                        Nickname
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-[15px] w-4 h-4 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Choose a nickname..."
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          required
                          className="w-full pl-11 pr-5 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80 focus:border-pink-300 dark:focus:border-pink-950 focus:bg-white focus:outline-none transition-all text-slate-700 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 font-medium text-sm shadow-inner"
                          maxLength={15}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-rounded text-slate-400 dark:text-zinc-550 uppercase tracking-widest pl-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-[15px] w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      type="email"
                      placeholder="sweetheart@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-11 pr-5 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80 focus:border-pink-300 dark:focus:border-pink-950 focus:bg-white focus:outline-none transition-all text-slate-700 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 font-medium text-sm shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-rounded text-slate-400 dark:text-zinc-550 uppercase tracking-widest pl-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-[15px] w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-11 pr-5 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80 focus:border-pink-300 dark:focus:border-pink-950 focus:bg-white focus:outline-none transition-all text-slate-700 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 font-medium text-sm shadow-inner"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100/50 dark:border-rose-900/30 flex items-start space-x-2 text-rose-600 dark:text-rose-400 text-xs leading-normal"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="shimmer-btn w-full py-4 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white font-extrabold font-rounded rounded-2xl shadow-cute dark:shadow-md transition-all duration-300 flex items-center justify-center cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>{isSignUp ? 'Sign Up ✨' : 'Log In 🔒'}</span>
                  )}
                </motion.button>
              </form>

              <div className="pt-2 text-xs text-slate-400 dark:text-zinc-500 font-medium">
                {isSignUp ? (
                  <p>
                    Already have an account?{' '}
                    <button
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                      }}
                      className="text-pink-500 hover:underline font-bold hover:text-pink-600 transition-colors"
                    >
                      Log In
                    </button>
                  </p>
                ) : (
                  <p>
                    New to SupaSnap?{' '}
                    <button
                      onClick={() => {
                        setIsSignUp(true);
                        setError(null);
                      }}
                      className="text-pink-500 hover:underline font-bold hover:text-pink-600 transition-colors"
                    >
                      Create Account
                    </button>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
