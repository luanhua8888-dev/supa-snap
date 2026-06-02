import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, AlertCircle, Eye, EyeOff, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAdminEmails } from '../lib/admin';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nickname: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loginId, setLoginId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleResetPassword = async () => {
    const target = loginId.trim();
    if (!target) {
      setError('Nhập email hoặc username để nhận link khôi phục.');
      return;
    }

    setLoading(true);
    resetMessages();

    try {
      const recoveryEmail = await resolveEmailFromLoginId(target);
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      setInfo(
        `Đã gửi link khôi phục mật khẩu tới ${recoveryEmail}. Kiểm tra mail và làm theo hướng dẫn.`
      );
      setIsRecovering(false);
      setPendingConfirmEmail(recoveryEmail);
      setLoginId(recoveryEmail);
      setPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không gửi được link khôi phục.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmEmail) return;
    setLoading(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (resendError) throw resendError;
      setInfo(
        `Đã gửi lại tới ${pendingConfirmEmail}. Tìm mail từ Supabase Auth (All Mail / Spam).`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không gửi lại được email.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resolveEmailFromLoginId = async (id: string): Promise<string> => {
    const trimmed = id.trim();
    if (trimmed.includes('@')) return trimmed.toLowerCase();

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', trimmed.toLowerCase())
      .maybeSingle();

    if (profileError) {
      console.warn('profiles lookup:', profileError.message);
    }
    if (data?.email) return data.email;

    throw new Error('Không tìm thấy tài khoản với username này.');
  };

  const isUnconfirmedEmailError = (message: string) => {
    const text = message.toLowerCase();
    return (
      text.includes('confirm') ||
      text.includes('verification') ||
      text.includes('verified') ||
      text.includes('not confirmed') ||
      text.includes('unconfirmed')
    );
  };

  const isRateLimitError = (message: string) => {
    const text = message.toLowerCase();
    return (
      text.includes('rate limit') ||
      text.includes('too many requests') ||
      text.includes('limit exceeded') ||
      text.includes('email rate limit')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (isRecovering) {
        await handleResetPassword();
        return;
      }

      if (isSignUp) {
        const trimmedUsername = username.trim().toLowerCase();
        const trimmedEmail = email.trim().toLowerCase();

        if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
          throw new Error('Username: 3–20 ký tự, chữ thường, số và _');
        }
        if (password.length < 6) {
          throw new Error('Mật khẩu tối thiểu 6 ký tự.');
        }

        const redirectTo = `${window.location.origin}/`;

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              nickname: trimmedUsername,
              username: trimmedUsername,
            },
          },
        });

        if (signUpError) {
          const message = signUpError.message?.toLowerCase?.() || '';
          if (message.includes('already registered') || message.includes('already exists')) {
            setIsSignUp(false);
            setLoginId(trimmedEmail);
            setPendingConfirmEmail(trimmedEmail);
            setInfo(
              `Email ${trimmedEmail} đã được đăng ký trước đó. Vui lòng đăng nhập và bấm "Gửi lại email xác nhận" nếu cần.`
            );
            return;
          }
          if (isRateLimitError(message)) {
            setIsSignUp(false);
            setLoginId(trimmedEmail);
            setPendingConfirmEmail(trimmedEmail);
            setError(
              `Email xác nhận đã được gửi quá nhanh. Vui lòng đợi vài phút sau đó đăng nhập và bấm "Gửi lại email xác nhận".`
            );
            return;
          }
          throw signUpError;
        }

        if (data.user) {
          const adminEmails = getAdminEmails();
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: trimmedUsername,
            email: trimmedEmail,
            is_admin: adminEmails.includes(trimmedEmail),
          });

          if (data.session) {
            setPendingConfirmEmail(null);
            onSuccess(trimmedUsername);
          } else {
            setPendingConfirmEmail(trimmedEmail);
            setIsSignUp(false);
            setLoginId(trimmedUsername);
            setPassword('');
            setInfo(
              `Đã gửi email tới ${trimmedEmail}. Xác nhận link trong mail Supabase Auth, sau đó đăng nhập bằng username "${trimmedUsername}" và mật khẩu vừa tạo.`
            );
          }
        }
      } else {
        const loginEmail = await resolveEmailFromLoginId(loginId);

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (signInError) {
          if (isUnconfirmedEmailError(signInError.message || '')) {
            setPendingConfirmEmail(loginEmail);
            throw new Error(
              'Email chưa xác nhận. Mở mail Supabase Auth và bấm link, hoặc bấm "Gửi lại email" bên dưới.'
            );
          }
          throw signInError;
        }

        if (data.user) {
          const displayName =
            data.user.user_metadata?.nickname ||
            data.user.user_metadata?.username ||
            loginId.split('@')[0];
          onSuccess(displayName);
        }
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const message = err instanceof Error ? err.message : 'Lỗi xác thực.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0708]/30 backdrop-blur-lg dark:bg-black/75">
          <div className="absolute inset-0" onClick={onClose} />
          <div className="absolute w-64 h-64 rounded-full bg-black/15 blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            className="relative w-full max-w-sm p-7 bg-black/90 dark:bg-black/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-gray-700/40 dark:border-gray-800 z-10 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <img src="/favicon.svg" alt="" className="w-14 h-14 rounded-2xl shadow-md" />
              <div>
                <h2 className="text-2xl font-black font-rounded text-white dark:text-white">
                  {isRecovering ? 'Khôi phục tài khoản' : isSignUp ? 'Đăng ký' : 'Đăng nhập'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[240px] mx-auto">
                  {isRecovering
                    ? 'Nhập email hoặc username để nhận link khôi phục mật khẩu.'
                    : isSignUp
                    ? 'Email + username — xác nhận qua email rồi đăng nhập'
                    : 'Username hoặc email + mật khẩu'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-3.5 text-left">
                {isRecovering ? (
                  <Field label="Username hoặc Email" icon={<AtSign className="w-4 h-4" />}>
                    <input
                      type="text"
                      placeholder="username hoặc email"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                ) : isSignUp ? (
                  <>
                    <Field label="Username" icon={<User className="w-4 h-4" />}>
                      <input
                        type="text"
                        placeholder="luanhua123"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        required
                        maxLength={20}
                        className={inputClass}
                      />
                    </Field>
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
                  </>
                ) : (
                  <Field label="Username hoặc Email" icon={<AtSign className="w-4 h-4" />}>
                    <input
                      type="text"
                      placeholder="username hoặc email"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                )}

                {!isRecovering && (
                  <Field label="Mật khẩu" icon={<Lock className="w-4 h-4" />}>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-300 cursor-pointer"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                )}

                {error && <AlertBox tone="error" text={error} />}
                {info && <AlertBox tone="info" text={info} />}

                {pendingConfirmEmail && !isRecovering && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResendConfirmation}
                    className="w-full py-2.5 text-xs font-bold font-rounded text-gray-300 hover:text-white border border-gray-600/50 dark:border-gray-700/50 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Gửi lại email xác nhận
                  </button>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="shimmer-btn w-full py-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-extrabold font-rounded rounded-2xl cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <span>
                      {isRecovering ? 'Gửi link khôi phục' : isSignUp ? 'Đăng ký ✨' : 'Đăng nhập 🔒'}
                    </span>
                  )}
                </motion.button>
              </form>

              <p className="text-xs text-gray-400">
                {isRecovering ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecovering(false);
                        resetMessages();
                      }}
                      className="text-gray-300 font-bold hover:underline cursor-pointer"
                    >
                      Quay lại đăng nhập
                    </button>
                  </>
                ) : isSignUp ? (
                  <>
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecovering(false);
                        setIsSignUp(false);
                        setPendingConfirmEmail(null);
                        resetMessages();
                      }}
                      className="text-gray-300 font-bold hover:underline cursor-pointer"
                    >
                      Đăng nhập
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setIsRecovering(true);
                        resetMessages();
                      }}
                      className="text-gray-300 font-bold hover:underline cursor-pointer"
                    >
                      Quên mật khẩu?
                    </button>
                    {' • '}
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecovering(false);
                        setIsSignUp(true);
                        setPendingConfirmEmail(null);
                        resetMessages();
                      }}
                      className="text-gray-300 font-bold hover:underline cursor-pointer"
                    >
                      Đăng ký
                    </button>
                  </>
                )}
              </p>
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
