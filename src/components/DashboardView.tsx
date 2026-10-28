import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PairedDevice, UserProfile } from '../types';
import {
  getPairedDevices,
  revokePairedDevice,
  saveUserProfile
} from '../services/firestoreService';
import {
  Tv,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Dumbbell,
  Sparkles,
  RefreshCw,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenTvSimulator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenTvSimulator,
}) => {
  const { currentUser, userProfile, actualRole, effectiveRole, refreshProfile } = useAuth();
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [preferredUnits, setPreferredUnits] = useState<'metric' | 'imperial'>('metric');
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPreferredUnits(userProfile.preferredUnits || 'metric');
    }
  }, [userProfile]);

  const loadDevices = async () => {
    if (!currentUser) return;
    try {
      setLoadingDevices(true);
      const devs = await getPairedDevices(currentUser.uid);
      setDevices(devs);
    } catch (err) {
      console.error('Failed to load paired devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDevices();
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setSavingProfile(true);
      await saveUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName,
        preferredUnits,
      });
      await refreshProfile();
      setEditingProfile(false);
      setMessage({ text: 'Profile updated successfully.', type: 'success' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: unknown) {
      setMessage({
        text: err instanceof Error ? err.message : 'Failed to update profile.',
        type: 'error'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRevokeDevice = async (deviceUid: string) => {
    if (!currentUser) return;
    if (!window.confirm('Disconnect this TV? It will immediately lose access to your workout library.')) return;
    try {
      await revokePairedDevice(currentUser.uid, deviceUid);
      await loadDevices();
      setMessage({ text: 'TV pairing revoked.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      setMessage({
        text: err instanceof Error ? err.message : 'Failed to revoke device.',
        type: 'error'
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Feedback banner */}
      {message && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Header section with minimal clean typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DF] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
            Athlete Dashboard
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#6E6C67] mt-1">
            <span>{currentUser ? currentUser.email : 'Guest visitor'}</span>
            <span aria-hidden="true">·</span>
            <span>Role: <strong className="capitalize text-[#171615]">{effectiveRole}</strong></span>
            {actualRole !== effectiveRole && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#B45309]">Simulated preview</span>
              </>
            )}
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('pair')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            <span>Pair New TV</span>
          </button>
          <button
            onClick={onOpenTvSimulator}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F3F1EC] border border-[#D1CFCA] text-[#171615] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Tv className="w-3.5 h-3.5 text-[#B45309]" />
            <span>Test with TV Emulator</span>
          </button>
        </div>
      </div>

      {/* Grid: Profile & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#171615]">Account Profile</h2>
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="text-xs text-[#B45309] hover:underline cursor-pointer font-medium"
            >
              {editingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {!editingProfile ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-[#6E6C67] block">Display Name</span>
                <span className="font-medium text-[#171615]">
                  {userProfile?.displayName || 'Not configured'}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#6E6C67] block">Email</span>
                <span className="font-medium text-[#171615]">
                  {userProfile?.email || currentUser?.email || 'Guest'}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#6E6C67] block">Measurement Units</span>
                <span className="font-medium text-[#171615] capitalize">
                  {userProfile?.preferredUnits || 'Metric (kg / km)'}
                </span>
              </div>
              <div className="pt-2 border-t border-[#F3F1EC]">
                <span className="text-xs text-[#6E6C67] block">Privilege Tier</span>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#B45309]" />
                  <span className="capitalize font-semibold text-[#171615]">{actualRole} tier</span>
                  <span className="text-[#9C9A94]">(Managed by security policy)</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Display Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#D1CFCA] rounded-md focus:outline-none focus:border-[#171615]"
                  placeholder="e.g. Alex Rivera"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Unit Preference</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferredUnits('metric')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border cursor-pointer ${
                      preferredUnits === 'metric'
                        ? 'bg-[#171615] text-white border-[#171615]'
                        : 'bg-white text-[#6E6C67] border-[#D1CFCA]'
                    }`}
                  >
                    Metric (kg/km)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredUnits('imperial')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border cursor-pointer ${
                      preferredUnits === 'imperial'
                        ? 'bg-[#171615] text-white border-[#171615]'
                        : 'bg-white text-[#6E6C67] border-[#D1CFCA]'
                    }`}
                  >
                    Imperial (lbs/mi)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="px-3 py-1.5 text-xs text-[#6E6C67] hover:text-[#171615] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-1.5 bg-[#171615] text-white text-xs font-medium rounded-md hover:bg-[#2A2926] disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Feature Navigation Cards based on Role */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigateTab('exercises')}
            className="p-5 bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl cursor-pointer transition-all hover:shadow-xs group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-[#F3F1EC] rounded-lg group-hover:bg-[#EAE7E0] transition-colors">
                <Dumbbell className="w-5 h-5 text-[#B45309]" />
              </div>
              <ExternalLink className="w-4 h-4 text-[#9C9A94] group-hover:text-[#171615] transition-colors" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm text-[#171615]">Exercise Library</h3>
              <span className="text-[11px] font-mono tabular-nums text-[#6E6C67] bg-[#F3F1EC] px-1.5 py-0.5 rounded font-medium">
                1,324+ animations
              </span>
            </div>
            <p className="text-xs text-[#6E6C67] leading-relaxed">
              Explore the complete 1,324 animated biomechanical exercises across 16 muscle groups and 14 equipment types.
            </p>
          </div>

          {(effectiveRole === 'pro' || effectiveRole === 'admin') ? (
            <div
              onClick={() => onNavigateTab('routines')}
              className="p-5 bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl cursor-pointer transition-all hover:shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-[#F3F1EC] rounded-lg group-hover:bg-[#EAE7E0] transition-colors">
                  <Sparkles className="w-5 h-5 text-[#B45309]" />
                </div>
                <ExternalLink className="w-4 h-4 text-[#9C9A94] group-hover:text-[#171615] transition-colors" />
              </div>
              <h3 className="font-semibold text-sm text-[#171615] mb-1">Routine Builder</h3>
              <p className="text-xs text-[#6E6C67] leading-relaxed">
                Compose customized workout routines, configure sets, reps, work/rest timers, and sync directly to connected TVs.
              </p>
            </div>
          ) : (
            <div className="p-5 bg-[#FAFAF8] border border-dashed border-[#D1CFCA] rounded-xl">
              <div className="p-2 bg-white rounded-lg inline-block mb-3 border border-[#E6E4DF]">
                <ShieldCheck className="w-5 h-5 text-[#9C9A94]" />
              </div>
              <h3 className="font-semibold text-sm text-[#171615] mb-1">Pro Routine Builder</h3>
              <p className="text-xs text-[#6E6C67] leading-relaxed mb-3">
                Routine creation is reserved for Pro and Admin athletes. Use the role switcher in the top bar to test the Pro workflow.
              </p>
              <span className="text-[11px] text-[#B45309] font-medium">
                Switch role above to preview
              </span>
            </div>
          )}

          {effectiveRole === 'admin' && (
            <>
              <div
                onClick={() => onNavigateTab('banners')}
                className="p-5 bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-[#F3F1EC] rounded-lg group-hover:bg-[#EAE7E0] transition-colors">
                    <Tv className="w-5 h-5 text-[#B45309]" />
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#9C9A94] group-hover:text-[#171615] transition-colors" />
                </div>
                <h3 className="font-semibold text-sm text-[#171615] mb-1">TV Banner Console</h3>
                <p className="text-xs text-[#6E6C67] leading-relaxed">
                  Manage temporary promotional banners displayed in the top banner slot on the LG webOS TV home screen.
                </p>
              </div>

              <div
                onClick={() => onNavigateTab('roles')}
                className="p-5 bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-[#F3F1EC] rounded-lg group-hover:bg-[#EAE7E0] transition-colors">
                    <ShieldCheck className="w-5 h-5 text-[#B45309]" />
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#9C9A94] group-hover:text-[#171615] transition-colors" />
                </div>
                <h3 className="font-semibold text-sm text-[#171615] mb-1">User & Role Auditor</h3>
                <p className="text-xs text-[#6E6C67] leading-relaxed">
                  Audit member access levels, assign Pro or Admin privileges, and inspect security timestamps.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connected TV Devices Section */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#171615]">Connected LG webOS TV Devices</h2>
            <p className="text-xs text-[#6E6C67] mt-0.5">
              Authorized TV displays linked to this account. Paired TVs receive your published routines automatically.
            </p>
          </div>
          <button
            onClick={loadDevices}
            disabled={loadingDevices}
            className="p-1.5 text-[#6E6C67] hover:text-[#171615] rounded hover:bg-[#F3F1EC] transition-colors cursor-pointer"
            title="Refresh device list"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDevices ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 border border-dashed border-[#E6E4DF] rounded-lg text-center space-y-3">
            <Tv className="w-8 h-8 text-[#9C9A94] mx-auto" />
            <div>
              <p className="text-sm font-medium text-[#171615]">No connected TV devices</p>
              <p className="text-xs text-[#6E6C67] max-w-md mx-auto mt-1">
                Scan the QR code displayed on your LG webOS TV app to authorize it, or launch the built-in emulator to test the pairing handshake.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigateTab('pair')}
                className="px-4 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer shadow-xs"
              >
                Open QR Pairing Terminal
              </button>
              <button
                onClick={onOpenTvSimulator}
                className="px-3 py-2 bg-white border border-[#D1CFCA] text-xs font-medium text-[#171615] rounded-lg hover:bg-[#F3F1EC] cursor-pointer"
              >
                Launch TV Emulator
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F1EC]">
            {devices.map((device) => (
              <div
                key={device.deviceUid}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#F3F1EC] rounded-lg text-[#171615] mt-0.5">
                    <Tv className="w-5 h-5 text-[#B45309]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#171615]">
                        {device.deviceName}
                      </span>
                      {device.active ? (
                        <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">Revoked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6E6C67] mt-1 font-numeric">
                      <span>Device ID: {device.deviceUid.substring(0, 12)}...</span>
                      <span aria-hidden="true">·</span>
                      <span>Paired: {new Date(device.pairedAt).toLocaleDateString()}</span>
                      {device.lastSeenAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Last seen: {new Date(device.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {device.active && (
                  <button
                    onClick={() => handleRevokeDevice(device.deviceUid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
