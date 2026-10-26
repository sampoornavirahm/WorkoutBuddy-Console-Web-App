# Workout Companion Web Manager

A responsive web application for managing workout routines, exercise catalogues, animated media assets, TV pairing sessions, and promotional banners for an existing LG webOS Workout Companion TV application. Built strictly within Firebase Spark free-tier constraints (no Cloud Storage uploads, no Cloud Functions, no custom backend).

> [!IMPORTANT]
> **Confirmed Product Decisions:**
> - **Visual Theme**: Minimalist studio monochrome with subtle warm tones (charcoal neutrals, warm off-white canvas, restrained bronze/warm slate accents, zero pill clutter).
> - **Catalogue Media**: Curated fitness library of open-source animations and video URLs with comprehensive attribution, plus manual custom HTTPS media URL validation.
> - **Local Role Testing**: Development role simulator toggle to switch seamlessly between Regular User, Pro, and Admin perspectives, while maintaining strict production Firestore security rules.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a desktop and mobile management console for athletes and coaches to build structured workout routines, browse exercise animation demonstrations, manage temporary LG TV promo banners, and link physical LG webOS TVs via QR code pairing.
- **Target Audience**:
  - *Regular Users*: View profile and revoke connected TV devices.
  - *Pro Users*: Browse published exercise animations, build customized routines (sets, reps, work/rest timers, reordering), duplicate routines, and publish to connected TVs.
  - *Admins*: Full catalogue curation (exercise creation, media URLs, licenses, attributions), global routine oversight, banner scheduling, and user role management.
- **TV Ecosystem Role**: The existing LG webOS TV app runs an older webOS browser engine and authenticates anonymously to read scheduled banners, public routines, and owner-linked routines without requiring backend changes.

---

## 2. User Experience & Visual Design

- **Visual Direction**: Minimalist studio monochrome with subtle warm tones (`#171615` charcoal surface, `#FAFAF8` warm chalk canvas, `#E7E5E0` hairline borders, and warm amber-stone accent `#B45309`/`#D97706`).
- **Typography & Scale**:
  - Display: `Plus Jakarta Sans` or `Manrope` for refined, clear section titles.
  - Body: `DM Sans` for crisp 14px–15px readability.
  - Data / Timing: `font-mono tabular-nums` for timers, reps, sets, and pairing countdowns.
- **Top Bar Contract**:
  - Zone 1: Clean brand wordmark **Companion Manager**.
  - Zone 2: Navigation links (`Dashboard`, `Routines`, `Exercise Library`, `Banners`, `Pair TV`).
  - Zone 3: Role indicator badge, Quick Role Switcher (Dev Mode), and User Account / Sign Out action.
- **Key Views**:
  1. **User Dashboard & Connected Devices**: Profile summary, paired LG TV cards with active status, last seen timestamp, and one-click unpair/revoke.
  2. **TV Pairing Screen (`/pair?session=...`)**: QR scan landing page showing device name, live countdown to 2-minute expiration, and atomic confirmation to link the TV to the authenticated account.
  3. **Exercise Catalogue & Manager**:
     - *Pro View*: Grid of exercises with muscle group filters, difficulty badges (unboxed text), live video/GIF animation modal preview, and equipment requirements.
     - *Admin View*: Create and edit exercises with curated open-source picker, HTTPS media validation, poster image preview, and license/attribution metadata.
  4. **Pro Routine Builder**: Multi-step or drag-and-drop routine composer with exercise addition, set/rep/rest timing configuration, total workout duration calculation, and publish toggle.
  5. **Banner Manager (Admin)**: Time-scheduled banner cards with priority ordering, image preview, active date ranges, and live TV preview slot simulation.
  6. **Role & Security Manager (Admin)**: Member role list (`user`, `pro`, `admin`) with audit tracking (`grantedAt`, `grantedBy`).

---

## 3. Key Product Decisions & Trade-Offs

