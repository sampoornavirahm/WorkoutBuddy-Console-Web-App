import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
  Tv,
  Dumbbell,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  LogIn,
  Sliders,
  Monitor
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenTvSimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenLogin,
  onOpenTvSimulator,
}) => {
  const { currentUser, actualRole, effectiveRole, simulatedRole, setSimulatedRole, logout } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#FAFAF8]/95 backdrop-blur-md border-b border-[#E6E4DF] transition-colors">
      {/* Top Banner indicating Simulated Role if active */}
      {simulatedRole && (
        <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-1.5 text-xs text-[#92400E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>
              Role preview active: <strong>{simulatedRole.toUpperCase()}</strong> (Actual account role: {actualRole})
            </span>
          </div>
          <button
            onClick={() => setSimulatedRole(null)}
            className="text-xs font-semibold underline hover:text-[#78350F] cursor-pointer"
          >
            Reset to actual role
          </button>
        </div>
      )}

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <span className="text-lg font-bold tracking-tight text-[#171615] whitespace-nowrap block">
              Companion Manager
            </span>
            <span className="text-[11px] text-[#6E6C67] block tracking-wide">
              LG webOS Companion
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6E6C67]">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
              currentTab === 'dashboard'
                ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                : 'hover:text-[#171615]'
            }`}
          >
            Dashboard
          </button>

          {(effectiveRole === 'pro' || effectiveRole === 'admin') && (
            <button
              onClick={() => onSelectTab('routines')}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
                currentTab === 'routines'
                  ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                  : 'hover:text-[#171615]'
              }`}
            >
              Routines
            </button>
          )}

          <button
            onClick={() => onSelectTab('exercises')}
            className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
              currentTab === 'exercises'
                ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                : 'hover:text-[#171615]'
            }`}
          >
            Exercise Library
          </button>

          {effectiveRole === 'admin' && (
            <button
              onClick={() => onSelectTab('banners')}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
                currentTab === 'banners'
                  ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                  : 'hover:text-[#171615]'
              }`}
            >
              TV Banners
            </button>
          )}

          {effectiveRole === 'admin' && (
            <button
              onClick={() => onSelectTab('roles')}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
                currentTab === 'roles'
                  ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                  : 'hover:text-[#171615]'
              }`}
            >
              Access & Roles
            </button>
          )}

          <button
            onClick={() => onSelectTab('pair')}
            className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
              currentTab === 'pair'
                ? 'text-[#171615] font-semibold border-b-2 border-[#171615]'
                : 'hover:text-[#171615]'
            }`}
          >
            Pair TV
          </button>
        </nav>

        {/* Zone 3: Primary Action / Account Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* TV Simulator Launcher Button */}
          <button
            onClick={onOpenTvSimulator}
            title="Launch interactive LG webOS TV emulator screen"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#171615] bg-[#F3F1EC] hover:bg-[#EAE7E0] border border-[#E6E4DF] rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-[#B45309]" />
            <span>TV Simulator</span>
          </button>

          {/* Development Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#6E6C67] hover:text-[#171615] bg-white border border-[#E6E4DF] rounded-md hover:border-[#D1CFCA] transition-colors whitespace-nowrap cursor-pointer"
              title="Switch role for testing views and permissions"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#B45309]" />
              <span className="capitalize">{effectiveRole}</span>
              <Sliders className="w-3 h-3 text-[#9C9A94]" />
            </button>

            {roleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white border border-[#E6E4DF] rounded-lg shadow-lg p-2 z-50 text-xs"
                onMouseLeave={() => setRoleMenuOpen(false)}
              >
                <div className="px-2 py-1 font-semibold text-[#171615] border-b border-[#F3F1EC] mb-1">
                  Preview Role Context
                </div>
                {(['user', 'pro', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSimulatedRole(r === actualRole ? null : r);
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between cursor-pointer ${
                      effectiveRole === r
                        ? 'bg-[#F3F1EC] font-semibold text-[#171615]'
                        : 'text-[#6E6C67] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    <span className="capitalize">{r}</span>
                    {r === actualRole && (
                      <span className="text-[10px] text-[#9C9A94]">(Your live role)</span>
                    )}
                  </button>
                ))}
                <div className="pt-1 mt-1 border-t border-[#F3F1EC] text-[10px] text-[#9C9A94] px-2">
                  Firestore rules enforce true server RBAC.
                </div>
              </div>
            )}
          </div>

          {/* User Sign In / Account Button */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-xs text-[#6E6C67] max-w-[130px] truncate">
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#171615] bg-white hover:bg-[#F3F1EC] border border-[#E6E4DF] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#6E6C67]" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#171615] hover:bg-[#2A2926] rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center overflow-x-auto gap-4 px-4 py-2 border-t border-[#E6E4DF] text-xs text-[#6E6C67] no-scrollbar">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`whitespace-nowrap ${currentTab === 'dashboard' ? 'text-[#171615] font-semibold' : ''}`}
        >
          Dashboard
        </button>
        {(effectiveRole === 'pro' || effectiveRole === 'admin') && (
          <button
            onClick={() => onSelectTab('routines')}
            className={`whitespace-nowrap ${currentTab === 'routines' ? 'text-[#171615] font-semibold' : ''}`}
          >
            Routines
          </button>
        )}
        <button
          onClick={() => onSelectTab('exercises')}
          className={`whitespace-nowrap ${currentTab === 'exercises' ? 'text-[#171615] font-semibold' : ''}`}
        >
          Exercises
        </button>
        {effectiveRole === 'admin' && (
          <button
            onClick={() => onSelectTab('banners')}
            className={`whitespace-nowrap ${currentTab === 'banners' ? 'text-[#171615] font-semibold' : ''}`}
          >
            Banners
          </button>
        )}
        {effectiveRole === 'admin' && (
          <button
            onClick={() => onSelectTab('roles')}
            className={`whitespace-nowrap ${currentTab === 'roles' ? 'text-[#171615] font-semibold' : ''}`}
          >
            Roles
          </button>
        )}
        <button
          onClick={() => onSelectTab('pair')}
          className={`whitespace-nowrap ${currentTab === 'pair' ? 'text-[#171615] font-semibold' : ''}`}
        >
          Pair TV
        </button>
        <button
          onClick={onOpenTvSimulator}
          className="whitespace-nowrap text-[#B45309] font-medium"
        >
          TV Emulator
        </button>
      </div>
    </header>
  );
};
