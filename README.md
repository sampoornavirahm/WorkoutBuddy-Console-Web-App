# Workout Companion Web Manager

A responsive web console for managing workout routines, exercise catalogues, animated demonstrations, LG webOS TV pairings, and temporary promotional banners.

Built strictly within **Firebase Spark Free-Tier** constraints:
- **No Cloud Functions**
- **No Cloud Run / custom backend server**
- **No Firebase Cloud Storage uploads** (as of February 2026, Cloud Storage requires the Blaze billing plan; all media assets are referenced via secure HTTPS URLs with live client validation)
- **100% Client-Side SPA** hosted on Firebase Hosting with Cloud Firestore & Firebase Authentication.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Workout Companion Web Manager                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │   Auth Guard    │  │  Role Context    │  │  Dev Mode Simulator  │  │
│  │ (Google/Email)  │  │ (user/pro/admin) │  │  (Instant Testing)    │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬───────────┘  │
│           │                    │                        │              │
│  ┌────────▼────────────────────▼────────────────────────▼───────────┐  │
│  │                            Views                                 │  │
│  │  - Dashboard & TV Devices    - Routine Builder (Pro/Admin)       │  │
│  │  - QR Pairing Terminal       - Exercise Manager (Admin/Pro)      │  │
│  │  - Banner Console (Admin)    - User Role Auditor (Admin)         │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ Firestore SDK
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Cloud Firestore (Spark)                         │
│  ├── userProfiles/{uid}                  (Owner read/update safe)      │
│  ├── userRoles/{uid}                     (Admin write, Owner read)     │
│  ├── users/{uid}/pairedDevices/{devUid}  (Owner revoke, TV device get) │
│  ├── pairingSessions/{sessionId}         (Atomic 2-min claim)          │
│  ├── pairingSessionCodes/{code}          (8-char code → session map)  │
│  ├── exercises/{exerciseId}              (Public read, Admin manage)   │
│  ├── routines/{routineId}                (Public/Owner read, Pro edit) │
│  ├── banners/{bannerId}                  (TV/Public read, Admin edit)  │
│  └── applicationSettings/public          (Read-only config)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Role Model & Permissions Matrix

| Capability | Regular User | Pro User | Admin |
| :--- | :---: | :---: | :---: |
| Sign in / reset password / profile | ✅ | ✅ | ✅ |
| View connected TV devices | ✅ | ✅ | ✅ |
| Revoke / unpair TV device | ✅ | ✅ | ✅ |
| Pair new TV via QR code | ✅ | ✅ | ✅ |
| Browse exercise catalogue & previews | ✅ | ✅ | ✅ |
| Create, edit, duplicate, & reorder own routines | ❌ | ✅ | ✅ |
| Manage all routines (including other owners) | ❌ | ❌ | ✅ |
| Create, edit, and archive exercises | ❌ | ❌ | ✅ |
| Configure TV home promotional banners | ❌ | ❌ | ✅ |
| Assign and audit user roles | ❌ | ❌ | ✅ |

The user interface is **not** the security boundary. All rules and invariants are strictly enforced in `firestore.rules`.

---

## Production Setup & Deployment Guide

### 1. Creating the Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, enter a project name (e.g. `workout-companion-web`), and follow the steps.
3. The project can remain on the default **Spark (No-Cost $0/month)** plan.

### 2. Enabling Authentication Providers
1. In the Firebase Console, open **Build** > **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Enable **Google**: configure your support email and save.
   - Enable **Email/Password**: toggle on **Email/Password** and save.
   - (Optional for TV emulator): Enable **Anonymous** if you wish physical TVs to generate pending pairing sessions anonymously.

### 3. Creating the Cloud Firestore Database
1. In the Firebase Console, open **Build** > **Firestore Database**.
2. Click **Create Database**.
3. Choose your nearest Cloud region (e.g., `nam5 (us-central)` or `eur3 (europe-west)`).
4. Start in **Production mode** (rules will be deployed in step 7).

### 4. Registering the Web App
1. On the Project Overview page, click the **Web icon (`</>`)** to register an app.
2. Enter an app nickname (e.g., `Workout Companion Web`).
3. Check **Also set up Firebase Hosting for this app**.
4. Copy the generated `firebaseConfig` object values.

### 5. Configuring Environment Variables
Create a local `.env` file based on `.env.example`:
```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"
```
Alternatively, in AI Studio, `firebase-applet-config.json` is automatically loaded by `src/lib/firebase.ts`.

### 6. Bootstrapping the First Administrator Securely
Because users cannot write their own role documents, the initial administrator must be seeded securely:

