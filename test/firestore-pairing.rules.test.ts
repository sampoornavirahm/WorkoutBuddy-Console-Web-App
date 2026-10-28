import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

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
    const pairingCode = 'K8N29X4F';
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
    const codeIndex = await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext('phone_user').firestore(), 'pairingSessionCodes', pairingCode))
    );
    assert.equal(codeIndex.data()?.sessionId, sessionId);
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext('phone_user').firestore(), 'pairingSessionCodes', '12345678'))
    );
  });

  it('does not allow an unauthenticated client to create a pairing session', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 120000);
    await assertFails(
      writeBatch(db)
        .set(doc(db, 'pairingSessions', 'tv_0123456789abcdef0123456789abcdef'), {
          sessionId: 'tv_0123456789abcdef0123456789abcdef',
          pairingCode: 'K8N29X4F',
          deviceUid: 'tv_anonymous_uid',
          deviceName: 'Workout Buddy webOS TV',
          status: 'pending',
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          expiresAtMillis: expiresAt.getTime(),
          expiresAtTimestamp: Timestamp.fromDate(expiresAt)
        })
        .commit()
    );
  });

  it('rejects a pairing-code mapping that does not match its session', async () => {
    const deviceUid = 'tv_anonymous_uid';
    const pairingCode = 'K8N29X4F';
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
    batch.set(doc(db, 'pairingSessionCodes', 'K8N29X5G'), {
      sessionId,
      deviceUid,
      expiresAt: expiresAt.toISOString(),
      expiresAtMillis: expiresAt.getTime(),
      expiresAtTimestamp: Timestamp.fromDate(expiresAt)
    });

    await assertFails(batch.commit());
  });

  it('allows a paired TV to deactivate only its own device record', async () => {
    const ownerUid = 'account_owner';
    const deviceUid = 'tv_anonymous_uid';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ownerUid, 'pairedDevices', deviceUid), {
        active: true,
        deviceName: 'Workout Buddy webOS TV'
      });
    });

    const db = testEnv.authenticatedContext(deviceUid).firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', ownerUid, 'pairedDevices', deviceUid), {
      active: false,
      disconnectedAt: new Date().toISOString()
    }));
  });

  it('rejects TV unlink requests that also change other device fields', async () => {
    const ownerUid = 'account_owner';
    const deviceUid = 'tv_anonymous_uid';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ownerUid, 'pairedDevices', deviceUid), {
        active: true,
        deviceName: 'Workout Buddy webOS TV'
      });
    });

    const db = testEnv.authenticatedContext(deviceUid).firestore();
    await assertFails(updateDoc(doc(db, 'users', ownerUid, 'pairedDevices', deviceUid), {
      active: false,
      disconnectedAt: new Date().toISOString(),
      deviceName: 'Modified by TV'
    }));
  });

  it('does not allow a TV to deactivate another device record', async () => {
    const ownerUid = 'account_owner';
    const deviceUid = 'another_tv';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ownerUid, 'pairedDevices', deviceUid), {
        active: true
      });
    });

    const db = testEnv.authenticatedContext('tv_anonymous_uid').firestore();
    await assertFails(updateDoc(doc(db, 'users', ownerUid, 'pairedDevices', deviceUid), {
      active: false,
      disconnectedAt: new Date().toISOString()
    }));
  });
});
