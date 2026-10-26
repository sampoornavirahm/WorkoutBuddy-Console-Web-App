import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PairingSession, Routine, Banner } from '../types';
import {
  createPairingSession,
  getBanners,
  getRoutines
} from '../services/firestoreService';
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
  AlertCircle
} from 'lucide-react';

interface TvSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPairingSession?: (sessionId: string) => void;
}

export const TvSimulatorModal: React.FC<TvSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSelectPairingSession,
}) => {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [tvBanners, setTvBanners] = useState<Banner[]>([]);
  const [tvRoutines, setTvRoutines] = useState<Routine[]>([]);
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'pairing'>('home');

  // Initialize TV pairing handshake session
  const initializeNewTvSession = useCallback(async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      const newSession = await createPairingSession('LG OLED 65" (Living Room webOS)');
      setSession(newSession);
      setSecondsRemaining(120);
    } catch (err: unknown) {
      console.warn('TV Pairing Session creation note:', err);
      // Generate a mock fallback session if offline or Firestore rule deferred
      const fallbackId = 'tv_' + Math.random().toString(36).substring(2, 10);
      setSession({
        sessionId: fallbackId,
        deviceUid: 'dev_simulated_lg_webos',
        deviceName: 'LG OLED 65" (Simulator)',
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      });
      setSecondsRemaining(120);
    } finally {
      setLoadingSession(false);
    }
  }, []);

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

  // Hook 1: Always execute unconditionally
  useEffect(() => {
    if (isOpen) {
      initializeNewTvSession();
      loadTvHomeContent();
    }
  }, [isOpen, initializeNewTvSession, loadTvHomeContent]);

  // Hook 2: Firestore listener (always unconditional)
  useEffect(() => {
    if (!isOpen || !session?.sessionId) return;
    try {
      const unsub = onSnapshot(doc(db, 'pairingSessions', session.sessionId), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PairingSession;
          setSession(data);
          if (data.status === 'paired' && data.pairedByUid) {
            loadTvHomeContent(data.pairedByUid);
          }
        }
      }, (error) => {
        console.warn('Snapshot listener deferred in emulator:', error.message);
      });

      return () => unsub();
    } catch (e) {
      console.warn('onSnapshot initialization notice:', e);
    }
  }, [isOpen, session?.sessionId, loadTvHomeContent]);

  // Hook 3: Expiration countdown (always unconditional)
  useEffect(() => {
    if (!isOpen || !session || session.status !== 'pending') return;
    const interval = setInterval(() => {
      const expires = new Date(session.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsRemaining(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, session]);

  // Conditional render AFTER all hooks have executed
  if (!isOpen) return null;

  const pairingUrl = session
    ? `${window.location.origin}/?tab=pair&session=${session.sessionId}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      {/* 16:9 Aspect TV Bezel Container */}
      <div className="bg-[#121212] border-4 border-[#2A2926] rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl relative text-white flex flex-col justify-between my-4">
        {/* TV Top Frame Bezel Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-400 tracking-wider uppercase text-[10px]">
              LG webOS 24 Workout Companion
            </span>
            <span aria-hidden="true" className="text-neutral-700">·</span>
            <span className="text-neutral-500 font-numeric">1920×1080 Native Client</span>
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
                Pairing QR Screen
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full transition-colors cursor-pointer ml-2"
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
              <div className="bg-white p-5 rounded-2xl shadow-xl flex flex-col items-center">
                {session ? (
                  <QRCodeSVG
                    value={pairingUrl}
                    size={200}
                    level="H"
                    includeMargin
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
                  </div>
                )}
                <span className="text-[10px] text-neutral-500 mt-2 font-numeric">
                  LG webOS One-Time QR Token
                </span>
              </div>

              {/* Instructions & Status */}
              <div className="max-w-md space-y-4 text-left">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Connect Your Workout Companion
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Scan this QR code with your smartphone camera to link your routines, exercise animations, and timers to this TV.
                  </p>
                </div>

                {session?.status === 'paired' ? (
                  <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>TV Successfully Linked!</span>
                    </div>
                    <p className="text-xs text-emerald-200">
                      Paired to account UID: <code className="font-numeric">{session.pairedByUid?.substring(0, 10)}...</code>
                    </p>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="mt-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Return to TV Home
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-numeric text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-2 rounded-lg">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        QR expires in: {Math.floor(secondsRemaining / 60)}:
                        {String(secondsRemaining % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-400 space-y-1">
                      <div>Device: <strong className="text-neutral-200">{session?.deviceName}</strong></div>
                      <div>Session ID: <code className="font-numeric text-neutral-300">{session?.sessionId}</code></div>
                    </div>

                    {/* Quick Link to open in this browser for instant test */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (session && onSelectPairingSession) {
                            onSelectPairingSession(session.sessionId);
                            onClose();
                          }
                        }}
                        className="px-3.5 py-2 bg-[#B45309] hover:bg-[#D97706] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Pair in Web Console Now</span>
                      </button>

                      <button
                        onClick={initializeNewTvSession}
                        disabled={loadingSession}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg cursor-pointer"
                        title="Generate Fresh QR Token"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${loadingSession ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TV Home Screen with Scheduled Banner & Workout Library */
            <div className="space-y-6">
              {/* Scheduled TV Top Banner Slot */}
              {activeBanner ? (
                <div className="relative h-44 sm:h-52 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  <img
                    src={activeBanner.imageUrl}
                    alt={activeBanner.title}
                    className="w-full h-full object-cover"
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
                  <button
                    onClick={() => setActiveTab('pairing')}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded cursor-pointer"
                  >
                    Pair Device
                  </button>
                </div>
              )}

              {/* TV Workout Routine Row (Carousels) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-neutral-200">
                    {session?.status === 'paired' ? 'My Synced Routines' : 'Public Workout Routines'}
                  </h3>
                  <div className="text-xs text-neutral-500 font-numeric">
                    {tvRoutines.length} routine(s) ready
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {tvRoutines.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
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
                  ))}
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