#### Option A: Firebase Console Manual Seed
1. Sign in once to the web application with your administrator Google account or Email to generate your `uid`.
2. Find your UID in **Authentication** > **Users**.
3. In **Firestore Database**, create a document:
   - Collection: `userRoles`
   - Document ID: `<YOUR_UID>`
   - Fields:
     - `uid` (string): `<YOUR_UID>`
     - `role` (string): `admin`
     - `grantedAt` (string): `<Current ISO Timestamp>`
     - `grantedBy` (string): `console_bootstrap`

#### Option B: Security Rules Bootstrap Email
The security rules in `firestore.rules` include an authorized project owner fallback:
```javascript
function isAdmin() {
  return isSignedIn() && (
    (request.auth.token.email == "jcob1289@gmail.com" && request.auth.token.email_verified == true) ||
    (exists(/databases/$(database)/documents/userRoles/$(request.auth.uid)) &&
     get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role == 'admin')
  );
}
```
When signing in with the designated verified owner email, you are instantly granted admin authority and can promote additional users from the **Access & Roles** tab.

### 7. Deploying Rules and Indexes
Using the Firebase CLI:
```bash
# Login to Firebase
firebase login

# Select your project
firebase use --add

# Deploy Firestore Security Rules and Indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 8. Running Locally
```bash
# Install dependencies
npm install

# Start Vite dev server on port 3000
npm run dev
```
Open `http://localhost:3000` in your browser.

### 9. Running Automated Tests & Local Emulators
The project includes a comprehensive Security Rules test suite:
```bash
# Start local emulators (Auth, Firestore, Hosting)
npm run emulators

# Run security rules test suite against the emulator
npm run test:rules
```

### 10. Deploying to Firebase Hosting (Site: workoutbuddyconsole)
The `firebase.json` file is configured with the target site `workoutbuddyconsole`:
```json
{
  "hosting": {
    "site": "workoutbuddyconsole",
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

To create and deploy this site:
```bash
# 1. Build the production Vite bundle
npm run build

# 2. If using multi-site hosting, create the site target once:
firebase hosting:sites:create workoutbuddyconsole

# 3. Deploy to Firebase Hosting
firebase deploy --only hosting
```
The application will be hosted at `https://workoutbuddyconsole.web.app` (or `https://workoutbuddyconsole.firebaseapp.com`).

---

## LG webOS TV Companion Integration

### Pairing ID and QR contract

The TV creates the session. Both clients must use Firebase project `workoutbuddyweb` and the `(default)` Firestore database.

1. Generate an 8-character uppercase code using `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (ambiguous `0`, `1`, `I`, `L`, and `O` are omitted). Use `crypto.getRandomValues`; do not use `Math.random`.
2. Create a unique `pairingSessions/{sessionId}` document with `sessionId`, the exact `pairingCode`, the TV's authenticated anonymous `deviceUid`, `deviceName`, `status: "pending"`, and `createdAt` / `expiresAt`. The physical TV code expires after 120 seconds.
3. In the same Firestore batch, create `pairingSessionCodes/{PAIRING_CODE}` with the matching `sessionId`, `deviceUid`, and expiration fields. The mapping and session must agree exactly; the deployed rules validate this atomically and allow only a single-document `get` of a valid code, not code-index listing.
4. Display this exact code on the TV. Generate the QR URL as `https://workoutbuddyconsole.web.app/?tab=pair&session={PAIRING_CODE}` (URL-encode the code). Do not put a different code, session document ID, or device UID in the QR URL.
5. In the web app, uppercase the entered/scanned value, remove visual spaces or hyphens, read `pairingSessionCodes/{PAIRING_CODE}`, fetch the referenced session, then verify its `pairingCode`, `deviceUid`, pending status, and expiration before showing the approval screen. QR scan and manual entry must resolve to the same `sessionId`.
6. On approval, atomically change that session from pending to paired and create `users/{uid}/pairedDevices/{deviceUid}`. The TV listens to the session document and proceeds only when it observes the paired state.

If pairing fails, compare the code displayed on the TV with the QR URL's `session` value, then inspect the two Firestore documents above. Confirm the mapping points to the same session and TV UID, the session is still pending and unexpired, both apps use the same project/database, TV Anonymous Authentication is enabled, and the latest Firestore rules have been deployed. Do not query or guess session IDs from the code; resolve the code through its mapping.

### Built-in LG TV Emulator
Click **TV Simulator** in the top navigation bar to launch the interactive 16:9 LG webOS emulator. You can test QR code generation, countdown expiration, and live synchronization without needing physical hardware.
