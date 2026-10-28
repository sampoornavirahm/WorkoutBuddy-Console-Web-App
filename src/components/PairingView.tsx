import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useAuth } from '../context/AuthContext';
import { PairingSession, PairedDevice } from '../types';
import {
  getPairingSession,
  claimPairingSession,
  createPairingSession,
  getPairedDevices,
  revokePairedDevice,
  removePairedDevice
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
  Sparkles,
  Camera,
  KeyRound,
  Upload,
  Copy,
  Check,
  Trash2,
  LogOut,
  ExternalLink,
  SwitchCamera
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
  const { currentUser, userProfile, effectiveRole } = useAuth();

  // Mode: 'code' (enter 8-digit ID) or 'qr' (scan QR code)
  const [activeMode, setActiveMode] = useState<'code' | 'qr'>('code');

  const [pairingInput, setPairingInput] = useState('');
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  // Connected Devices List
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Camera QR Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Format 8-digit pairing code e.g. "K8N2 - 9X4F"
  const formatCodeDisplay = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (clean.length > 4) {
      return `${clean.slice(0, 4)} - ${clean.slice(4)}`;
    }
    return clean;
  };

  // Load connected TV devices for the logged-in user
  const loadConnectedDevices = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoadingDevices(true);
      const devices = await getPairedDevices(currentUser.uid);
      setPairedDevices(devices || []);
    } catch (err) {
      console.warn('Could not load paired devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadConnectedDevices();
  }, [loadConnectedDevices]);

  // Check URL query parameters for ?session=...
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSession = urlParams.get('session');
    if (paramSession) {
      const clean = paramSession.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      setPairingInput(clean);
      fetchSession(clean);
    }
  }, []);

  // Countdown timer for session expiry
  useEffect(() => {
    if (!session || session.status !== 'pending') return;

    const interval = setInterval(() => {
      const expires = new Date(session.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setError('This TV pairing ID has expired. Please refresh the code on your TV screen.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const fetchSession = async (codeOrId: string) => {
    const clean = codeOrId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!clean) {
      setError('Please enter the 8-digit Pairing ID displayed on your TV screen.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const s = await getPairingSession(clean);
      if (!s) {
        setError(`Pairing ID "${clean}" not found. Please verify the 8-digit code shown on your TV.`);
        setSession(null);
      } else {
        setSession(s);
        if (s.status === 'paired') {
          setError('This TV has already been paired and logged in.');
        } else if (s.status === 'expired' || new Date(s.expiresAt).getTime() < Date.now()) {
          setError('This TV pairing code has expired. Please refresh the code on your TV.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error validating pairing session.');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Authorize and permanently log in TV with current user's account
  const handleClaim = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!session) return;

    try {
      setClaiming(true);
      setError(null);

      const profilePayload = {
        email: currentUser.email || userProfile?.email || '',
        displayName: currentUser.displayName || userProfile?.displayName || currentUser.email?.split('@')[0] || 'Athlete',
        photoURL: currentUser.photoURL || userProfile?.photoURL || '',
        role: effectiveRole || 'user',
      };

      const result = await claimPairingSession(session.sessionId, currentUser.uid, profilePayload);

      setSuccess(true);
      setSession(prev => prev ? {
        ...prev,
        status: 'paired',
        pairedByUid: currentUser.uid,
        userAccount: result.session.userAccount,
      } : null);

      await loadConnectedDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to authorize and log in TV.');
    } finally {
      setClaiming(false);
    }
  };

  // Handle revoking / unlinking a paired TV device
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleRevokeDevice = async (deviceUid: string) => {
    if (!currentUser) return;
    if (confirmRevokeId !== deviceUid) {
      setConfirmRevokeId(deviceUid);
      return;
    }

    try {
      setConfirmRevokeId(null);
      await revokePairedDevice(currentUser.uid, deviceUid);
      await loadConnectedDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke TV device.');
    }
  };

  // --- QR Camera Scanning Implementation ---
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const parseQrText = useCallback((data: string) => {
    try {
      // Check if URL format: https://.../?tab=pair&session=K8N29X4F
      if (data.includes('session=')) {
        const url = new URL(data);
        const code = url.searchParams.get('session');
        if (code) return code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      }
    } catch {
      // Not a valid URL, fallback to raw text
    }
    return data.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      const extractedCode = parseQrText(code.data);
      if (extractedCode) {
        stopCamera();
        setPairingInput(extractedCode);
        setActiveMode('code');
        fetchSession(extractedCode);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera, parseQrText]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      setCameraError(
        'Unable to access camera. Please allow camera permissions in your browser or enter the 8-digit Pairing ID directly.'
      );
      setIsScanning(false);
    }
  };

  // Toggle front / back camera
  const handleToggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  useEffect(() => {
    if (isScanning) {
      startCamera();
    }
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Image upload QR decoder fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const extractedCode = parseQrText(code.data);
          setPairingInput(extractedCode);
          setActiveMode('code');
          fetchSession(extractedCode);
        } else {
          setError('No valid QR code detected in this photo. Please enter the 8-digit code directly.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-white border border-[#E6E4DF] rounded-2xl shadow-xs text-[#171615] mb-2">
          <Tv className="w-8 h-8 text-[#B45309]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
          Pair Your LG webOS TV
        </h1>
        <p className="text-xs sm:text-sm text-[#6E6C67] max-w-lg mx-auto">
          Scan the QR code or enter the 8-digit Pairing ID displayed on your TV screen. The pairing ID permanently logs in the TV with your Workout Companion account.
        </p>
      </div>

      {/* Main Action Card */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Method Toggle Tabs (Enter 8-digit ID vs Scan QR) */}
        {!success && !session && (
          <div className="flex bg-[#F3F1EC] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveMode('code');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'code'
                  ? 'bg-white text-[#171615] shadow-xs'
                  : 'text-[#6E6C67] hover:text-[#171615]'
              }`}
            >
              <KeyRound className="w-4 h-4 text-[#B45309]" />
              <span>Enter 8-Digit Pairing ID</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode('qr');
                startCamera();
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'qr'
                  ? 'bg-white text-[#171615] shadow-xs'
                  : 'text-[#6E6C67] hover:text-[#171615]'
              }`}
            >
              <Camera className="w-4 h-4 text-[#B45309]" />
              <span>Scan TV QR Code</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {success ? (
          <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-300 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#171615]">TV Successfully Logged In!</h2>
              <p className="text-xs text-[#6E6C67] max-w-md mx-auto mt-1 leading-relaxed">
                Your LG webOS TV is now permanently logged in with your account{' '}
                <strong className="text-[#171615]">{currentUser?.displayName || currentUser?.email}</strong>.
                All your personalized routines, workout plans, and exercise animations are synchronized live.
              </p>
            </div>

            <div className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl text-xs text-[#6E6C67] max-w-md mx-auto text-left space-y-1">
              <div className="font-semibold text-[#171615] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Permanent Account Link Active</span>
              </div>
              <div>Connected Device: <strong>{session?.deviceName || 'LG webOS TV'}</strong></div>
              <div>Account UID: <code className="font-mono text-[11px]">{currentUser?.uid}</code></div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                onClick={onOpenTvSimulator}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Tv className="w-4 h-4 text-[#F59E0B]" />
                <span>View Synced TV Simulator</span>
              </button>

              <button
                onClick={() => {
                  setSuccess(false);
                  setSession(null);
                  setPairingInput('');
                  setActiveMode('code');
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#D1CFCA] text-[#171615] hover:bg-[#F3F1EC] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Pair Another TV
              </button>
            </div>
          </div>
        ) : session ? (
          /* Active Pairing Confirmation Flow (Step 2: Review TV & Confirm Login) */
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B45309]">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#171615]">{session.deviceName}</h3>
                    <div className="text-[11px] text-[#6E6C67] font-mono">
                      Pairing ID: <strong className="text-[#171615] font-bold">{session.pairingCode || session.sessionId}</strong>
                    </div>
                  </div>
                </div>

                {/* Expiration countdown badge */}
                {timeLeftSeconds !== null && (
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#B45309] bg-[#FEF3C7] px-2.5 py-1 rounded-md">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {Math.floor(timeLeftSeconds / 60)}:
                      {String(timeLeftSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              {/* Account Confirmation Card */}
              <div className="pt-3 border-t border-[#E6E4DF] text-xs text-[#6E6C67] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Log in TV with account:</span>
                  <span className="font-bold text-[#171615]">{currentUser?.displayName || currentUser?.email || 'Anonymous'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Email address:</span>
                  <code className="font-mono text-[#171615]">{currentUser?.email || 'Not signed in'}</code>
                </div>
              </div>
            </div>

            {/* Authentication Guard */}
            {!currentUser ? (
              <div className="p-4 bg-[#F3F1EC] rounded-xl text-center space-y-3">
                <p className="text-xs text-[#171615] font-medium">
                  Please sign in to log this TV into your personal athlete profile and routines.
                </p>
                <button
                  onClick={onOpenLogin}
                  className="px-5 py-2.5 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer shadow-xs"
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
                      <RefreshCw className="w-4 h-4 animate-spin text-[#F59E0B]" />
                      <span>Logging into TV with your account...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                      <span>Authorize & Log In TV with My Account</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-between text-[11px] text-[#9C9A94]">
                  <span>Permanent account login on this TV client</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSession(null);
                      setPairingInput('');
                    }}
                    className="text-[#6E6C67] hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeMode === 'qr' ? (
          /* Live QR Camera Scanner */
          <div className="space-y-4 animate-in fade-in">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video sm:aspect-4/3 max-w-md mx-auto border-2 border-[#171615] shadow-lg flex items-center justify-center">
              {isScanning ? (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Viewfinder Target Overlay */}
                  <div className="absolute inset-0 border-36 border-black/60 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-[#F59E0B] rounded-2xl relative shadow-inner">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-[#F59E0B] rounded-tl" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-[#F59E0B] rounded-tr" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-[#F59E0B] rounded-bl" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-[#F59E0B] rounded-br" />
                    </div>
                  </div>

                  {/* Scanner controls top bar */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleCamera}
                      className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors cursor-pointer"
                      title="Switch Camera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="px-3 py-1 bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium rounded-full">
                      Point camera at TV screen QR code
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-3 text-neutral-400">
                  <Camera className="w-10 h-10 mx-auto text-neutral-500" />
                  <p className="text-xs">Camera is currently paused or inactive.</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer"
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                {cameraError}
              </p>
            )}

            {/* QR Photo Upload Option */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAFAF8] hover:bg-[#F3F1EC] border border-[#D1CFCA] rounded-lg text-[#171615] cursor-pointer font-medium">
                <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Upload QR Image / Screenshot</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setActiveMode('code');
                }}
                className="text-xs text-[#B45309] hover:underline cursor-pointer font-medium"
              >
                Or enter 8-digit Pairing ID manually
              </button>
            </div>
          </div>
        ) : (
          /* Option 1: 8-Digit Alphanumeric Code Input Form */
          <div className="space-y-4 animate-in fade-in">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#171615]">
                  Enter 8-Digit Pairing ID
                </label>
                <span className="text-[11px] text-[#6E6C67]">
                  Displayed directly on your TV screen
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={11}
                    value={formatCodeDisplay(pairingInput)}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                      setPairingInput(clean);
                      setError(null);
                    }}
                    placeholder="e.g. K8N2 - 9X4F"
                    className="w-full px-4 py-2.5 text-lg font-mono font-bold tracking-widest text-[#171615] bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] uppercase text-center sm:text-left"
                  />
                  {pairingInput && (
                    <button
                      type="button"
                      onClick={() => setPairingInput('')}
                      className="absolute right-3 top-3 text-[#9C9A94] hover:text-[#171615] cursor-pointer text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fetchSession(pairingInput)}
                  disabled={loading || pairingInput.length < 4}
                  className="px-5 py-2.5 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] disabled:opacity-40 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {loading ? 'Finding TV...' : 'Verify Pairing ID'}
                </button>
              </div>

              <p className="text-[11px] text-[#9C9A94] mt-1.5">
                The 8-digit alphanumeric ID is case-insensitive (e.g. <span className="font-mono text-[#171615]">K8N29X4F</span> or <span className="font-mono text-[#171615]">k8n2-9x4f</span>).
              </p>
            </div>

            {/* Quick TV Simulator Link */}
            <div className="pt-4 border-t border-[#F3F1EC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6C67]">
              <span>Testing without a physical LG TV in front of you?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenTvSimulator}
                  className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Launch LG TV Simulator</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connected TV Devices List */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6E4DF]">
          <div>
            <h3 className="font-bold text-base text-[#171615]">Your Connected TV Devices</h3>
            <p className="text-xs text-[#6E6C67] mt-0.5">
              LG webOS TVs permanently logged in with your account.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-[#F3F1EC] text-[#6E6C67] rounded-md">
            {pairedDevices.length} Connected
          </span>
        </div>

        {loadingDevices ? (
          <div className="p-6 text-center text-xs text-[#6E6C67] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#B45309]" />
            <span>Loading paired devices...</span>
          </div>
        ) : !currentUser ? (
          <div className="p-6 text-center text-xs text-[#6E6C67] bg-[#FAFAF8] rounded-xl space-y-2">
            <p>Please sign in to view and manage your connected TVs.</p>
            <button
              onClick={onOpenLogin}
              className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer"
            >
              Sign In Now
            </button>
          </div>
        ) : pairedDevices.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E6C67] bg-[#FAFAF8] rounded-xl space-y-2 border border-dashed border-[#D1CFCA]">
            <Tv className="w-8 h-8 mx-auto text-[#9C9A94]" />
            <p className="font-semibold text-[#171615]">No TVs logged into your account yet</p>
            <p className="max-w-xs mx-auto">
              Scan the QR or enter the 8-digit Pairing ID shown on your LG TV to link it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F1EC]">
            {pairedDevices.map((dev) => (
              <div key={dev.deviceUid} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B45309]">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#171615]">{dev.deviceName}</span>
                      {dev.active ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active · Logged In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">
                          Disconnected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6E6C67] font-mono mt-0.5">
                      UID: {dev.deviceUid.slice(0, 16)}... · Linked {new Date(dev.pairedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {confirmRevokeId === dev.deviceUid ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(dev.deviceUid)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
                      >
                        Confirm Disconnect
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(null)}
                        className="px-2 py-1 text-[11px] text-[#6E6C67] hover:text-[#171615] bg-[#F3F1EC] rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevokeDevice(dev.deviceUid)}
                      className="p-1.5 text-[#6E6C67] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Disconnect this TV"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Architecture Reference Notice */}
      <div className="p-4 bg-white border border-[#E6E4DF] rounded-xl text-xs text-[#6E6C67] space-y-1.5 shadow-xs">
        <div className="font-semibold text-[#171615] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#B45309]" />
          <span>Zero-Trust 8-Digit Pairing & Account Linking Architecture</span>
        </div>
        <p className="leading-relaxed">
          The 8-digit alphanumeric pairing handshake transfers authenticated user credentials directly to the TV client via an atomic transaction, registering the hardware under <code className="font-mono text-[#171615]">users/&#123;uid&#125;/pairedDevices</code>. This permanently authorizes the TV to stream user routines and schedules while preventing session hijacking or unauthorized access.
        </p>
      </div>
    </div>
  );
};
