import { readFileSync } from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'modular-wallaby-xv4kj';

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed admin and pro roles in test database
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'userRoles', 'admin_user_uid'), {
        uid: 'admin_user_uid',
        role: 'admin',
        grantedAt: new Date().toISOString(),
        grantedBy: 'system',
      });
      await setDoc(doc(db, 'userRoles', 'pro_user_uid'), {
        uid: 'pro_user_uid',
        role: 'pro',
        grantedAt: new Date().toISOString(),
        grantedBy: 'admin_user_uid',
      });
      await setDoc(doc(db, 'userRoles', 'regular_user_uid'), {
        uid: 'regular_user_uid',
        role: 'user',
        grantedAt: new Date().toISOString(),
        grantedBy: 'admin_user_uid',
      });
    });
  });

  // 1. ANONYMOUS TV CLIENT TESTS
  describe('Anonymous TV Client Security', () => {
    it('allows an unpaired TV to create a valid pending pairing session', async () => {
      const tvContext = testEnv.authenticatedContext('tv_anonymous_uid');
      const db = tvContext.firestore();
      const expiresAt = new Date(Date.now() + 120000).toISOString();

      await assertSucceeds(
        setDoc(doc(db, 'pairingSessions', 'tv_session_123'), {
          sessionId: 'tv_session_123',
          deviceUid: 'tv_anonymous_uid',
          deviceName: 'LG OLED C3',
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt,
        })
      );
    });

    it('denies an anonymous TV from modifying exercise catalogues', async () => {
      const tvContext = testEnv.authenticatedContext('tv_anonymous_uid');
      const db = tvContext.firestore();

      await assertFails(
        setDoc(doc(db, 'exercises', 'malicious_ex'), {
          name: 'Hacked Exercise',
          difficulty: 'beginner',
          mediaUrl: 'https://example.com/ex.gif',
          mediaType: 'image/gif',
          status: 'published',
        })
      );
    });

    it('denies an anonymous TV from setting administrative banners', async () => {
      const tvContext = testEnv.authenticatedContext('tv_anonymous_uid');
      const db = tvContext.firestore();

      await assertFails(
        setDoc(doc(db, 'banners', 'fake_banner'), {
          title: 'Fake Banner',
          imageUrl: 'https://example.com/ban.jpg',
          active: true,
          priority: 100,
        })
      );
    });
  });

  // 2. REGULAR USER ROLE TESTS
  describe('Regular User Permissions', () => {
    it('allows a regular user to read and update safe profile fields', async () => {
      const userContext = testEnv.authenticatedContext('regular_user_uid', { email: 'user@example.com' });
      const db = userContext.firestore();

      await assertSucceeds(
        setDoc(doc(db, 'userProfiles', 'regular_user_uid'), {
          uid: 'regular_user_uid',
          email: 'user@example.com',
          displayName: 'Regular Athlete',
          preferredUnits: 'metric',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    it('DENIES a regular user from self-promoting by writing their role in userProfiles', async () => {
      const userContext = testEnv.authenticatedContext('regular_user_uid', { email: 'user@example.com' });
      const db = userContext.firestore();

      await assertFails(
        setDoc(doc(db, 'userProfiles', 'regular_user_uid'), {
          uid: 'regular_user_uid',
          email: 'user@example.com',
          displayName: 'Regular Athlete',
          role: 'admin', // FORBIDDEN: Self-promotion attempt
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    it('DENIES a regular user from writing to userRoles/{uid}', async () => {
      const userContext = testEnv.authenticatedContext('regular_user_uid');
      const db = userContext.firestore();

      await assertFails(
        setDoc(doc(db, 'userRoles', 'regular_user_uid'), {
          uid: 'regular_user_uid',
          role: 'admin',
          grantedAt: new Date().toISOString(),
          grantedBy: 'self',
        })
      );
    });

    it('DENIES a regular user from creating workout routines', async () => {
      const userContext = testEnv.authenticatedContext('regular_user_uid');
      const db = userContext.firestore();

      await assertFails(
        setDoc(doc(db, 'routines', 'routine_unauthorized'), {
          name: 'Unauthorized Workout',
          ownerUid: 'regular_user_uid',
          visibility: 'public',
          status: 'published',
          items: [],
        })
      );
    });
  });

  // 3. PRO USER ROLE TESTS
  describe('Pro User Permissions', () => {
    it('allows a pro user to create and manage their own workout routines', async () => {
      const proContext = testEnv.authenticatedContext('pro_user_uid');
      const db = proContext.firestore();

      await assertSucceeds(
        setDoc(doc(db, 'routines', 'pro_routine_1'), {
          name: 'Pro Hypertrophy Circuit',
          ownerUid: 'pro_user_uid',
          visibility: 'private',
          status: 'published',
          items: [
            {
              id: 'it_1',
              exerciseId: 'curated_squats',
              sets: 4,
              reps: 10,
              restSeconds: 60,
            },
          ],
        })
      );
    });

    it('DENIES a pro user from adding exercises to the global catalogue', async () => {
      const proContext = testEnv.authenticatedContext('pro_user_uid');
      const db = proContext.firestore();

      await assertFails(
        setDoc(doc(db, 'exercises', 'pro_attempt_ex'), {
          name: 'Pro Added Exercise',
          difficulty: 'advanced',
          mediaUrl: 'https://example.com/ex.gif',
          mediaType: 'image/gif',
          status: 'published',
        })
      );
    });

    it('DENIES a pro user from managing TV home banners', async () => {
      const proContext = testEnv.authenticatedContext('pro_user_uid');
      const db = proContext.firestore();

      await assertFails(
        setDoc(doc(db, 'banners', 'pro_banner'), {
          title: 'Pro Banner',
          imageUrl: 'https://example.com/img.jpg',
          active: true,
          priority: 50,
        })
      );
    });
  });

  // 4. ADMIN ROLE TESTS
  describe('Admin Permissions', () => {
    it('allows an admin to publish exercises to the catalogue', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user_uid');
      const db = adminContext.firestore();

      await assertSucceeds(
        setDoc(doc(db, 'exercises', 'admin_exercise_1'), {
          name: 'Barbell Romanian Deadlift',
          difficulty: 'intermediate',
          mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/demo.gif',
          mediaType: 'image/gif',
          status: 'published',
        })
      );
    });

    it('allows an admin to configure TV promotional banners', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user_uid');
      const db = adminContext.firestore();

      await assertSucceeds(
        setDoc(doc(db, 'banners', 'admin_banner_1'), {
          title: 'Spring Challenge Live',
          imageUrl: 'https://images.unsplash.com/photo-banner.jpg',
          active: true,
          priority: 20,
        })
      );
    });

    it('allows an admin to assign user roles', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user_uid');
      const db = adminContext.firestore();

      await assertSucceeds(
        setDoc(doc(db, 'userRoles', 'some_new_athlete'), {
          uid: 'some_new_athlete',
          role: 'pro',
          grantedAt: new Date().toISOString(),
          grantedBy: 'admin_user_uid',
        })
      );
    });
  });
});
