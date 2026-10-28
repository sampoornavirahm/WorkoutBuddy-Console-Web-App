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
| `/pairingSessions/{sessionId}` | Public | TV creates session (`status: 'pending'`); Web user updates to (`'paired'`) | TV pairing session |
| `/pairingSessionCodes/{pairingCode}` | Public single-code get | TV creates code-to-session mapping | 8-character alphanumeric lookup key |
| `/users/{uid}/pairedDevices/{deviceUid}` | Paired TV & User | TV updates heartbeat, `lastSeenAt`, `currentRoutineId`, `playbackState` | Hardware registry and active playback status |
| `/routines/{routineId}` | User & Paired TV | Read-only on TV | Personalized workout routines created by the user |
| `/exercises/{exerciseId}` | Public | Read-only on TV | 1,300+ animated exercise catalogue |
| `/exerciseFlags/{exerciseId}` | Public | TV writes ratings (`isGifWrong`, `status: 'wrong'/'correct'`) | Flagging incorrect exercise GIFs from the TV remote |
| `/banners/{bannerId}` | Public | Read-only on TV | Promotional and announcement banners |
| `/users/{uid}/workoutHistory/{recordId}` | Paired TV & User | TV appends completed session summaries | Workouts finished on the TV |

---

## 3. Data Flow & Manipulation Examples

### A. TV Pairing & Account Handshake

1. **TV Generates an 8-Character Alphanumeric Pairing Code**:
   The TV first signs in anonymously. Its Firebase UID is the `deviceUid`. Generate an uppercase code (e.g. `K8N29X4F`) from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` using `crypto.getRandomValues`. Create a random session ID such as `tv_<32 hex characters>`. In one Firestore batch, create the pending session and the code index:
   ```javascript
   import { doc, Timestamp, writeBatch } from 'firebase/firestore';

   function generatePairingCode() {
     const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
     let code = '';
     while (code.length < 8) {
       const bytes = new Uint8Array(16);
       crypto.getRandomValues(bytes);
       bytes.forEach((byte) => {
         if (code.length < 8 && byte < 248) code += chars[byte % chars.length];
       });
     }
     return code;
   }

   const sessionBytes = new Uint8Array(16);
   crypto.getRandomValues(sessionBytes);
   const sessionId = 'tv_' + Array.prototype.map.call(sessionBytes, (byte) =>
     ('0' + byte.toString(16)).slice(-2)
   ).join('');
   const pairingCode = generatePairingCode();
   const deviceUid = tvAuth.currentUser.uid;
   const createdAt = new Date();
   const expiresAt = new Date(createdAt.getTime() + 120000);
   const batch = writeBatch(db);

   batch.set(doc(db, 'pairingSessions', sessionId), {
     pairingCode,
     sessionId,
     deviceUid,
     deviceName: 'LG OLED 65" (Living Room webOS)',
     status: 'pending',
     createdAt: createdAt.toISOString(),
     expiresAt: expiresAt.toISOString(),
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
   ```
   Display `pairingCode` on the TV. The QR must contain `https://workoutbuddyconsole.web.app/?tab=pair&session=K8N29X4F` with the same code in its `session` parameter. Both QR and manual entry resolve to the same session document. The code expires after two minutes.

2. **The Companion Web App Resolves the Code**:
   Trim spaces/hyphens and uppercase the entered or scanned code. Read only `pairingSessionCodes/{pairingCode}`, fetch its `pairingSessions/{sessionId}` document, then verify the session's `pairingCode`, `deviceUid`, pending status, and expiration match the mapping. Do not query by device name or assume the code is the session document ID.

3. **TV Listens for User Authorization**:
   ```javascript
   import { doc, onSnapshot } from 'firebase/firestore';

   const unsub = onSnapshot(doc(db, 'pairingSessions', sessionId), (snap) => {
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
