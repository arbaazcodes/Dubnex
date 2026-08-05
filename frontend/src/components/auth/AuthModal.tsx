import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import {
  loginWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  startPhoneAuth,
  confirmPhoneOtp,
  clearPhoneRecaptcha,
  validateEmail,
  validatePassword,
  validateDisplayName,
  validatePhoneE164,
  validateOtpCode,
} from '../../lib/firebase';

export type AuthModalMode = 'signin' | 'signup' | 'reset' | 'phone';

type Props = {
  open: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onAuthenticated?: () => void;
};

const RECAPTCHA_ID = 'firebase-phone-recaptcha';

const inputClass =
  'w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50';

const labelClass =
  'text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold';

const primaryBtnClass =
  'w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer';

const ghostBtnClass =
  'w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200/60 dark:border-zinc-800 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60';

export default function AuthModal({
  open,
  initialMode = 'signin',
  onClose,
  onAuthenticated,
}: Props) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setInfo(null);
      setConfirmation(null);
      setOtp('');
      setLoading(false);
    } else {
      clearPhoneRecaptcha();
    }
  }, [open, initialMode]);

  useEffect(() => {
    return () => {
      clearPhoneRecaptcha();
    };
  }, []);

  if (!open) return null;

  const switchMode = (next: AuthModalMode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setLoading(false);
    if (next !== 'phone') {
      setConfirmation(null);
      setOtp('');
      clearPhoneRecaptcha();
    }
  };

  const finishAuth = () => {
    onAuthenticated?.();
    onClose();
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await loginWithGoogle();
      finishAuth();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    const passErr = validatePassword(password);
    if (passErr) return setError(passErr);

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      finishAuth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const nameErr = validateDisplayName(displayName);
    if (nameErr) return setError(nameErr);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    const passErr = validatePassword(password, { isNew: true });
    if (passErr) return setError(passErr);
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
      finishAuth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);

    setLoading(true);
    try {
      await sendPasswordReset(email);
      setInfo('Password reset email sent. Check your inbox (and spam folder).');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const phoneErr = validatePhoneE164(phone);
    if (phoneErr) return setError(phoneErr);

    setLoading(true);
    try {
      const result = await startPhoneAuth(phone, RECAPTCHA_ID);
      setConfirmation(result);
      setInfo('SMS code sent. Enter the 6-digit code below.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send SMS code.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!confirmation) {
      return setError('Request a verification code first.');
    }
    const otpErr = validateOtpCode(otp);
    if (otpErr) return setError(otpErr);

    setLoading(true);
    try {
      await confirmPhoneOtp(confirmation, otp);
      finishAuth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create account'
        : mode === 'reset'
          ? 'Reset password'
          : 'Phone sign-in';

  const subtitle =
    mode === 'signin'
      ? 'Use Google, email, or phone to continue.'
      : mode === 'signup'
        ? 'Create an account with email and password.'
        : mode === 'reset'
          ? 'We will email you a secure reset link.'
          : 'Verify with a one-time SMS code.';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative w-full sm:max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-xl dark:shadow-none overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2
              id="auth-modal-title"
              className="text-base font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight"
            >
              {title}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Mode tabs (except when deep in reset success-only) */}
          {(mode === 'signin' || mode === 'signup' || mode === 'phone') && (
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800">
              {(
                [
                  ['signin', 'Email'],
                  ['signup', 'Sign up'],
                  ['phone', 'Phone'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={loading}
                  onClick={() => switchMode(id)}
                  className={`py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    mode === id
                      ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200/70 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-[11px] text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className={ghostBtnClass}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span>or email</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </>
          )}

          {mode === 'signin' && (
            <form className="space-y-3" onSubmit={handleEmailSignIn} noValidate>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => switchMode('reset')}
                  className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{loading ? 'Signing in...' : 'Sign in with email'}</span>
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="space-y-3" onSubmit={handleEmailSignUp} noValidate>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-name">
                  Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="Your name"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-signup-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-signup-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="At least 8 characters"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-confirm-password">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="Repeat password"
                    disabled={loading}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{loading ? 'Creating account...' : 'Create account'}</span>
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form className="space-y-3" onSubmit={handleReset} noValidate>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="auth-reset-email">
                  Account email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="auth-reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{loading ? 'Sending...' : 'Send reset link'}</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => switchMode('signin')}
                className="w-full text-[11px] font-mono font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === 'phone' && (
            <div className="space-y-3">
              {!confirmation ? (
                <form className="space-y-3" onSubmit={handleSendOtp} noValidate>
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="auth-phone">
                      Phone (E.164)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="auth-phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`${inputClass} pl-9`}
                        placeholder="+14155552671"
                        disabled={loading}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Include country code. SMS rates may apply.
                    </p>
                  </div>
                  <button type="submit" disabled={loading} className={primaryBtnClass}>
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{loading ? 'Sending code...' : 'Send verification code'}</span>
                  </button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleConfirmOtp} noValidate>
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="auth-otp">
                      SMS code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="auth-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`${inputClass} pl-9 tracking-[0.3em]`}
                        placeholder="123456"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className={primaryBtnClass}>
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{loading ? 'Verifying...' : 'Verify & sign in'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setConfirmation(null);
                      setOtp('');
                      setInfo(null);
                      clearPhoneRecaptcha();
                    }}
                    className="w-full text-[11px] font-mono font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    Use a different number
                  </button>
                </form>
              )}
              {/* Invisible reCAPTCHA host for Firebase phone auth */}
              <div id={RECAPTCHA_ID} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
