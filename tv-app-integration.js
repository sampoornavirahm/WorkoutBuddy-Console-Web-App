/**
 * ============================================================================
 * WORKOUT BUDDY TV APP - FIRESTORE INTEGRATION SDK & DATA MANIPULATION GUIDE
 * ============================================================================
 * Target Platform: LG webOS, Samsung Tizen, Android TV, Smart TV Web Views
 * Backend: Firebase Firestore (Project: "workoutbuddyweb", Database: "(default)")
 * 
 * This file demonstrates how your Smart TV application can:
 *  1. Generate an 8-character alphanumeric pairing code and start the pairing handshake
 *  2. Listen for real-time claim from the web app & permanently log in the user
 *  3. Query published exercise libraries and user workout routines
 *  4. Update TV heartbeat & real-time playback state in Firestore
 *  5. Flag incorrect exercise animations (right/wrong feedback)
 *  6. Record completed workout history for the paired user
 *  7. Unlink / Sign out the TV account
 * ============================================================================
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

// ----------------------------------------------------------------------------
// 1. FIREBASE CONFIGURATION (workoutbuddyweb)
// ----------------------------------------------------------------------------
export const firebaseTvConfig = {
  projectId: "workoutbuddyweb",
  appId: "1:274264390397:web:efb6547be42ecd26715c94",
  apiKey: "AIzaSyDjHmgy6SCCt8fUP1qjSM4G-GEo6PyOiKg",
  authDomain: "workoutbuddyweb.firebaseapp.com",
  storageBucket: "workoutbuddyweb.firebasestorage.app",
  messagingSenderId: "274264390397"
};

// Initialize Firebase App
const app = initializeApp(firebaseTvConfig);
const auth = getAuth(app);

// Connect strictly to the standard (default) Firestore database
export const db = getFirestore(app);

// ----------------------------------------------------------------------------
// 2. TV LOCAL STORAGE KEYS
// ----------------------------------------------------------------------------
export const TV_STORAGE = {
  USER_ACCOUNT: 'workoutbuddy_tv_authenticated_user',
  DEVICE_UID: 'workoutbuddy_tv_device_uid',
  DEVICE_NAME: 'workoutbuddy_tv_device_name',
};

/**
 * Returns or generates a persistent hardware UID for this Smart TV.
 */
export function getOrCreateTvDeviceId() {
  let uid = auth.currentUser && auth.currentUser.isAnonymous
    ? auth.currentUser.uid
    : localStorage.getItem(TV_STORAGE.DEVICE_UID);
  if (!uid) {
    // Generate unique TV client identifier (e.g. lg_tv_9x4fk2)
    uid = 'tv_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(TV_STORAGE.DEVICE_UID, uid);
  }
  return uid;
}

/**
 * Retrieves the currently authenticated TV user account from persistent storage.
 * Returns null if the TV is not yet paired.
 */
export function getTvAuthenticatedUser() {
  try {
    const raw = localStorage.getItem(TV_STORAGE.USER_ACCOUNT);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[TV App] Failed to parse saved TV user account:', err);
    return null;
  }
}

/**
 * Generates an 8-character uppercase alphanumeric code without ambiguous characters.
 */
export function generate8DigitPairingCode() {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let result = '';
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure pairing code generation is unavailable in this browser.');
  }
  while (result.length < 8) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes.forEach((byte) => {
      if (result.length < 8 && byte < 248) {
        result += chars.charAt(byte % chars.length);
      }
    });
  }
  return result;
}

function generateSessionId() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure TV session generation is unavailable in this browser.');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return 'tv_' + Array.prototype.map.call(bytes, (byte) =>
    ('0' + byte.toString(16)).slice(-2)
  ).join('');
}

// ----------------------------------------------------------------------------
// 3. TV PAIRING & AUTHENTICATION HANDSHAKE
// ----------------------------------------------------------------------------

/**
 * Initiates a new 8-character alphanumeric Pairing Session from the TV app.
 * Creates a session and code-index document atomically.
 * 
 * @param {string} tvModelName - e.g. 'LG OLED 65" (webOS)'
 * @returns {Promise<{ pairingCode: string, sessionId: string, pairingUrl: string }>}
 */
