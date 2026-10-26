#!/usr/bin/env node

/**
 * Migration & Data Seeding Script for Workout Companion Web Manager
 * Moves all workout routines, curated exercises, banners, and admin roles
 * into a new or different Firebase project from your command line.
 *
 * Usage:
 *   node scripts/seed-new-project.mjs
 * or pass arguments:
 *   node scripts/seed-new-project.mjs --projectId=my-project --apiKey=AIzaSy... --adminUid=optional_uid
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 1. Curated Exercise Data Set
const CURATED_EXERCISES = [
  {
    name: 'Bodyweight Squat',
    slug: 'bodyweight-squat',
    description: 'Fundamental lower-body compound movement developing quadriceps, hamstrings, and gluteal endurance.',
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core', 'Calves'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    instructions: [
      'Stand upright with feet shoulder-width apart and toes pointing slightly outward.',
      'Brace your core, hinge at your hips, and bend your knees while keeping your chest tall.',
      'Descend until your thighs are parallel with the floor, keeping your weight balanced mid-foot.',
      'Drive through your heels to return smoothly to the starting standing position.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Squats.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 3,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Squats.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    attributionText: 'Wikimedia Commons / Maksim (CC BY-SA 3.0)',
    status: 'published'
  },
  {
    name: 'Push-Up',
    slug: 'push-up',
    description: 'Classic horizontal pressing movement targeting the pectoralis major, anterior deltoids, and triceps.',
    primaryMuscles: ['Chest', 'Triceps'],
    secondaryMuscles: ['Anterior Deltoids', 'Core', 'Serratus Anterior'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    instructions: [
      'Position yourself in a high plank with hands slightly wider than shoulder-width.',
      'Engage glutes and core to keep your body in a straight line from neck to ankles.',
      'Inhale and lower your chest toward the floor until your elbows form approximately a 45-degree angle.',
      'Exhale and push firmly through the palms to return to the locked-out top position.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Liegestuetz_1.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 2.5,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Liegestuetz_1.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    attributionText: 'Wikimedia Commons / Liegestütz (CC BY-SA 3.0)',
    status: 'published'
  },
  {
    name: 'Forearm Plank',
    slug: 'forearm-plank',
    description: 'Isometric core stability hold reinforcing abdominal bracing, scapular endurance, and spinal alignment.',
    primaryMuscles: ['Core', 'Transverse Abdominis'],
    secondaryMuscles: ['Shoulders', 'Glutes', 'Quadriceps'],
    equipment: 'Mat (optional)',
    difficulty: 'beginner',
    instructions: [
      'Lie face down and place forearms flat on the floor with elbows directly under shoulders.',
      'Tuck toes and lift hips so your body forms a rigid straight line.',
      'Squeeze your abdominal wall, glutes, and quadriceps without allowing hips to sag or pike.',
      'Breathe steadily through the nose while holding position for the target duration.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Plank_exercise.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 30,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plank_exercise.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    attributionText: 'Wikimedia Commons / Plank Fitness Demo (CC BY-SA 4.0)',
    status: 'published'
  },
  {
    name: 'Alternating Walking Lunge',
    slug: 'alternating-walking-lunge',
    description: 'Unilateral functional lower body movement improving hip stability, quadriceps, and balance.',
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Calves', 'Core Stabilizers'],
    equipment: 'Bodyweight',
    difficulty: 'intermediate',
    instructions: [
      'Stand upright with feet hip-width apart and hands positioned on hips or clasped at chest.',
      'Step forward with your lead leg, lowering hips until both knees bend at approximately 90 degrees.',
      'Keep your front knee stacked over the ankle and torso upright.',
      'Press through the front heel to step directly into the next lunge on the opposing leg.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Lunges.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 4,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lunges.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    attributionText: 'Wikimedia Commons / Maksim Lunge Demonstration (CC BY-SA 3.0)',
    status: 'published'
  },
  {
    name: 'Jumping Jacks',
    slug: 'jumping-jacks',
    description: 'High-cadence plyometric conditioning exercise to elevate heart rate and stimulate full-body circulation.',
    primaryMuscles: ['Cardiovascular', 'Calves'],
    secondaryMuscles: ['Deltoids', 'Adductors', 'Abductors'],
    equipment: 'None',
    difficulty: 'beginner',
    instructions: [
      'Begin standing tall with feet together and arms resting comfortably at your sides.',
      'Slightly bend knees and jump feet outward while sweeping arms out and overhead in an arc.',
      'Without pausing, immediately reverse the motion and jump back to the starting stance.',
      'Maintain a light, rhythmic bounce on the balls of your feet.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Jumping_jack.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 2,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jumping_jack.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    attributionText: 'Wikimedia Commons / Jumping Jack Motion (CC BY-SA 3.0)',
    status: 'published'
  },
  {
    name: 'Glute Bridge',
    slug: 'glute-bridge',
    description: 'Supine hip extension exercise isolating the gluteus maximus and promoting lumbar stability.',
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings', 'Erector Spinae', 'Abdominals'],
    equipment: 'Mat',
    difficulty: 'beginner',
    instructions: [
      'Lie face up with knees bent and feet flat on the floor, hip-width apart.',
      'Keep arms extended flat on the floor alongside your hips.',
      'Drive through your heels to elevate hips until thighs, hips, and shoulders form a straight line.',
      'Squeeze glutes firmly at the summit for a 1-second pause before descending with control.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Glute_Bridge.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 3,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Glute_Bridge.gif',
    licenceName: 'Public Domain / CC0',
    attributionText: 'Open Fitness Resource (Public Domain / CC0)',
    status: 'published'
  },
  {
    name: 'Mountain Climbers',
    slug: 'mountain-climbers',
    description: 'Dynamic plank-based conditioning exercise building core endurance and hip flexor speed.',
    primaryMuscles: ['Core', 'Hip Flexors'],
    secondaryMuscles: ['Shoulders', 'Chest', 'Quadriceps'],
    equipment: 'Bodyweight',
    difficulty: 'intermediate',
    instructions: [
      'Start in a tall push-up plank position with hands directly under shoulders.',
      'Drive your right knee up toward your chest without letting your hips elevate.',
      'Quickly switch legs, extending the right leg back while simultaneously drawing the left knee forward.',
      'Continue alternating legs at a smooth, continuous pace like running in place.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Mountain_climbers.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 2.5,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_climbers.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    attributionText: 'Wikimedia Commons / Climbers Exercise Animation (CC BY-SA 4.0)',
    status: 'published'
  },
  {
    name: 'Bench / Chair Dips',
    slug: 'bench-chair-dips',
    description: 'Triceps and upper body pressing exercise utilizing an elevated bench, sturdy chair, or step.',
    primaryMuscles: ['Triceps'],
    secondaryMuscles: ['Anterior Deltoids', 'Pectorals'],
    equipment: 'Bench or Chair',
    difficulty: 'beginner',
    instructions: [
      'Sit on the edge of a bench with palms gripping the edge next to your hips.',
      'Step feet forward so hips hover just off the front edge of the bench.',
      'Lower your torso by bending elbows until upper arms are roughly parallel to the floor.',
      'Press through the palms to extend elbows back to the starting position.'
    ],
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Bench_dips.gif',
    mediaType: 'image/gif',
    posterUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
    durationSeconds: 3,
    loop: true,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bench_dips.gif',
    licenceName: 'Creative Commons Attribution-ShareAlike 3.0 Unported',
    attributionText: 'Wikimedia Commons / Bench Dips Movement (CC BY-SA 3.0)',
    status: 'published'
  }
];

import * as os from 'os';

function getFirebaseCliToken() {
  try {
    const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data.tokens && data.tokens.access_token) {
        return data.tokens.access_token;
      }
    }
  } catch (e) {}
  return null;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function writeDocViaRest(projectId, databaseId, col, docId, data, token) {
  const dbName = databaseId && databaseId !== '(default)' ? databaseId : '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbName}/documents/${col}/${docId}`;
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST write failed (status ${res.status}): ${errText}`);
  }
}

// Helper to ask console questions
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  console.log('\n======================================================');
  console.log('  Workout Companion - Data Migration & Project Seeder');
  console.log('======================================================\n');

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let config = {};

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`[Config] Found existing config with Project ID: "${config.projectId}"`);
    } catch (e) {
      console.warn('[Config] Could not parse existing firebase-applet-config.json');
    }
  }

  // Allow command line flags
  const args = process.argv.slice(2);
  const argMap = {};
  args.forEach(arg => {
    const [k, v] = arg.split('=');
    if (k && v) argMap[k.replace(/^--/, '')] = v;
  });

  const targetProjectId = argMap.projectId || (await askQuestion(`Target Firebase Project ID [${config.projectId || 'Enter ID'}]: `)) || config.projectId;
  const targetApiKey = argMap.apiKey || config.apiKey || (await askQuestion(`Firebase Web API Key (from Project Settings): `));
  const targetDatabaseId = argMap.databaseId || config.firestoreDatabaseId || '(default)';

  if (!targetProjectId || !targetApiKey) {
    console.error('\n[Error] Project ID and API Key are required to connect to Firebase.');
    process.exit(1);
  }

  // Update local config file for the project
  const updatedConfig = {
    projectId: targetProjectId,
    appId: config.appId || `1:274264390397:web:${targetProjectId}`,
    apiKey: targetApiKey,
    authDomain: `${targetProjectId}.firebaseapp.com`,
    firestoreDatabaseId: targetDatabaseId,
    storageBucket: `${targetProjectId}.firebasestorage.app`,
    messagingSenderId: config.messagingSenderId || '274264390397',
    measurementId: config.measurementId || '',
    oAuthClientId: config.oAuthClientId || '',
    recaptchaSiteKey: '',
  };

  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
  console.log(`\n[Config] Updated firebase-applet-config.json for target project "${targetProjectId}".`);

  // Try CLI admin token first to avoid firestore.rules permission errors
  const cliToken = getFirebaseCliToken();
  let useRest = false;
  if (cliToken) {
    console.log('[Auth] Using authenticated Firebase CLI admin credentials for direct Firestore seeding.');
    useRest = true;
  } else {
    console.log('[Auth] Firebase CLI token not found. Falling back to Client SDK (requires open rules or sign-in).');
  }

  let db = null;
  if (!useRest) {
    const app = initializeApp(updatedConfig, 'migration_instance');
    db = targetDatabaseId && targetDatabaseId !== '(default)'
      ? getFirestore(app, targetDatabaseId)
      : getFirestore(app);
  }

  async function saveDoc(col, id, payload) {
    if (useRest) {
      await writeDocViaRest(targetProjectId, targetDatabaseId, col, id, payload, cliToken);
    } else {
      await setDoc(doc(db, col, id), payload, { merge: true });
    }
  }

  const now = new Date().toISOString();

  // 1. Seed Curated Exercises
  console.log(`\n[1/4] Migrating & Seeding ${CURATED_EXERCISES.length} Curated Exercises...`);
  for (const ex of CURATED_EXERCISES) {
    const id = `curated_${ex.slug}`;
    const payload = {
      ...ex,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system_migration',
    };
    await saveDoc('exercises', id, payload);
    console.log(`  + Seeded exercise: ${ex.name} (exercises/${id})`);
  }

  // 2. Seed Starter Workout Routine
  console.log(`\n[2/4] Migrating Starter Routine...`);
  const routineId = 'routine_starter_daily_primer';
  const routinePayload = {
    id: routineId,
    ownerUid: 'system_curated',
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
        exerciseId: 'curated_bodyweight-squat',
        exerciseName: 'Bodyweight Squat',
        mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Squats.gif',
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
        exerciseId: 'curated_push-up',
        exerciseName: 'Push-Up',
        mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Liegestuetz_1.gif',
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
        exerciseId: 'curated_forearm-plank',
        exerciseName: 'Forearm Plank',
        mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Plank_exercise.gif',
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
  await saveDoc('routines', routineId, routinePayload);
  console.log(`  + Seeded routine: "${routinePayload.name}" (routines/${routineId})`);

  // 3. Seed Promotional TV Banner
  console.log(`\n[3/4] Migrating TV Home Promotional Banner...`);
  const bannerId = 'ban_starter_featured';
  const future = new Date();
  future.setDate(future.getDate() + 90);
  const bannerPayload = {
    id: bannerId,
    title: 'Spring Conditioning Challenge: New Full-Body Workouts Available',
    imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    linkUrl: '/routines',
    active: true,
    startAt: now,
    endAt: future.toISOString(),
    priority: 10,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system_migration',
  };
  await saveDoc('banners', bannerId, bannerPayload);
  console.log(`  + Seeded banner: "${bannerPayload.title}" (banners/${bannerId})`);

  // 4. Seed Public App Settings
  await saveDoc('applicationSettings', 'public', {
    appVersion: '1.0.0',
    pairingTimeoutSeconds: 120,
    defaultBannerFallback: bannerPayload.imageUrl,
    updatedAt: now,
  });
  console.log(`  + Seeded settings (applicationSettings/public)`);

  // 5. Optional Admin Role Bootstrap
  console.log(`\n[4/4] Administrator Role Bootstrapping`);
  const adminUid = argMap.adminUid || (await askQuestion(`Enter your Firebase User UID to grant Admin role (or press Enter to skip): `));
  if (adminUid) {
    await saveDoc('userRoles', adminUid, {
      uid: adminUid,
      role: 'admin',
      grantedAt: now,
      grantedBy: 'cli_migration_script',
    });
    console.log(`  + Granted ADMIN role to UID "${adminUid}" in userRoles/${adminUid}`);
  } else {
    console.log(`  - Skipped admin role grant. You can seed userRoles/{uid} later or use jcob1289@gmail.com which is built into firestore.rules.`);
  }

  console.log('\n======================================================');
  console.log('  Migration & Seeding Completed Successfully! 🎉');
  console.log(`  Target Project: ${targetProjectId}`);
  console.log('======================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n[Fatal Error during migration]:', err.message);
  process.exit(1);
});
