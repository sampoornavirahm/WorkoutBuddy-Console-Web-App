# Workout Buddy - TV App Data Manipulation & Architecture Guide

This document describes how your Smart TV application (LG webOS, Samsung Tizen, Android TV, or custom TV web client) communicates with and manipulates Firestore data in the **`workoutbuddyweb`** Firebase project using the default database: `(default)`.

A drop-in JavaScript integration SDK is available at [`/tv-app-integration.js`](./tv-app-integration.js).

---

## 1. Firebase Configuration

Your TV application initializes Firebase with the following configuration targeting the project's standard `(default)` database:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "workoutbuddyweb",
  appId: "1:274264390397:web:efb6547be42ecd26715c94",
  apiKey: "AIzaSyDjHmgy6SCCt8fUP1qjSM4G-GEo6PyOiKg",
  authDomain: "workoutbuddyweb.firebaseapp.com",
  storageBucket: "workoutbuddyweb.firebasestorage.app",
  messagingSenderId: "274264390397"
};

const app = initializeApp(firebaseConfig);
// Connects directly to (default) database
const db = getFirestore(app);
```

---

## 2. Firestore Collections & Schema Map

| Collection Path | Read Access | TV Write Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/pairingSessions/{pairingCode}` | Public | TV creates session (`status: 'pending'`); Web user updates to (`'paired'`) | 8-character code handshake linking TV to user account |
| `/users/{uid}/pairedDevices/{deviceUid}` | Paired TV & User | TV updates heartbeat, `lastSeenAt`, `currentRoutineId`, `playbackState` | Hardware registry and active playback status |
| `/routines/{routineId}` | User & Paired TV | Read-only on TV | Personalized workout routines created by the user |
| `/exercises/{exerciseId}` | Public | Read-only on TV | 1,300+ animated exercise catalogue |
| `/exerciseFlags/{exerciseId}` | Public | TV writes ratings (`isGifWrong`, `status: 'wrong'/'correct'`) | Flagging incorrect exercise GIFs from the TV remote |
| `/banners/{bannerId}` | Public | Read-only on TV | Promotional and announcement banners |
| `/users/{uid}/workoutHistory/{recordId}` | Paired TV & User | TV appends completed session summaries | Workouts finished on the TV |

---

## 3. Data Flow & Manipulation Examples

### A. TV Pairing & Account Handshake

1. **TV Generates 8-Digit Pairing Code**:
   The TV generates an unambiguous 8-digit uppercase code (e.g. `K8N29X4F`) and saves it as a new document:
   ```javascript
   import { doc, setDoc } from 'firebase/firestore';

   await setDoc(doc(db, 'pairingSessions', 'K8N29X4F'), {
     sessionId: 'K8N29X4F',
     pairingCode: 'K8N29X4F',
     deviceUid: 'lg_tv_living_room_01',
     deviceName: 'LG OLED 65" (Living Room webOS)',
     status: 'pending',
     createdAt: new Date().toISOString(),
     expiresAt: new Date(Date.now() + 600000).toISOString() // 10 minutes
   });
   ```

2. **TV Listens for User Authorization**:
   ```javascript
   import { doc, onSnapshot } from 'firebase/firestore';

   const unsub = onSnapshot(doc(db, 'pairingSessions', 'K8N29X4F'), (snap) => {
     const data = snap.data();
     if (data?.status === 'paired' && data?.userAccount) {
       // Save to webOS / TV local storage
       localStorage.setItem('workoutbuddy_tv_authenticated_user', JSON.stringify(data.userAccount));
       unsub();
       loadTvHomeScreen(data.userAccount);
     }
   });
   ```

---

### B. Real-Time Routine Sync

The TV listens to the user's routines in real-time. If the user edits a routine on their phone, the TV updates instantly:

```javascript
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const routinesQuery = query(
  collection(db, 'routines'),
  where('ownerUid', '==', userAccount.uid)
);

onSnapshot(routinesQuery, (snapshot) => {
  const routines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderRoutinesList(routines);
});
```

---

### C. Updating TV Heartbeat & Playback State

Send live playback state back to the user's dashboard:

```javascript
import { doc, updateDoc } from 'firebase/firestore';

await updateDoc(doc(db, 'users', userAccount.uid, 'pairedDevices', deviceUid), {
  active: true,
  lastSeenAt: new Date().toISOString(),
  currentRoutineId: 'routine_full_body_hiit',
  playbackState: 'playing', // 'playing' | 'paused' | 'idle' | 'completed'
  currentExerciseIndex: 3
});
```

---

### D. Flagging Incorrect Exercise GIFs from TV Remote

Users can press a button on their remote to mark an animation as wrong:

```javascript
import { doc, setDoc } from 'firebase/firestore';

await setDoc(doc(db, 'exerciseFlags', exerciseId), {
  exerciseId: exerciseId,
  isGifWrong: true,
  status: 'wrong',
  reason: 'GIF does not match exercise description',
  updatedAt: new Date().toISOString()
}, { merge: true });
```

---

### E. Logging Completed Workouts

When a workout is completed on the TV:

```javascript
import { collection, addDoc } from 'firebase/firestore';

await addDoc(collection(db, 'users', userAccount.uid, 'workoutHistory'), {
  routineId: 'routine_full_body_hiit',
  routineName: 'Full Body HIIT',
  durationSeconds: 1840,
  exercisesCompleted: 12,
  completedOnDevice: deviceUid,
  completedAt: new Date().toISOString()
});
```

---

### F. Unlinking / Logging Out

```javascript
localStorage.removeItem('workoutbuddy_tv_authenticated_user');
// Optional: update device doc active: false
showPairingScreen();
```

---

## 4. How to Remove the Unused Secondary Database

To remove the secondary database from your Google Cloud / Firebase project:
1. Open the [Firebase Console Databases Page](https://console.firebase.google.com/project/workoutbuddyweb/firestore/databases) or [Google Cloud Firestore Console](https://console.cloud.google.com/firestore/databases?project=workoutbuddyweb).
2. You will see your databases listed (including `(default)` and any secondary database).
3. Click the three dots (⋮) next to the secondary database (e.g. `ai-studio-9182b16f-8638-482d-89d6-32b48c329c87`).
4. Click **Delete database** and confirm.
5. Your application is already configured to strictly use `(default)`.
