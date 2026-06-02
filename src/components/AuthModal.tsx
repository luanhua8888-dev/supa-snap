import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error('Nhập email hợp lệ.');
      }

      if (authMode === 'magic') {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signInError) {
          throw signInError;
        }

        setInfo(
          `Đã gửi link đăng nhập tới ${trimmedEmail}. Mở mail và bấm vào link để tiếp tục.`
        );
        return;
      }

      if (!password) {
        throw new Error('Nhập mật khẩu.');
      }

      if (isSignup) {
        if (password !== confirmPassword) {
          throw new Error('Mật khẩu và xác nhận mật khẩu phải trùng nhau.');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        setInfo(
          'Tài khoản đã được tạo. Nếu cần xác nhận email, kiểm tra hộp thư để hoàn tất đăng ký.'
        );
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        setInfo('Đăng nhập thành công!');
        setTimeout(() => {
          handleClose();
        }, 500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi xác thực.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    resetMessages();
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error('Nhập email để nhận link đăng nhập.');
      }

      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (resendError) {
        throw resendError;
      }

      setInfo(
        `Đã gửi lại link đăng nhập tới ${trimmedEmail}. Kiểm tra mail và mở link.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi gửi lại link.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetMessages();
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setIsSignup(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0708]/30 backdrop-blur-lg dark:bg-black/75">
          <div className="absolute inset-0" onClick={handleClose} />
          <div className="absolute w-64 h-64 rounded-full bg-black/15 blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            className="relative w-full max-w-sm p-7 bg-black/90 dark:bg-black/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-gray-700/40 dark:border-gray-800 z-10 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <img src="/favicon.svg" alt="" className="w-14 h-14 rounded-2xl shadow-md" />
              <div>
                <h2 className="text-2xl font-black font-rounded text-white dark:text-white">
                  {authMode === 'magic'
                    ? 'Đăng nhập bằng email'
                    : isSignup
                    ? 'Đăng ký tài khoản'
                    : 'Đăng nhập bằng mật khẩu'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[240px] mx-auto">
                  {authMode === 'magic'
                    ? 'Nhập email để nhận link đăng nhập. Không cần mật khẩu.'
                    : isSignup
                    ? 'Tạo tài khoản mới với email và mật khẩu.'
                    : 'Đăng nhập với email và mật khẩu của bạn.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className={`px-3 py-2 rounded-2xl transition ${
                    authMode === 'password'
                      ? 'bg-white/10 text-white'
                      : 'hover:bg-white/5 text-gray-400'
                  }`}
                >
                  Mật khẩu
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('magic')}
                  className={`px-3 py-2 rounded-2xl transition ${
                    authMode === 'magic'
                      ? 'bg-white/10 text-white'
                      : 'hover:bg-white/5 text-gray-400'
                  }`}
                >
                  Link email
                </button>
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-3.5 text-left">
                <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email"
                    placeholder="ban@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>

                {authMode === 'password' && (
                  <>
                    <Field label="Mật khẩu" icon={<Lock className="w-4 h-4" />}>
                      <input
                        type="password"
                        placeholder="Mật khẩu"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={inputClass}
                      />
                    </Field>

                    {isSignup && (
                      <Field label="Xác nhận mật khẩu" icon={<Lock className="w-4 h-4" />}>
                        <input
                          type="password"
                          placeholder="Xác nhận mật khẩu"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </Field>
                    )}
                  </>
                )}

                {error && <AlertBox tone="error" text={error} />}
                {info && <AlertBox tone="info" text={info} />}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="shimmer-btn w-full py-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-extrabold font-rounded rounded-2xl cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : authMode === 'magic' ? (
                    <span>Gửi link đăng nhập</span>
                  ) : isSignup ? (
                    <span>Tạo tài khoản</span>
                  ) : (
                    <span>Đăng nhập</span>
                  )}
                </motion.button>

                {authMode === 'password' ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setIsSignup((prev) => !prev)}
                    className="w-full py-2.5 text-xs font-bold font-rounded text-gray-300 hover:text-white border border-gray-600/50 dark:border-gray-700/50 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSignup ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
                  </button>
                ) : (
                  info && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleResendLink}
                      className="w-full py-2.5 text-xs font-bold font-rounded text-gray-300 hover:text-white border border-gray-600/50 dark:border-gray-700/50 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Gửi lại link đăng nhập
                    </button>
                  )
                )}
              </form>

              {authMode === 'password' && (
                <p className="text-xs text-gray-400">
                  Hoặc đăng nhập bằng link email nếu bạn muốn tránh mật khẩu.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const inputClass =
  'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-900 dark:bg-gray-900 border border-gray-700 dark:border-gray-700 focus:border-gray-600 focus:outline-none text-sm font-medium text-white dark:text-white';

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function AlertBox({ tone, text }: { tone: 'error' | 'info'; text: string }) {
  return (
    <div
      className={`p-3 rounded-xl border flex items-start gap-2 text-xs leading-relaxed ${
        tone === 'error'
          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 text-rose-600 dark:text-rose-400'
          : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 text-indigo-700 dark:text-indigo-300'
      }`}
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