export async function createTvPairingSession(tvModelName = 'LG Smart TV') {
  let tvUser = auth.currentUser;
  if (!tvUser || !tvUser.isAnonymous) {
    if (tvUser) await auth.signOut();
    tvUser = (await signInAnonymously(auth)).user;
  }
  const deviceUid = tvUser.uid;
  localStorage.setItem(TV_STORAGE.DEVICE_UID, deviceUid);
  const pairingCode = generate8DigitPairingCode();
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000);

  const sessionPayload = {
    sessionId: sessionId,
    pairingCode: pairingCode,
    deviceUid: deviceUid,
    deviceName: tvModelName,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'pairingSessions', sessionId), {
    ...sessionPayload,
    expiresAtMillis: expiresAt.getTime(),
    expiresAtTimestamp: Timestamp.fromDate(expiresAt)
  });
  batch.set(doc(db, 'pairingSessionCodes', pairingCode), {
    sessionId,
    deviceUid,
    expiresAt: expiresAt.toISOString(),
    expiresAtMillis: expiresAt.getTime(),
    expiresAtTimestamp: Timestamp.fromDate(expiresAt)
  });
  await batch.commit();

  const pairingUrl = `https://workoutbuddyconsole.web.app/?tab=pair&session=${encodeURIComponent(pairingCode)}`;

  return {
    pairingCode,
    sessionId,
    pairingUrl,
    expiresAt
  };
}

/**
 * Starts a real-time listener on the TV for pairing verification.
 * When the user enters the code or scans the QR, the web app resolves the index
 * and updates the referenced pairing session to 'paired'.
 * 
 * @param {string} sessionId - Session document ID returned from createTvPairingSession
 * @param {Function} onPaired - Callback receiving user account { uid, email, displayName, photoURL, role }
 * @param {Function} onExpired - Callback when code has expired
 * @returns {Function} Unsubscribe function to stop listening
 */
export function listenForPairingCompletion(sessionId, onPaired, onExpired) {
  const sessionRef = doc(db, 'pairingSessions', sessionId);

  const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    // Check expiration
    if (data.status === 'expired' || new Date(data.expiresAt).getTime() < Date.now()) {
      if (onExpired) onExpired();
      return;
    }

    // Check if claimed and paired by the user
    if (data.status === 'paired' && data.userAccount) {
      console.log('[TV App] TV successfully paired to user account:', data.userAccount);

      // 1. Permanently store user account in TV local storage
      localStorage.setItem(TV_STORAGE.USER_ACCOUNT, JSON.stringify(data.userAccount));

      // 2. Notify TV app to transition to logged-in Home screen
      if (onPaired) onPaired(data.userAccount);

      // 3. Stop listener
      unsubscribe();
    }
  }, (err) => {
    console.warn('[TV App] Pairing listener warning:', err);
  });

  return unsubscribe;
}

/**
 * Unlinks and logs out the TV app.
 * Clears local credentials and marks device disconnected.
 */
