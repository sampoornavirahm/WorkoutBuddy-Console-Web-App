import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PairingSession, Routine, Banner, TvUserAccount } from '../types';
import {
  createPairingSession,
  getBanners,
  getRoutines,
  claimPairingSession,
  generatePairingCode
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import {
  Tv,
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  User,
  LogOut,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface TvSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPairingSession?: (sessionId: string) => void;
}

const TV_STORAGE_KEY = 'workoutbuddy_tv_authenticated_user';
const TV_DEVICE_KEY = 'workoutbuddy_tv_device_uid';

export const TvSimulatorModal: React.FC<TvSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSelectPairingSession,
}) => {
  const { currentUser } = useAuth();

  // Persistent TV Logged-in User Account State
  const [tvAccount, setTvAccount] = useState<TvUserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(TV_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [session, setSession] = useState<PairingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [copiedCode, setCopiedCode] = useState(false);
  const [quickPairing, setQuickPairing] = useState(false);

  const [tvBanners, setTvBanners] = useState<Banner[]>([]);
  const [tvRoutines, setTvRoutines] = useState<Routine[]>([]);
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'pairing'>('home');

  // Load TV home content (routines & banners)
  const loadTvHomeContent = useCallback(async (ownerUid?: string) => {
    try {
      const [bans, rts] = await Promise.all([
        getBanners().catch(() => []),
        getRoutines(ownerUid, 'user').catch(() => []),
      ]);
      setTvBanners(bans || []);
      setTvRoutines(rts || []);

      const now = Date.now();
      const active = (bans || [])
        .filter(b => b.active && new Date(b.startAt).getTime() <= now && new Date(b.endAt).getTime() >= now)
        .sort((a, b) => b.priority - a.priority)[0] || null;
      setActiveBanner(active);
    } catch (err) {
      console.warn('Error loading TV simulator content:', err);
    }
  }, []);

  // Initialize TV pairing handshake session with 8-digit alphanumeric code
  const initializeNewTvSession = useCallback(async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      // Retrieve or create stable hardware ID for this TV client
      let deviceUid = localStorage.getItem(TV_DEVICE_KEY);
      if (!deviceUid) {
        deviceUid = 'dev_lg_oled_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(TV_DEVICE_KEY, deviceUid);
      }

      const newSession = await createPairingSession('LG OLED 65" (Living Room webOS)', deviceUid);
      if (newSession) {
        setSession(newSession);
        setSecondsRemaining(600);
      }
    } catch (err: unknown) {
      console.warn('TV Pairing Session creation note:', err);
      const code = generatePairingCode();
      const fallbackSession: PairingSession = {
        sessionId: code,
        pairingCode: code,
        deviceUid: 'dev_simulated_lg_webos',
        deviceName: 'LG OLED 65" (Simulator)',
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };
      setSession(fallbackSession);
      setSecondsRemaining(600);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      // Check saved account
      try {
        const saved = localStorage.getItem(TV_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setTvAccount(parsed);
          setActiveTab('home');
          loadTvHomeContent(parsed.uid);
          return;
        }
      } catch (err) {
        console.warn('Could not read tv account:', err);
      }

      // If no account logged in on TV, open pairing tab
      setActiveTab('pairing');
      initializeNewTvSession();
      loadTvHomeContent();
    }
  }, [isOpen, initializeNewTvSession, loadTvHomeContent]);

  // Firestore real-time listener for pairing completion & account transfer
  useEffect(() => {
    if (!isOpen || !session?.sessionId || tvAccount) return;

    try {
      const unsub = onSnapshot(doc(db, 'pairingSessions', session.sessionId), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PairingSession;
          setSession(data);

          // Check if TV has been claimed & authorized with user account
          if (data.status === 'paired' && data.userAccount) {
            // Permanently log in the TV with user's account
            setTvAccount(data.userAccount);
            try {
              localStorage.setItem(TV_STORAGE_KEY, JSON.stringify(data.userAccount));
            } catch (err) {
              console.warn('Could not save TV auth account to localStorage:', err);
            }

            // Transition TV to logged in Home screen
            setActiveTab('home');
            loadTvHomeContent(data.userAccount.uid);
          }
        }
      }, (error) => {
        console.warn('Snapshot listener note:', error.message);
      });

      return () => unsub();
    } catch (e) {
      console.warn('onSnapshot error:', e);
    }
  }, [isOpen, session?.sessionId, tvAccount, loadTvHomeContent]);

  // Expiration countdown
  useEffect(() => {
    if (!isOpen || !session || session.status !== 'pending' || tvAccount) return;

    const interval = setInterval(() => {
      const expires = new Date(session.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, session, tvAccount]);

  // Handler: Log Out / Unlink TV
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  const handleUnlinkTv = () => {
    if (!confirmingUnlink) {
      setConfirmingUnlink(true);
      return;
    }
    setConfirmingUnlink(false);
    setTvAccount(null);
    try {
      localStorage.removeItem(TV_STORAGE_KEY);
    } catch (err) {
      console.warn(err);
    }
    setActiveTab('pairing');
    initializeNewTvSession();
    loadTvHomeContent();
  };

  // Quick testing action: Pair current logged in user directly
  const handleQuickPairAsCurrentUser = async () => {
    if (!currentUser || !session) return;
    try {
      setQuickPairing(true);
      const res = await claimPairingSession(session.sessionId, currentUser.uid, {
        email: currentUser.email || '',
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Athlete',
        photoURL: currentUser.photoURL || '',
      });

      if (res?.session?.userAccount) {
        setTvAccount(res.session.userAccount);
        localStorage.setItem(TV_STORAGE_KEY, JSON.stringify(res.session.userAccount));
        setActiveTab('home');
        loadTvHomeContent(currentUser.uid);
      }
    } catch (err) {
      console.error('Quick pairing error:', err);
    } finally {
      setQuickPairing(false);
    }
  };

  const handleCopyCode = () => {
    if (!session?.pairingCode) return;
    navigator.clipboard.writeText(session.pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (!isOpen) return null;

  const pairingCode = session?.pairingCode || session?.sessionId || '';
  const formattedCode = pairingCode.length === 8
    ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}`
    : pairingCode;

  const pairingUrl = pairingCode
    ? `${window.location.origin}/?tab=pair&session=${pairingCode}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      {/* 16:9 Aspect TV Bezel Container */}
      <div className="bg-[#121212] border-4 border-[#2A2926] rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl relative text-white flex flex-col justify-between my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* TV Top Frame Bezel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 text-xs gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-neutral-400 tracking-wider uppercase text-[10px]">
              LG webOS 24 Workout Companion
            </span>
            <span aria-hidden="true" className="text-neutral-700">·</span>
            {tvAccount ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 font-medium text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Logged in: <strong>{tvAccount.displayName || tvAccount.email}</strong></span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[11px]">
                <span>Unlinked TV · Awaiting Login</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                  activeTab === 'home' ? 'bg-[#2A2926] text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                TV Home Screen
              </button>
              <button
                onClick={() => setActiveTab('pairing')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                  activeTab === 'pairing' ? 'bg-[#2A2926] text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tvAccount ? 'Device & Account Settings' : 'Pairing QR & Code'}
              </button>
            </div>

            {tvAccount && (
              <button
                onClick={handleUnlinkTv}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border cursor-pointer transition-colors ${
                  confirmingUnlink
                    ? 'bg-red-600 text-white border-red-500 font-semibold'
                    : 'text-red-400 hover:text-red-300 hover:bg-red-950/40 border-red-900/40'
                }`}
                title={confirmingUnlink ? 'Click again to confirm TV logout' : 'Log out and unlink this TV'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{confirmingUnlink ? 'Confirm Unlink?' : 'Unlink TV'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full transition-colors cursor-pointer ml-1"
              title="Close TV Simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TV Screen Display Viewport */}
        <div className="my-4 min-h-[460px] flex flex-col justify-between bg-black rounded-xl p-6 sm:p-8 relative overflow-hidden border border-neutral-900">
          {activeTab === 'pairing' ? (
            /* TV Pairing Screen */
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
              {/* QR Code Container */}
              <div className="bg-white p-5 rounded-2xl shadow-xl flex flex-col items-center shrink-0">
                {session ? (
                  <QRCodeSVG
                    value={pairingUrl}
                    size={190}
                    level="H"
                    includeMargin
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
                  </div>
                )}
                <span className="text-[10px] text-neutral-700 font-bold mt-2 tracking-wider uppercase font-mono">
                  Scan QR with Phone Camera
                </span>
              </div>

              {/* Instructions & 8-Digit Code Display */}
              <div className="max-w-md space-y-4 text-left">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {tvAccount ? 'Manage Paired Account' : 'Log In to this LG TV'}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Scan the QR code or enter the 8-digit Pairing ID on your phone or computer. The Pairing ID logs in this TV directly with your Workout Companion user account.
                  </p>
                </div>

                {tvAccount ? (
                  /* Already Logged In Information */
                  <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>TV Permanently Logged In</span>
                    </div>
                    <div className="text-xs text-emerald-200/90 space-y-1">
                      <div>User: <strong>{tvAccount.displayName}</strong></div>
                      <div>Email: <code className="font-mono">{tvAccount.email}</code></div>
                      <div>Linked UID: <code className="font-mono text-[11px]">{tvAccount.uid}</code></div>
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('home')}
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Go to My TV Home
                      </button>
                      <button
                        onClick={handleUnlinkTv}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          confirmingUnlink
                            ? 'bg-red-600 text-white font-semibold'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        }`}
                      >
                        {confirmingUnlink ? 'Confirm Sign Out' : 'Sign Out TV'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Prominent 8-Digit Pairing Code Display */
                  <div className="space-y-3">
                    <div className="p-4 bg-neutral-900 border-2 border-[#B45309] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#F59E0B] font-semibold uppercase tracking-wider">
                        <span>8-Digit Pairing ID</span>
                        <span className="text-[11px] font-normal text-neutral-400 lowercase">
                          case-insensitive
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 bg-black/60 p-3 rounded-lg border border-neutral-800">
                        <span className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-white selection:bg-amber-500">
                          {formattedCode || '--------'}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded transition-colors cursor-pointer"
                          title="Copy 8-digit pairing code"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-[11px] text-neutral-400">
                        Type this code in the <strong className="text-white">Pair Your TV</strong> tab to authorize.
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-1.5 text-amber-400 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Code expires in: {Math.floor(secondsRemaining / 60)}:
                          {String(secondsRemaining % 60).padStart(2, '0')}
                        </span>
                      </div>

                      <button
                        onClick={initializeNewTvSession}
                        disabled={loadingSession}
                        className="inline-flex items-center gap-1 text-[#F59E0B] hover:underline cursor-pointer"
                        title="Generate Fresh Code"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${loadingSession ? 'animate-spin' : ''}`} />
                        <span>Refresh Code</span>
                      </button>
                    </div>

                    {/* Quick Pair Actions for testing */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          if (session && onSelectPairingSession) {
                            onSelectPairingSession(session.pairingCode);
                            onClose();
                          }
                        }}
                        className="px-3 py-1.5 bg-[#B45309] hover:bg-[#D97706] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Pair in Web Console</span>
                      </button>

                      {currentUser && (
                        <button
                          onClick={handleQuickPairAsCurrentUser}
                          disabled={quickPairing}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-emerald-900/60 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Instant simulator pairing"
                        >
                          <Zap className={`w-3.5 h-3.5 ${quickPairing ? 'animate-bounce' : ''}`} />
                          <span>{quickPairing ? 'Logging in...' : `Quick Login as ${currentUser.displayName || 'You'}`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TV Home Screen with Scheduled Banner & Workout Library */
            <div className="space-y-6">
              {/* Personalized User Status Bar */}
              {tvAccount && (
                <div className="flex items-center justify-between p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#B45309] text-white flex items-center justify-center font-bold text-xs">
                      {tvAccount.displayName?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <div className="font-bold text-white">Welcome back, {tvAccount.displayName}!</div>
                      <div className="text-[11px] text-neutral-400">Account: {tvAccount.email} · Permanent TV Client</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ● Cloud Synced
                  </span>
                </div>
              )}

              {/* Scheduled TV Top Banner Slot */}
              {activeBanner ? (
                <div className="relative h-44 sm:h-52 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  <img
                    src={activeBanner.imageUrl}
                    alt={activeBanner.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-5">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-[#F59E0B] mb-1">
                      Featured Today on TV
                    </span>
                    <h2 className="text-lg sm:text-2xl font-bold text-white max-w-xl leading-snug">
                      {activeBanner.title}
                    </h2>
                  </div>
                </div>
              ) : (
                <div className="h-32 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between p-6">
                  <div>
                    <h2 className="text-base font-bold text-white">Daily Workout Primer</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      No active custom banner scheduled. Showing standard warm-up companion card.
                    </p>
                  </div>
                  {!tvAccount && (
                    <button
                      onClick={() => setActiveTab('pairing')}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded cursor-pointer"
                    >
                      Pair Device
                    </button>
                  )}
                </div>
              )}

              {/* TV Workout Routine Row (Carousels) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-neutral-200">
                    {tvAccount ? `${tvAccount.displayName}'s Workouts` : 'Public Workout Routines'}
                  </h3>
                  <div className="text-xs text-neutral-500 font-numeric">
                    {tvRoutines.length} routine(s) ready
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {tvRoutines.length === 0 ? (
                    <div className="col-span-3 p-6 text-center text-xs text-neutral-500 bg-neutral-900/40 rounded-xl">
                      {tvAccount
                        ? 'No personal routines saved yet. Create a routine in the Web Console to display here.'
                        : 'No public routines available.'}
                    </div>
                  ) : (
                    tvRoutines.slice(0, 3).map((r) => (
                      <div
                        key={r.id}
                        className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-sm text-white">{r.name}</div>
                          <div className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
                            {r.description || 'Full circuit flow'}
                          </div>
                          <div className="text-[11px] text-[#F59E0B] font-numeric mt-2">
                            {r.items.length} exercises · {Math.round(r.estimatedDurationSeconds / 60)} mins
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                          <span className="capitalize">{r.difficulty}</span>
                          <span className="flex items-center gap-1 text-white">
                            <Play className="w-3 h-3 fill-current text-[#F59E0B]" />
                            <span>Start (Remote OK)</span>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TV Bottom Stand Footer */}
        <div className="text-center pt-2">
          <div className="w-48 h-2 bg-neutral-800 rounded-full mx-auto mb-1"></div>
          <span className="text-[10px] text-neutral-600 tracking-wider uppercase font-semibold">
            LG webOS Companion Emulator
          </span>
        </div>
      </div>
    </div>
  );
};
