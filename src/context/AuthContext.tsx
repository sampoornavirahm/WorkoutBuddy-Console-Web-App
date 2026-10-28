import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserRole, UserProfile } from '../types';
import { getUserRole, getUserProfile, saveUserProfile } from '../services/firestoreService';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  actualRole: UserRole;
  effectiveRole: UserRole;
  simulatedRole: UserRole | null;
  setSimulatedRole: (role: UserRole | null) => void;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string, displayName?: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [actualRole, setActualRole] = useState<UserRole>('user');
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const role = await getUserRole(user.uid, user.email);
          setActualRole(role);

          let prof = await getUserProfile(user.uid);
          if (!prof) {
            await saveUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Athlete',
              photoURL: user.photoURL || '',
              preferredUnits: 'metric',
            });
            prof = await getUserProfile(user.uid);
          }
          setUserProfile(prof);
        } catch (err) {
          console.warn('Error loading user role or profile:', err);
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Athlete',
            photoURL: user.photoURL || '',
            preferredUnits: 'metric',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setUserProfile(null);
        setActualRole('user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const [role, prof] = await Promise.all([
        getUserRole(currentUser.uid, currentUser.email),
        getUserProfile(currentUser.uid),
      ]);
      setActualRole(role);
      setUserProfile(prof);
    } catch (err) {
      console.warn('Failed refreshing profile:', err);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    if (cred.user) {
      try {
        const existing = await getUserProfile(cred.user.uid);
        if (!existing) {
          await saveUserProfile({
            uid: cred.user.uid,
            email: cred.user.email || '',
            displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Athlete',
            photoURL: cred.user.photoURL || '',
            preferredUnits: 'metric',
          });
        }
      } catch (err) {
        console.warn('Google sign-in user profile setup note:', err);
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await saveUserProfile({
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: displayName?.trim() || email.split('@')[0],
      preferredUnits: 'metric',
    });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await fbSignOut(auth);
    setSimulatedRole(null);
  };

  const effectiveRole = simulatedRole || actualRole;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        actualRole,
        effectiveRole,
        simulatedRole,
        setSimulatedRole,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