export async function unlinkTvAccount() {
  const user = getTvAuthenticatedUser();
  const deviceUid = getOrCreateTvDeviceId();

  if (user && user.uid) {
    try {
      // Mark device inactive under users/{uid}/pairedDevices/{deviceUid}
      const devRef = doc(db, 'users', user.uid, 'pairedDevices', deviceUid);
      await updateDoc(devRef, {
        active: false,
        disconnectedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[TV App] Note disconnecting device in cloud:', err);
    }
  }

  // Clear persistent local TV credentials
  localStorage.removeItem(TV_STORAGE.USER_ACCOUNT);
  console.log('[TV App] TV account unlinked successfully.');
}

// ----------------------------------------------------------------------------
// 4. DATA READING FOR THE TV APP
// ----------------------------------------------------------------------------

/**
 * Fetches published exercise library for TV playback.
 * 
 * @param {number} maxResults - Optional limit (default 100)
 * @returns {Promise<Array>} List of exercise objects
 */
export async function fetchPublishedExercises(maxResults = 100) {
  const exRef = collection(db, 'exercises');
  const q = query(
    exRef,
    where('status', '==', 'published'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to the paired user's personalized workout routines in real-time.
 * As soon as the user creates or edits a routine on their phone or web app,
 * the TV UI immediately reflects the changes!
 * 
 * @param {string} userUid - The paired user's UID
 * @param {Function} onRoutinesUpdated - Callback receiving the updated routines array
 * @returns {Function} Unsubscribe function
 */
export function listenToUserRoutines(userUid, onRoutinesUpdated) {
  const routinesRef = collection(db, 'routines');

  // Query user's routines or public routines
  const q = query(
    routinesRef,
    where('ownerUid', '==', userUid)
  );

  return onSnapshot(q, (snapshot) => {
    const routines = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    onRoutinesUpdated(routines);
  }, (err) => {
    console.error('[TV App] Error subscribing to routines:', err);
  });
}

/**
 * Fetches active promotional or announcement banners for the TV Home Carousel.
 */
export async function fetchActiveTvBanners() {
  const bannersRef = collection(db, 'banners');
  const snapshot = await getDocs(bannersRef);
  const now = Date.now();

  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(b => b.active && new Date(b.startAt).getTime() <= now && new Date(b.endAt).getTime() >= now)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

// ----------------------------------------------------------------------------
// 5. DATA MANIPULATION & WRITING FROM THE TV APP
// ----------------------------------------------------------------------------

/**
 * Updates the TV heartbeat, current workout progress, and online status.
 * This allows the phone/web dashboard to show what is currently playing on the TV!
 * 
 * @param {string} currentRoutineId - ID of routine currently playing on TV (or null)
 * @param {string} playbackState - 'playing' | 'paused' | 'idle' | 'completed'
 * @param {number} currentExerciseIndex - Current index in routine
 */
export async function updateTvPlaybackState(currentRoutineId = null, playbackState = 'idle', currentExerciseIndex = 0) {
  const user = getTvAuthenticatedUser();
  if (!user || !user.uid) return;

  const deviceUid = getOrCreateTvDeviceId();
  const deviceDocRef = doc(db, 'users', user.uid, 'pairedDevices', deviceUid);

  try {
    await updateDoc(deviceDocRef, {
      active: true,
      lastSeenAt: new Date().toISOString(),
      currentRoutineId: currentRoutineId,
      playbackState: playbackState,
      currentExerciseIndex: currentExerciseIndex
    });
  } catch (err) {
    console.warn('[TV App] Could not update TV playback heartbeat:', err);
  }
}

/**
 * Flags an exercise animation from the TV remote (Correct vs. Wrong).
 * If users notice an incorrect GIF animation on the big screen, they can mark it wrong.
 * 
 * @param {string} exerciseId - Exercise ID
 * @param {boolean} isWrong - True if the animation is incorrect
 * @param {string} reason - Optional feedback reason (e.g. 'Shows squat instead of deadlift')
 */
export async function flagExerciseAnimationFromTv(exerciseId, isWrong = true, reason = 'Flagged from TV app') {
  const flagDocRef = doc(db, 'exerciseFlags', exerciseId);
  const now = new Date().toISOString();

  await setDoc(flagDocRef, {
    exerciseId: exerciseId,
    isGifWrong: isWrong,
    status: isWrong ? 'wrong' : 'correct',
    reason: reason,
    updatedAt: now
  }, { merge: true });

  console.log(`[TV App] Exercise ${exerciseId} flagged as ${isWrong ? 'WRONG' : 'CORRECT'}`);
}

/**
 * Records a completed workout session summary to Firestore.
 * 
 * @param {string} routineId - ID of completed routine
 * @param {string} routineName - Name of completed routine
 * @param {number} durationSeconds - Total workout time in seconds
 * @param {number} exercisesCompleted - Total exercise count
 */
export async function recordCompletedWorkout(routineId, routineName, durationSeconds, exercisesCompleted) {
  const user = getTvAuthenticatedUser();
  if (!user || !user.uid) {
    console.warn('[TV App] Cannot record workout: No user logged in.');
    return;
  }

  // Workouts log subcollection under the user
  const workoutHistoryRef = collection(db, 'users', user.uid, 'workoutHistory');
  const sessionRecord = {
    routineId,
    routineName,
    durationSeconds,
    exercisesCompleted,
    completedOnDevice: getOrCreateTvDeviceId(),
    deviceType: 'LG webOS TV',
    completedAt: new Date().toISOString()
  };

  const docRef = doc(workoutHistoryRef);
  await setDoc(docRef, sessionRecord);
  console.log('[TV App] Workout session recorded successfully:', docRef.id);
  return docRef.id;
}

// ----------------------------------------------------------------------------
// 6. QUICK USAGE EXAMPLE (LG webOS / Smart TV App Lifecycle)
// ----------------------------------------------------------------------------

/*
  // Example Startup Sequence in your TV App index.js:

  async function initTvApp() {
    const loggedInUser = getTvAuthenticatedUser();

    if (loggedInUser) {
      console.log('TV is logged in as:', loggedInUser.displayName);
      
      // 1. Show Home Screen
      showTvHomeScreen(loggedInUser);

      // 2. Real-time subscribe to user routines
      listenToUserRoutines(loggedInUser.uid, (routines) => {
        renderRoutinesCarousel(routines);
      });

      // 3. Heartbeat
      updateTvPlaybackState(null, 'idle', 0);
    } else {
      // TV not yet logged in -> show Pairing Screen
      const session = await createTvPairingSession('LG OLED 65" TV');

      // Display 8-character code (e.g. "K8N2 - 9X4F") and render QR Code for session.pairingUrl
      renderPairingScreen(session.pairingCode, session.pairingUrl);

      // Wait for user to verify on phone
      listenForPairingCompletion(
        session.sessionId,
        (userAccount) => {
          console.log('Handshake verified! Logged in as:', userAccount.email);
          showTvHomeScreen(userAccount);
        },
        () => {
          console.log('Code expired. Regenerating...');
          initTvApp();
        }
      );
    }
  }
*/
