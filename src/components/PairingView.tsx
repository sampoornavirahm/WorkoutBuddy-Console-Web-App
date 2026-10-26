import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PairingSession } from '../types';
import {
  getPairingSession,
  claimPairingSession,
  createPairingSession
} from '../services/firestoreService';
import {
  Tv,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Sparkles
} from 'lucide-react';

interface PairingViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenTvSimulator: () => void;
}

export const PairingView: React.FC<PairingViewProps> = ({
  onNavigateTab,
  onOpenLogin,
  onOpenTvSimulator,
}) => {
  const { currentUser } = useAuth();
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  // Check URL query parameters for ?session=...
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSession = urlParams.get('session');
    if (paramSession) {
      setSessionIdInput(paramSession);
      fetchSession(paramSession);
    }
  }, []);

  // Countdown timer for 2-minute session expiry
  useEffect(() => {
    if (!session || session.status !== 'pending') return;

    const interval = setInterval(() => {
      const expires = new Date(session.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setError('This pairing session has expired. Please refresh the QR code on your TV.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const fetchSession = async (id: string) => {
    if (!id.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const s = await getPairingSession(id.trim());
      if (!s) {
        setError('Pairing session not found. Check that the code is correct.');
        setSession(null);
      } else {
        setSession(s);
        if (s.status === 'paired') {
          setError('This TV has already been paired.');
        } else if (s.status === 'expired' || new Date(s.expiresAt).getTime() < Date.now()) {
          setError('This pairing session has expired.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error checking pairing session.');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!session) return;

    try {
      setClaiming(true);
      setError(null);
      await claimPairingSession(session.sessionId, currentUser.uid);
      setSuccess(true);
      setSession(prev => prev ? { ...prev, status: 'paired', pairedByUid: currentUser.uid } : null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to authorize TV pairing.');
    } finally {
      setClaiming(false);
    }
  };

  const handleCreateTestSession = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      const newSession = await createPairingSession('LG OLED C3 (webOS TV)');
      setSession(newSession);
      setSessionIdInput(newSession.sessionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate test session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-white border border-[#E6E4DF] rounded-2xl shadow-xs text-[#171615] mb-2">
          <QrCode className="w-8 h-8 text-[#B45309]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
          Pair Your LG webOS TV
        </h1>
        <p className="text-xs sm:text-sm text-[#6E6C67] max-w-lg mx-auto">
          Scan the QR code displayed on your TV screen with your phone, or enter the session key below to authorize your workout companion.
        </p>
      </div>

      {/* Main Action Card */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {success ? (
          <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#171615]">TV Successfully Paired!</h2>
              <p className="text-xs text-[#6E6C67] max-w-md mx-auto mt-1">
                Your LG webOS TV has been authorized. Your workout routines and customized exercise plans will now display on your TV screen.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigateTab('dashboard')}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Go to Athlete Dashboard
              </button>
              <button
                onClick={onOpenTvSimulator}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#D1CFCA] text-[#171615] hover:bg-[#F3F1EC] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Inspect Synced TV Screen
              </button>
            </div>
          </div>
        ) : session ? (
          /* Active Pairing Confirmation Flow */
          <div className="space-y-6">
            <div className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-[#B45309]" />
                  <div>
                    <h3 className="font-semibold text-sm text-[#171615]">{session.deviceName}</h3>
                    <span className="text-[11px] text-[#6E6C67] font-numeric">
                      ID: {session.deviceUid}
                    </span>
                  </div>
                </div>

                {/* Expiration countdown badge */}
                {timeLeftSeconds !== null && (
                  <div className="flex items-center gap-1.5 text-xs font-numeric font-medium text-[#B45309] bg-[#FEF3C7] px-2.5 py-1 rounded-md">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {Math.floor(timeLeftSeconds / 60)}:
                      {String(timeLeftSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-xs text-[#6E6C67] pt-2 border-t border-[#E6E4DF]">
                Session ID: <code className="font-numeric text-[#171615]">{session.sessionId}</code>
              </div>
            </div>

            {/* Authentication Guard */}
            {!currentUser ? (
              <div className="p-4 bg-[#F3F1EC] rounded-lg text-center space-y-3">
                <p className="text-xs text-[#171615] font-medium">
                  Please sign in to authorize and link this TV with your personal routines.
                </p>
                <button
                  onClick={onOpenLogin}
                  className="px-5 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer shadow-xs"
                >
                  Sign In to Continue Pairing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleClaim}
                  disabled={claiming || (timeLeftSeconds !== null && timeLeftSeconds <= 0)}
                  className="w-full py-3 px-4 bg-[#171615] hover:bg-[#2A2926] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claiming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authorizing TV...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Authorize & Link This TV</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-[#9C9A94] text-center">
                  This TV will be granted scoped read access to your published routines and active banners.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Session Input Form */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#171615] mb-1">
                Enter Pairing Session ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sessionIdInput}
                  onChange={(e) => setSessionIdInput(e.target.value)}
                  placeholder="tv_xxxxxxxx..."
                  className="flex-1 px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                />
                <button
                  onClick={() => fetchSession(sessionIdInput)}
                  disabled={loading || !sessionIdInput.trim()}
                  className="px-4 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {loading ? 'Finding...' : 'Verify Session'}
                </button>
              </div>
            </div>

            {/* TV Simulator Direct Link & Testing Option */}
            <div className="pt-4 border-t border-[#F3F1EC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6C67]">
              <span>Don't have a physical TV in front of you?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateTestSession}
                  disabled={loading}
                  className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer"
                >
                  Create Mock TV Session
                </button>
                <span aria-hidden="true">·</span>
                <button
                  onClick={onOpenTvSimulator}
                  className="text-xs font-semibold text-[#171615] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Tv className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Launch TV Simulator</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Architecture Reference Notice */}
      <div className="p-4 bg-white border border-[#E6E4DF] rounded-xl text-xs text-[#6E6C67] space-y-1.5">
        <div className="font-semibold text-[#171615] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#B45309]" />
          <span>Zero-Trust Pairing Architecture</span>
        </div>
        <p className="leading-relaxed">
          The pairing handshake uses a 2-minute expiring one-time session ID generated by the TV's anonymous Firebase token. The authenticated web user atomically claims the session and registers the device under <code className="font-numeric text-[#171615]">users/&#123;uid&#125;/pairedDevices</code>. Firestore Security Rules prevent session reuse, spoofing, and privilege elevation.
        </p>
      </div>
    </div>
  );
};
