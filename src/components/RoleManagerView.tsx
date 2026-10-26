import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, UserRoleRecord } from '../types';
import {
  getAllUserRoles,
  setUserRole
} from '../services/firestoreService';
import {
  ShieldCheck,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Info
} from 'lucide-react';

export const RoleManagerView: React.FC = () => {
  const { currentUser, actualRole, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  const [roles, setRoles] = useState<UserRoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUid, setTargetUid] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('pro');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await getAllUserRoles();
      setRoles(data);
    } catch (err) {
      console.error('Failed to load user roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentUser) return;
    if (!targetUid.trim()) {
      setFeedback({ text: 'Please enter a valid Firebase User UID.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      await setUserRole(targetUid.trim(), targetRole, currentUser.uid);
      setTargetUid('');
      await loadRoles();
      setFeedback({ text: `Assigned role "${targetRole}" to ${targetUid.trim()}.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to update user role.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DF] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
              Access & Privilege Auditor
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-[#6E6C67] mt-1">
            Manage privileged user roles (user, pro, admin) in Firestore collection <code className="font-numeric">userRoles/&#123;uid&#125;</code>.
          </p>
        </div>

        <button
          onClick={loadRoles}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F3F1EC] border border-[#D1CFCA] text-[#171615] text-xs font-medium rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Security Architecture Explainer */}
      <div className="p-4 bg-white border border-[#E6E4DF] rounded-xl space-y-2 text-xs text-[#6E6C67]">
        <div className="font-semibold text-[#171615] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#B45309]" />
          <span>Attribute-Based Security Boundary (ABAC)</span>
        </div>
        <p className="leading-relaxed">
          The user interface is not the security boundary. Role privilege records are stored in protected document paths <code className="font-numeric text-[#171615]">userRoles/&#123;uid&#125;</code> and can only be written by authenticated administrators. Regular and Pro users cannot self-promote.
        </p>
        <div className="text-[11px] text-[#9C9A94] pt-1 border-t border-[#F3F1EC]">
          Initial project bootstrap administrator: <code className="font-numeric text-[#171615]">jcob1289@gmail.com</code> (enforced in <code className="font-numeric text-[#171615]">firestore.rules</code>).
        </div>
      </div>

      {/* Form: Assign / Promote User */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 space-y-4 shadow-xs">
        <h2 className="text-base font-semibold text-[#171615]">Grant or Modify User Role</h2>
        <form onSubmit={handleAssignRole} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#171615] mb-1">
              Target User UID *
            </label>
            <input
              type="text"
              required
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
              placeholder="e.g. Firebase Auth UID (4rKq8z...)"
              className="w-full px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#171615] mb-1">
              Role Permission
            </label>
            <div className="flex gap-2">
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as UserRole)}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
              >
                <option value="user">User (Basic - Device viewer)</option>
                <option value="pro">Pro (Routine Creator)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Grant Role'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Role Directory Table */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[#E6E4DF]">
          <h2 className="text-base font-semibold text-[#171615]">Active Role Assignments</h2>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#FAFAF8] rounded animate-pulse"></div>
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E6C67] space-y-1">
            <p>No explicit role records seeded in <code className="font-numeric">userRoles</code> yet.</p>
            <p className="text-[11px] text-[#9C9A94]">
              Users default to "user" tier unless promoted above or authenticated as the bootstrap admin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF8] text-[#6E6C67] uppercase font-semibold border-b border-[#E6E4DF]">
                <tr>
                  <th className="px-6 py-3">User UID</th>
                  <th className="px-6 py-3">Role Level</th>
                  <th className="px-6 py-3">Granted Timestamp</th>
                  <th className="px-6 py-3">Granted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F1EC] text-[#171615]">
                {roles.map((r) => (
                  <tr key={r.uid} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-6 py-3.5 font-numeric font-medium">
                      {r.uid}
                      {currentUser?.uid === r.uid && (
                        <span className="ml-2 text-[10px] text-[#B45309] font-sans font-semibold">
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 capitalize">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        r.role === 'admin' ? 'text-purple-700' : (r.role === 'pro' ? 'text-[#B45309]' : 'text-[#6E6C67]')
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{r.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[#6E6C67] font-numeric">
                      {new Date(r.grantedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-[#6E6C67] font-numeric truncate max-w-[140px]">
                      {r.grantedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
