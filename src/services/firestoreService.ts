import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  UserProfile,
  UserRole,
  UserRoleRecord,
  PairedDevice,
  PairingSession,
  Exercise,
  Routine,
  Banner
} from '../types';
import { CURATED_EXERCISES, ALL_DATASET_EXERCISES, resolveExerciseMedia } from '../data/curatedExercises';

// --- Profiles ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `userProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: Partial<UserProfile> & { uid: string; email: string }): Promise<void> {
  const path = `userProfiles/${profile.uid}`;
  try {
    const existing = await getUserProfile(profile.uid);
    const now = new Date().toISOString();
    const data: UserProfile = {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName || existing?.displayName || '',
      photoURL: profile.photoURL || existing?.photoURL || '',
      preferredUnits: profile.preferredUnits || existing?.preferredUnits || 'metric',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'userProfiles', profile.uid), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Roles ---
export async function getUserRole(uid: string, userEmail?: string | null): Promise<UserRole> {
  const path = `userRoles/${uid}`;
  // Bootstrap administrator email check
  if (userEmail && userEmail.toLowerCase() === 'jcob1289@gmail.com') {
    return 'admin';
  }
  try {
    const snap = await getDoc(doc(db, 'userRoles', uid));
    if (snap.exists()) {
      const data = snap.data() as UserRoleRecord;
      return data.role || 'user';
    }
    return 'user';
  } catch (error) {
    console.warn(`Could not fetch userRoles/${uid}, falling back to 'user'.`, error);
    return 'user';
  }
}

export async function setUserRole(targetUid: string, role: UserRole, adminUid: string): Promise<void> {
  const path = `userRoles/${targetUid}`;
  try {
    const data: UserRoleRecord = {
      uid: targetUid,
      role,
      grantedAt: new Date().toISOString(),
      grantedBy: adminUid,
    };
    await setDoc(doc(db, 'userRoles', targetUid), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getAllUserRoles(): Promise<UserRoleRecord[]> {
  const path = 'userRoles';
  try {
    const snap = await getDocs(collection(db, 'userRoles'));
    return snap.docs.map(d => d.data() as UserRoleRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Connected TV Devices ---
export async function getPairedDevices(uid: string): Promise<PairedDevice[]> {
  const path = `users/${uid}/pairedDevices`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'pairedDevices'));
    return snap.docs.map(d => d.data() as PairedDevice);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function revokePairedDevice(uid: string, deviceUid: string): Promise<void> {
  const path = `users/${uid}/pairedDevices/${deviceUid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'pairedDevices', deviceUid), {
      active: false,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removePairedDevice(uid: string, deviceUid: string): Promise<void> {
  const path = `users/${uid}/pairedDevices/${deviceUid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'pairedDevices', deviceUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- 8-Digit Alphanumeric QR & Pairing Handshake ---
export function generatePairingCode(): string {
  // 8 uppercase alphanumeric chars, avoiding ambiguous chars like 0/O, 1/I/L
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createPairingSession(
  deviceName = 'LG OLED C3 (webOS TV)',
  customDeviceUid?: string
): Promise<PairingSession> {
  const pairingCode = generatePairingCode();
  const sessionId = pairingCode; // 8-digit alphanumeric document ID
  const deviceUid = customDeviceUid || 'dev_' + Math.random().toString(36).substring(2, 12);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes for convenient pairing

  const session: PairingSession = {
    sessionId,
    pairingCode,
    deviceUid,
    deviceName,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const path = `pairingSessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'pairingSessions', sessionId), session);
    return session;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getPairingSession(codeOrSessionId: string): Promise<PairingSession | null> {
  const normalized = codeOrSessionId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (!normalized) return null;

  // 1. Direct getDoc by normalized ID (O(1))
  try {
    const snap = await getDoc(doc(db, 'pairingSessions', normalized));
    if (snap.exists()) {
      return snap.data() as PairingSession;
    }
  } catch (error) {
    console.warn('Direct lookup error for pairing session:', error);
  }

  // 2. Query by pairingCode field in case doc had an alternate id format
  try {
    const q = query(collection(db, 'pairingSessions'), where('pairingCode', '==', normalized));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as PairingSession;
    }
  } catch (error) {
    console.warn('Pairing code query error:', error);
  }

  return null;
}

export async function claimPairingSession(
  codeOrSessionId: string,
  userUid: string,
  userProfile?: { email?: string; displayName?: string; photoURL?: string; role?: string }
): Promise<{ pairedDevice: PairedDevice; session: PairingSession }> {
  const session = await getPairingSession(codeOrSessionId);
  if (!session) {
    throw new Error('Pairing session not found. Please check the 8-digit pairing ID.');
  }

  const sessionRef = doc(db, 'pairingSessions', session.sessionId);
  const now = new Date().toISOString();
  const userAccount = {
    uid: userUid,
    email: userProfile?.email || '',
    displayName: userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Athlete',
    photoURL: userProfile?.photoURL || '',
    role: userProfile?.role || 'user',
    pairedAt: now,
  };

  try {
    return await runTransaction(db, async (txn) => {
      const snap = await txn.get(sessionRef);
      if (!snap.exists()) {
        throw new Error('Pairing session not found.');
      }
      const current = snap.data() as PairingSession;
      if (current.status !== 'pending') {
        throw new Error(`This TV pairing session has already been ${current.status}.`);
      }
      if (new Date(current.expiresAt).getTime() < Date.now()) {
        txn.update(sessionRef, { status: 'expired' });
        throw new Error('This pairing session has expired. Please refresh the code on your TV.');
      }

      // Mark session as paired with full user account for TV client permanent login
      txn.update(sessionRef, {
        status: 'paired',
        pairedByUid: userUid,
        pairedAt: now,
        userAccount,
      });

      // Record device permanently under users/{uid}/pairedDevices/{deviceUid}
      const deviceRef = doc(db, 'users', userUid, 'pairedDevices', current.deviceUid);
      const pairedDevice: PairedDevice = {
        deviceUid: current.deviceUid,
        deviceName: current.deviceName,
        pairedAt: now,
        lastSeenAt: now,
        active: true,
        lastPairingSessionId: current.sessionId,
        pairingCode: current.pairingCode,
        userEmail: userAccount.email,
      };
      txn.set(deviceRef, pairedDevice);

      const updatedSession: PairingSession = {
        ...current,
        status: 'paired',
        pairedByUid: userUid,
        pairedAt: now,
        userAccount,
      };

      return { pairedDevice, session: updatedSession };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pairingSessions/${session.sessionId}`);
  }
}

// --- Exercises ---
export async function getExercises(): Promise<Exercise[]> {
  try {
    const snap = await getDocs(collection(db, 'exercises'));
    if (!snap.empty) {
      const cloudExercises = snap.docs.map(d => {
        const raw = { ...d.data(), id: d.id } as Exercise;
        const resolved = resolveExerciseMedia(raw);
        return {
          ...raw,
          mediaUrl: resolved.mediaUrl,
          posterUrl: resolved.posterUrl,
          mediaType: resolved.mediaType,
        };
      });
      const cloudMap = new Map<string, Exercise>();
      cloudExercises.forEach(ex => cloudMap.set(ex.id, ex));

      const merged = ALL_DATASET_EXERCISES.map(base => cloudMap.get(base.id) || base);
      // Include custom user-created exercises
      cloudExercises.forEach(ex => {
        if (!ALL_DATASET_EXERCISES.some(b => b.id === ex.id)) {
          merged.unshift(ex);
        }
      });
      return merged;
    }
  } catch (error) {
    console.warn('Could not reach Firestore exercises collection, serving bundled dataset:', error);
  }
  return ALL_DATASET_EXERCISES;
}

export async function saveExercise(exercise: Partial<Exercise> & { name: string }): Promise<Exercise> {
  const now = new Date().toISOString();
  const id = exercise.id || 'ex_' + Math.random().toString(36).substring(2, 10);
  const path = `exercises/${id}`;
  const resolved = resolveExerciseMedia(exercise);

  const data: Exercise = {
    id,
    name: exercise.name,
    slug: exercise.slug || exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: exercise.description || '',
    primaryMuscles: exercise.primaryMuscles || ['Full Body'],
    secondaryMuscles: exercise.secondaryMuscles || [],
    equipment: exercise.equipment || 'Bodyweight',
    difficulty: exercise.difficulty || 'beginner',
    instructions: exercise.instructions || [],
    mediaUrl: resolved.mediaUrl,
    mediaType: resolved.mediaType,
    posterUrl: resolved.posterUrl,
    durationSeconds: exercise.durationSeconds || 3,
    loop: exercise.loop ?? true,
    sourceUrl: exercise.sourceUrl || '',
    licenceName: exercise.licenceName || 'Gym visual / Free for personal use',
    attributionText: exercise.attributionText || '© Gym visual — https://gymvisual.com/',
    status: exercise.status || 'published',
    createdAt: exercise.createdAt || now,
    updatedAt: now,
    createdBy: exercise.createdBy || '',
  };

  try {
    await setDoc(doc(db, 'exercises', id), data, { merge: true });
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteExercise(id: string): Promise<void> {
  const path = `exercises/${id}`;
  try {
    await deleteDoc(doc(db, 'exercises', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultCuratedExercises(): Promise<void> {
  try {
    const now = new Date().toISOString();
    for (const item of CURATED_EXERCISES) {
      const id = 'curated_' + item.slug;
      const ex: Exercise = {
        ...item,
        id,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system_curated',
      };
      await setDoc(doc(db, 'exercises', id), ex);
    }
  } catch (err) {
    console.warn('Auto-seed curated exercises skipped or permission deferred:', err);
  }
}

// Admin batch synchronization of all 1,324 dataset items to Firestore
export async function syncExercisesToFirestore(
  onProgress?: (synced: number, total: number) => void
): Promise<number> {
  const batchSize = 40;
  let count = 0;
  const total = ALL_DATASET_EXERCISES.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = ALL_DATASET_EXERCISES.slice(i, i + batchSize);
    for (const ex of chunk) {
      const ref = doc(db, 'exercises', ex.id);
      batch.set(ref, ex, { merge: true });
    }
    await batch.commit();
    count += chunk.length;
    if (onProgress) {
      onProgress(count, total);
    }
    // Small pause to yield UI thread
    await new Promise(res => setTimeout(res, 50));
  }
  return count;
}

// --- Routines ---
export async function getRoutines(currentUid?: string, role: UserRole = 'user'): Promise<Routine[]> {
  const path = 'routines';
  try {
    const snap = await getDocs(collection(db, 'routines'));
    if (snap.empty && currentUid) {
      await seedInitialRoutine(currentUid);
      const reSnap = await getDocs(collection(db, 'routines'));
      return reSnap.docs.map(d => ({ ...d.data(), id: d.id } as Routine));
    }
    const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Routine));
    if (role === 'admin') {
      return all;
    }
    // Pro/User: see public routines and own routines
    return all.filter(r => r.visibility === 'public' || r.ownerUid === currentUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveRoutine(routine: Partial<Routine> & { name: string; ownerUid: string }): Promise<Routine> {
  const now = new Date().toISOString();
  const id = routine.id || 'rt_' + Math.random().toString(36).substring(2, 10);
  const path = `routines/${id}`;

  const data: Routine = {
    id,
    ownerUid: routine.ownerUid,
    ownerName: routine.ownerName || 'Athlete',
    name: routine.name,
    description: routine.description || '',
    category: routine.category || 'General Strength',
    difficulty: routine.difficulty || 'beginner',
    estimatedDurationSeconds: routine.estimatedDurationSeconds || 0,
    visibility: routine.visibility || 'private',
    status: routine.status || 'published',
    items: routine.items || [],
    createdAt: routine.createdAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'routines', id), data, { merge: true });
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function duplicateRoutine(source: Routine, newOwnerUid: string): Promise<Routine> {
  const now = new Date().toISOString();
  const id = 'rt_' + Math.random().toString(36).substring(2, 10);
  const copy: Routine = {
    ...source,
    id,
    ownerUid: newOwnerUid,
    name: `${source.name} (Copy)`,
    visibility: 'private',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  return saveRoutine(copy);
}

export async function deleteRoutine(id: string): Promise<void> {
  const path = `routines/${id}`;
  try {
    await deleteDoc(doc(db, 'routines', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function seedInitialRoutine(ownerUid: string): Promise<void> {
  try {
    const id = 'routine_starter_daily_primer';
    const now = new Date().toISOString();
    const starter: Routine = {
      id,
      ownerUid,
      ownerName: 'Workout Companion Studio',
      name: 'Full-Body Mobility & Strength Primer',
      description: 'A 15-minute balanced daily routine designed for optimal warmup, posture, and core engagement on LG webOS TV.',
      category: 'Mobility & Strength',
      difficulty: 'beginner',
      estimatedDurationSeconds: 900,
      visibility: 'public',
      status: 'published',
      items: [
        {
          id: 'item_1',
          exerciseId: 'ex_2368',
          exerciseName: 'Split Squat Bodyweight',
          mediaUrl: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/2368-9E25EOx.gif',
          mediaType: 'image/gif',
          position: 1,
          sets: 3,
          reps: 12,
          workSeconds: 30,
          restSeconds: 30,
          instructions: 'Focus on deliberate depth and knee tracking over toes.'
        },
        {
          id: 'item_2',
          exerciseId: 'ex_0662',
          exerciseName: 'Push-Up',
          mediaUrl: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0662-I4hDWkc.gif',
          mediaType: 'image/gif',
          position: 2,
          sets: 3,
          reps: 10,
          workSeconds: 25,
          restSeconds: 30,
          instructions: 'Maintain rigid core bracing throughout each repetition.'
        },
        {
          id: 'item_3',
          exerciseId: 'ex_0464',
          exerciseName: 'Forearm Front Plank',
          mediaUrl: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0464-CosupLu.gif',
          mediaType: 'image/gif',
          position: 3,
          sets: 3,
          reps: 1,
          workSeconds: 40,
          restSeconds: 25,
          instructions: 'Deep diaphragmatic breathing while engaging glutes.'
        }
      ],
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'routines', id), starter);
  } catch (err) {
    console.warn('Could not seed initial starter routine:', err);
  }
}

// --- Banners ---
export async function getBanners(): Promise<Banner[]> {
  const path = 'banners';
  try {
    const snap = await getDocs(collection(db, 'banners'));
    if (snap.empty) {
      await seedDefaultBanner();
      const reSnap = await getDocs(collection(db, 'banners'));
      return reSnap.docs.map(d => ({ ...d.data(), id: d.id } as Banner));
    }
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Banner));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveBanner(banner: Partial<Banner> & { title: string; imageUrl: string }): Promise<Banner> {
  const now = new Date().toISOString();
  const id = banner.id || 'ban_' + Math.random().toString(36).substring(2, 10);
  const path = `banners/${id}`;

  const startAt = banner.startAt || now;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const endAt = banner.endAt || futureDate.toISOString();

  const data: Banner = {
    id,
    title: banner.title,
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl || '',
    active: banner.active ?? true,
    startAt,
    endAt,
    priority: Number(banner.priority) || 1,
    createdAt: banner.createdAt || now,
    updatedAt: now,
    createdBy: banner.createdBy || '',
  };

  try {
    await setDoc(doc(db, 'banners', id), data, { merge: true });
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBanner(id: string): Promise<void> {
  const path = `banners/${id}`;
  try {
    await deleteDoc(doc(db, 'banners', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function seedDefaultBanner(): Promise<void> {
  try {
    const id = 'ban_starter_featured';
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 60);

    const banner: Banner = {
      id,
      title: 'Spring Conditioning Challenge: New Full-Body Workouts Available',
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
      linkUrl: '/routines',
      active: true,
      startAt: now.toISOString(),
      endAt: end.toISOString(),
      priority: 10,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: 'system_curated',
    };
    await setDoc(doc(db, 'banners', id), banner);
  } catch (err) {
    console.warn('Could not seed initial banner:', err);
  }
}
