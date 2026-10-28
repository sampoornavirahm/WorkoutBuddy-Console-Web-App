import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ExerciseVerificationFlag } from '../types';
export type { ExerciseVerificationFlag };

const STORAGE_KEY = 'workoutbuddy_exercise_gif_flags_v1';
const EVENT_NAME = 'workoutbuddy-exercise-flags-changed';

// In-memory cache initialized from localStorage
let memoryFlags: Record<string, ExerciseVerificationFlag> = {};

try {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    memoryFlags = JSON.parse(cached);
  }
} catch (err) {
  console.warn('Could not read cached exercise flags:', err);
}

function persistLocalFlags() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryFlags));
  } catch (err) {
    console.warn('Could not write flags to localStorage:', err);
  }
}

function broadcastUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: memoryFlags }));
  }
}

/**
 * Check if an exercise's GIF has been flagged as wrong.
 */
export function isExerciseGifWrong(exerciseId: string): boolean {
  const flag = memoryFlags[exerciseId];
  return flag ? flag.isGifWrong : false;
}

/**
 * Get the verification record for an exercise.
 */
export function getExerciseFlag(exerciseId: string): ExerciseVerificationFlag | null {
  return memoryFlags[exerciseId] || null;
}

/**
 * Get all current flags as a dictionary.
 */
export function getAllExerciseFlags(): Record<string, ExerciseVerificationFlag> {
  return { ...memoryFlags };
}

/**
 * Set an exercise GIF flag as correct (false) or wrong (true).
 * Persists locally and synchronizes with Firestore `/exerciseFlags/{exerciseId}`.
 */
export async function setExerciseGifFlag(
  exerciseId: string,
  isWrong: boolean,
  reason = '',
  userId?: string,
  userEmail?: string
): Promise<ExerciseVerificationFlag> {
  const now = new Date().toISOString();
  const flag: ExerciseVerificationFlag = {
    exerciseId,
    isGifWrong: isWrong,
    status: isWrong ? 'wrong' : 'correct',
    reason: reason.trim(),
    flaggedAt: now,
    flaggedBy: userId || 'anonymous',
    reporterEmail: userEmail || '',
  };

  // 1. Immediately update in-memory and local storage
  memoryFlags[exerciseId] = flag;
  persistLocalFlags();
  broadcastUpdate();

  // 2. Synchronize to Firestore
  try {
    const docPath = `exerciseFlags/${exerciseId}`;
    await setDoc(doc(db, 'exerciseFlags', exerciseId), flag, { merge: true });
  } catch (err) {
    console.warn(`Could not sync exercise flag for ${exerciseId} to Firestore:`, err);
  }

  return flag;
}

/**
 * Subscribe to exercise flag updates across components.
 */
export function subscribeExerciseFlags(callback: (flags: Record<string, ExerciseVerificationFlag>) => void): () => void {
  // Initial callback
  callback({ ...memoryFlags });

  const handler = () => {
    callback({ ...memoryFlags });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT_NAME, handler);
  }

  // Also listen to Firestore live changes if available
  let unsubscribeFirestore: (() => void) | null = null;
  try {
    unsubscribeFirestore = onSnapshot(
      collection(db, 'exerciseFlags'),
      (snapshot) => {
        let changed = false;
        snapshot.docs.forEach((d) => {
          const data = d.data() as ExerciseVerificationFlag;
          if (data && data.exerciseId) {
            memoryFlags[data.exerciseId] = data;
            changed = true;
          }
        });
        if (changed) {
          persistLocalFlags();
          callback({ ...memoryFlags });
        }
      },
      (error) => {
        console.warn('Real-time Firestore flag listener deferred (client in local mode):', error.message);
      }
    );
  } catch (err) {
    console.warn('Could not attach Firestore onSnapshot for exercise flags:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT_NAME, handler);
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}