- **Spark Free Plan Compliance (No Cloud Storage / No Cloud Functions)**:
  - *Approach*: Exercises and banners reference HTTPS media URLs (CDN hosted, open-source fitness asset repositories, or user-provided HTTPS links) with real media playback verification.
  - *Why*: Cloud Storage requires Blaze billing starting Feb 2026. This preserves zero-cost operation while keeping the data schema fully forward-compatible with Cloud Storage.
- **Atomic TV Pairing Flow**:
  - *Approach*: Firestore atomic write/transaction in Security Rules that validates `status == 'pending'`, `request.time < resource.data.expiresAt`, and marks the session as `paired` with `pairedByUid = request.auth.uid` while writing to `users/{uid}/pairedDevices/{deviceUid}`.
  - *Why*: Prevents session reuse, race conditions, and unauthorized device claiming without requiring a Node.js server.
- **Local Development Role Simulation vs. Live RBAC**:
  - *Approach*: The app reads `userRoles/{uid}` by default. In development mode, a top-level developer toolbar allows previewing the interface under different role contexts without altering Firestore root records unless explicitly saved by an admin.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

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
│  ├── exercises/{exerciseId}              (Public read, Admin manage)   │
│  ├── routines/{routineId}                (Public/Owner read, Pro edit) │
│  ├── banners/{bannerId}                  (TV/Public read, Admin edit)  │
│  └── applicationSettings/public          (Read-only config)            │
└────────────────────────────────────────────────────────────────────────┘
```

### Firestore Security Rules Architecture

1. **Default Deny**: `match /{document=**} { allow read, write: if false; }`
2. **`userProfiles/{uid}`**: `allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());` `allow write: if isOwner(uid) && isValidProfile();`
3. **`userRoles/{uid}`**: `allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());` `allow write: if isAdmin();`
4. **`exercises/{exerciseId}`**: `allow read: if true;` `allow write: if isAdmin() && isValidExercise();`
5. **`routines/{routineId}`**:
   - `allow read: if resource.data.visibility == 'public' || (isSignedIn() && (resource.data.ownerUid == request.auth.uid || isAdmin()));`
   - `allow create, update: if (isPro() || isAdmin()) && isValidRoutine();`
   - `allow delete: if (isPro() && resource.data.ownerUid == request.auth.uid) || isAdmin();`
6. **`pairingSessions/{sessionId}`**:
   - Pending TV can create session with valid duration (2 mins) and status 'pending'.
   - Authenticated user can claim unexpired pending session atomically.
7. **`banners/{bannerId}`**: `allow read: if true;` `allow write: if isAdmin();`

---

## 5. Implementation Roadmap & Phases

- **Phase 1: Project Setup & Firebase Core**
  - Install `firebase` package and configure client SDK (`firebase.ts`).
  - Create `firebase.json`, `firestore.rules`, and `.env.example`.
  - Set up `firebase-blueprint.json` schema blueprint.
- **Phase 2: Authentication & Role Management**
  - Implement Firebase Auth provider (Google popup + email/password login).
  - Implement role loader from `userRoles/{uid}` with fallback for bootstrap admin.
  - Add development role switcher bar for testing all perspectives.
- **Phase 3: QR Code TV Pairing Flow**
  - Support `/pair?session=...` URL handling.
  - Implement 2-minute countdown timer, validation, and atomic claim.
  - Connected TV device list with status and revoke functionality.
- **Phase 4: Exercise Catalogue & Media Manager**
  - Preloaded curated open-source exercise animations (squats, pushups, lunges, planks, jumping jacks, etc.) with real HTTPS assets and attribution.
  - Form validation with media playback test and poster fallback.
- **Phase 5: Pro Routine Builder**
  - Create, edit, reorder, and duplicate routines.
  - Exercise assignment with set/rep/timer duration calculators.
  - Public/private toggle and draft/published status.
- **Phase 6: Banner Management & Settings**
  - Admin banner creator with priority, date-range scheduling, and TV simulator preview.
- **Phase 7: Testing, Verification & Documentation**
  - Rules audit & test scripts.
  - Full README with Spark deployment instructions and admin bootstrap guide.
  - Production build verification (`npm run build`).
