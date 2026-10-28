import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Dumbbell,
  Tv,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

interface AuthScreenProps {
  pendingPairingSessionId?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ pendingPairingSessionId }) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const formatAuthError = (err: unknown): string => {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        return 'Invalid email or password. Please verify and try again.';
      }
      if (msg.includes('auth/email-already-in-use')) {
        return 'An account with this email already exists. Try signing in instead.';
      }
      if (msg.includes('auth/weak-password')) {
        return 'Password must be at least 6 characters long.';
      }
      if (msg.includes('auth/popup-closed-by-user')) {
        return 'Google sign-in popup was cancelled before finishing.';
      }
      if (msg.includes('auth/network-request-failed')) {
        return 'Network connection issue. Please check your internet connection.';
      }
      return msg;
    }
    return 'Authentication failed. Please try again.';
  };

  const handleGoogleAuth = async () => {
    try {
      setError(null);
      setInfo(null);
      setLoading(true);
      await signInWithGoogle();
      // On success, onAuthStateChanged in AuthContext will set currentUser
      // and the main application will mount automatically.
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setInfo('A password reset link has been dispatched to your email.');
      }
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#171615] flex flex-col justify-between selection:bg-[#B45309] selection:text-white">
      {/* Top Simple Header */}
      <header className="border-b border-[#E6E4DF] bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#171615] text-white flex items-center justify-center font-black shadow-xs">
              <Dumbbell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#171615] block leading-none">
                Workout Companion
              </span>
              <span className="text-[11px] text-[#6E6C67] tracking-wider uppercase font-mono mt-0.5 block">
                Athlete Portal & TV Sync
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6E6C67]">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Secure Auth Online
            </span>
          </div>
        </div>
      </header>

      {/* Main Authentication Section */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Product Value & Value Proposition */}
          <div className="lg:col-span-6 space-y-6 lg:pr-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-[#B45309] border border-amber-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full Cross-Platform Ecosystem</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171615] leading-tight">
                Your unified fitness hub for Web & Smart TV
              </h1>
              <p className="text-sm text-[#6E6C67] leading-relaxed">
                Log in to build workout routines, browse 1,300+ animated exercise demonstrations, and pair your LG webOS Smart TV with an 8-character alphanumeric verification code.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E6E4DF] shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#B45309] flex items-center justify-center shrink-0 mt-0.5">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#171615]">1,300+ Exercise Animations</h3>
                  <p className="text-[11px] text-[#6E6C67] mt-0.5 leading-normal">
                    High-frame-rate animated GIFs with muscle targeting, equipment filters, and community verification.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E6E4DF] shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#171615]">Direct LG webOS TV Sync</h3>
                  <p className="text-[11px] text-[#6E6C67] mt-0.5 leading-normal">
                    Pair your big screen using its 8-character alphanumeric code or QR scanner to stream workouts seamlessly.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E6E4DF] shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#171615]">Zero-Trust Firestore Security</h3>
                  <p className="text-[11px] text-[#6E6C67] mt-0.5 leading-normal">
                    Attribute-Based Access Control keeps your customized routines and linked devices secure.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#9C9A94] flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Standard Athlete User role granted automatically upon sign up</span>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-6 sm:p-8 shadow-sm">
              
              {/* Context Notice for TV Pairing */}
              {pendingPairingSessionId && (
                <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#92400E] flex items-start gap-2.5">
                  <Tv className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">TV Pairing Request Detected</span>
                    <span>Sign in or create an account to link your TV session ({pendingPairingSessionId}).</span>
                  </div>
                </div>
              )}

              {/* Mode Toggle (Sign In / Sign Up) */}
              <div className="flex p-1 bg-[#F3F1EC] rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setInfo(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white text-[#171615] shadow-xs'
                      : 'text-[#6E6C67] hover:text-[#171615]'
                  }`}
                >
                  Create Account (Sign Up)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setInfo(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white text-[#171615] shadow-xs'
                      : 'text-[#6E6C67] hover:text-[#171615]'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {/* Card Title & Explanations */}
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#171615] tracking-tight">
                  {mode === 'signup' && 'Sign up to get started'}
                  {mode === 'signin' && 'Welcome back, Athlete'}
                  {mode === 'forgot' && 'Reset your password'}
                </h2>
                <p className="text-xs text-[#6E6C67] mt-1 leading-normal">
                  {mode === 'signup' && 'Anyone can sign up with Google or Email. By default, every new member receives full Athlete User access.'}
                  {mode === 'signin' && 'Sign in to access your workout routines and linked TV devices.'}
                  {mode === 'forgot' && 'Enter your email address to receive password recovery instructions.'}
                </p>
              </div>

              {/* Status Alert Banners */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {info && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="leading-relaxed">{info}</span>
                </div>
              )}

              {/* Primary Action: Google Authentication */}
              {mode !== 'forgot' && (
                <div className="space-y-4 mb-5">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-[#FAFAF8] active:bg-[#F3F1EC] border-2 border-[#D1CFCA] hover:border-[#171615] text-[#171615] rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>
                      {mode === 'signup' ? 'Sign up with Google (Instant User)' : 'Sign in with Google'}
                    </span>
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-[#E6E4DF] w-full"></div>
                    <span className="bg-white px-3 text-[11px] text-[#9C9A94] uppercase tracking-wider font-semibold absolute">
                      or with email
                    </span>
                  </div>
                </div>
              )}

              {/* Email / Password Form */}
              <form onSubmit={handleEmailForm} className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#171615] mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#9C9A94] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-[#D1CFCA] rounded-xl focus:outline-none focus:border-[#171615] transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#171615] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9C9A94] absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="athlete@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-[#D1CFCA] rounded-xl focus:outline-none focus:border-[#171615] transition-colors"
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#171615]">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setError(null);
                            setInfo(null);
                          }}
                          className="text-[11px] text-[#B45309] hover:underline cursor-pointer font-medium"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#9C9A94] absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 text-xs bg-white border border-[#D1CFCA] rounded-xl focus:outline-none focus:border-[#171615] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-[#9C9A94] hover:text-[#171615] cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mode === 'signup' && (
                      <p className="text-[10px] text-[#9C9A94] mt-1">
                        Minimum 6 characters
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <span>
                        {mode === 'signup' && 'Create Free Athlete Account'}
                        {mode === 'signin' && 'Sign In to Dashboard'}
                        {mode === 'forgot' && 'Send Password Reset Email'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Mode Switch Link */}
              <div className="mt-6 pt-4 border-t border-[#F3F1EC] text-center text-xs text-[#6E6C67]">
                {mode === 'signup' && (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-[#171615] font-bold underline hover:text-[#B45309] cursor-pointer"
                    >
                      Sign In here
                    </button>
                  </p>
                )}

                {mode === 'signin' && (
                  <p>
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-[#171615] font-bold underline hover:text-[#B45309] cursor-pointer"
                    >
                      Sign up for free
                    </button>
                  </p>
                )}

                {mode === 'forgot' && (
                  <p>
                    Remember your password?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-[#171615] font-bold underline hover:text-[#B45309] cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-[#E6E4DF] bg-white py-6 px-6 text-center text-xs text-[#9C9A94]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#6E6C67]">
            <span className="font-semibold text-[#171615]">Workout Companion Web Manager</span>
            <span>·</span>
            <span>Firebase Authentication & Firestore Database</span>
          </div>
          <div className="text-[11px]">
            Protected by Cloud Zero-Trust Security Policies · LG webOS Client Ready
          </div>
        </div>
      </footer>
    </div>
  );
};
