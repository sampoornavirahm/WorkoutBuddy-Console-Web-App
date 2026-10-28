/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { RoutineBuilderView } from './components/RoutineBuilderView';
import { ExerciseManagerView } from './components/ExerciseManagerView';
import { BannerManagerView } from './components/BannerManagerView';
import { RoleManagerView } from './components/RoleManagerView';
import { PairingView } from './components/PairingView';
import { LoginModal } from './components/LoginModal';
import { TvSimulatorModal } from './components/TvSimulatorModal';
import { AuthScreen } from './components/AuthScreen';
import { ShieldAlert, Sparkles, Tv, Dumbbell, ExternalLink } from 'lucide-react';

function AppContent() {
  const { currentUser, effectiveRole, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'routines' | 'exercises' | 'banners' | 'roles' | 'pair'>('dashboard');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTvSimulatorOpen, setIsTvSimulatorOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Sync tab with URL search parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const sessionParam = params.get('session');

    if (sessionParam) {
      setPendingSessionId(sessionParam);
      setCurrentTab('pair');
    } else if (tabParam && ['dashboard', 'routines', 'exercises', 'banners', 'roles', 'pair'].includes(tabParam)) {
      setCurrentTab(tabParam as typeof currentTab);
    }
  }, []);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab as typeof currentTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  const handleSelectPairingSession = (sessionId: string) => {
    setPendingSessionId(sessionId);
    handleSelectTab('pair');
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.pushState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#171615] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium text-[#6E6C67] tracking-wider uppercase">
            Loading Workout Companion...
          </span>
        </div>
      </div>
    );
  }

  // Without login, the application is strictly not visible
  if (!currentUser) {
    return <AuthScreen pendingPairingSessionId={pendingSessionId} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col text-[#171615]">
      {/* Top Bar Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenTvSimulator={() => setIsTvSimulatorOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={handleSelectTab}
            onOpenTvSimulator={() => setIsTvSimulatorOpen(true)}
          />
        )}

        {currentTab === 'routines' && (
          (effectiveRole === 'pro' || effectiveRole === 'admin') ? (
            <RoutineBuilderView />
          ) : (
            <UnauthorizedNotice
              requiredRole="Pro or Admin"
              currentRole={effectiveRole}
              onSwitchRole={() => handleSelectTab('dashboard')}
            />
          )
        )}

        {currentTab === 'exercises' && (
          <ExerciseManagerView onNavigateTab={handleSelectTab} />
        )}

        {currentTab === 'banners' && (
          effectiveRole === 'admin' ? (
            <BannerManagerView />
          ) : (
            <UnauthorizedNotice
              requiredRole="Admin"
              currentRole={effectiveRole}
              onSwitchRole={() => handleSelectTab('dashboard')}
            />
          )
        )}

        {currentTab === 'roles' && (
          effectiveRole === 'admin' ? (
            <RoleManagerView />
          ) : (
            <UnauthorizedNotice
              requiredRole="Admin"
              currentRole={effectiveRole}
              onSwitchRole={() => handleSelectTab('dashboard')}
            />
          )
        )}

        {currentTab === 'pair' && (
          <PairingView
            onNavigateTab={handleSelectTab}
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenTvSimulator={() => setIsTvSimulatorOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E6E4DF] bg-white py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E6C67]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#171615]">Workout Companion Web Manager</span>
            <span aria-hidden="true">·</span>
            <span>Firebase Spark Free-Tier Architecture</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsTvSimulatorOpen(true)}
              className="hover:text-[#171615] transition-colors cursor-pointer"
            >
              LG webOS Emulator
            </button>
            <span aria-hidden="true">·</span>
            <span>Zero-Trust ABAC Security</span>
            <span aria-hidden="true">·</span>
            <span>Client v1.0.0</span>
          </div>
        </div>
      </footer>

      {/* Login / Auth Modal */}
      {isLoginOpen && (
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          pendingPairingSessionId={pendingSessionId}
        />
      )}

      {/* Interactive LG webOS TV Simulator */}
      {isTvSimulatorOpen && (
        <TvSimulatorModal
          isOpen={isTvSimulatorOpen}
          onClose={() => setIsTvSimulatorOpen(false)}
          onSelectPairingSession={handleSelectPairingSession}
        />
      )}
    </div>
  );
}

// Clean unauthorized barrier component
function UnauthorizedNotice({
  requiredRole,
  currentRole,
  onSwitchRole,
}: {
  requiredRole: string;
  currentRole: string;
  onSwitchRole: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-[#E6E4DF] rounded-2xl shadow-xs text-center space-y-4">
      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[#171615]">Restricted Tier Access</h2>
        <p className="text-xs text-[#6E6C67] mt-1 max-w-sm mx-auto">
          This management section requires the <strong>{requiredRole}</strong> role. Your current active role context is <strong className="capitalize">{currentRole}</strong>.
        </p>
      </div>
      <p className="text-xs text-[#9C9A94]">
        Use the Role Switcher in the top navigation bar to preview this view under the simulated Pro or Admin perspective.
      </p>
      <button
        onClick={onSwitchRole}
        className="px-4 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer"
      >
        Return to Dashboard
      </button>
    </div>
  );
}

// React Error Boundary to prevent blank white screens
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AppErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6 text-center">
          <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 max-w-md w-full shadow-lg space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#171615]">Application Error</h2>
            <p className="text-xs text-[#6E6C67] leading-relaxed">
              {this.state.error?.message || 'An unexpected issue occurred while rendering.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
