#!/usr/bin/env bash
set -e

echo "===================================================================="
echo "  Workout Companion Web Manager - Move Data to New Firebase Project"
echo "===================================================================="
echo ""

read -p "Enter your Target Firebase Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
  echo "[Error] Project ID cannot be empty."
  exit 1
fi

echo ""
echo "[1/4] Pointing Firebase CLI to project: $PROJECT_ID..."
npx firebase-tools use "$PROJECT_ID" || npx firebase-tools use --add "$PROJECT_ID"

echo ""
echo "[2/4] Deploying Firestore Security Rules and Indexes..."
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project "$PROJECT_ID"

echo ""
echo "[3/4] Migrating and Seeding Firestore Collections..."
node scripts/seed-new-project.mjs --projectId="$PROJECT_ID"

echo ""
echo "[4/4] Building production web app and deploying to Firebase Hosting..."
npm run build
npx firebase-tools deploy --only hosting --project "$PROJECT_ID"

echo ""
echo "===================================================================="
echo "  All Data and Hosting Successfully Migrated!"
echo "===================================================================="
