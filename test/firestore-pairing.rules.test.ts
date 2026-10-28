import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';

const PROJECT_ID = 'demo-workoutbuddyweb';
const [FIRESTORE_HOST, FIRESTORE_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

describe('TV pairing Firestore rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: FIRESTORE_HOST,
        port: Number(FIRESTORE_PORT)
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('allows an authenticated TV to atomically create its session and code', async () => {
    const deviceUid = 'tv_anonymous_uid';
    const pairingCode = '12345678';
    const sessionId = 'tv_0123456789abcdef0123456789abcdef';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 120000);
    const db = testEnv.authenticatedContext(deviceUid).firestore();
    const batch = writeBatch(db);

    batch.set(doc(db, 'pairingSessions', sessionId), {
      sessionId,
      pairingCode,
      deviceUid,
      deviceName: 'Workout Buddy webOS TV',
      status: 'pending',
      createdAt: now.toISOString(),
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

    await assertSucceeds(batch.commit());
    const session = await assertSucceeds(getDoc(doc(db, 'pairingSessions', sessionId)));
    assert.equal(session.data()?.deviceUid, deviceUid);
    assert.equal(session.data()?.pairingCode, pairingCode);
  });

  it('does not allow an unauthenticated client to create a pairing session', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      writeBatch(db)
        .set(doc(db, 'pairingSessions', 'tv_0123456789abcdef0123456789abcdef'), {})
        .commit()
    );
  });
});
