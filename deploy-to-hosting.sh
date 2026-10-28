#!/bin/bash
set -e

echo "========================================================"
echo "Deploying Workout Companion to workoutbuddyweb.web.app"
echo "========================================================"
echo ""

echo "[1/3] Verifying Firebase CLI Authentication..."
npx firebase login

echo ""
echo "[2/3] Building production assets..."
npm run build

echo ""
echo "[3/3] Deploying to Firebase Hosting (workoutbuddyweb)..."
npx firebase deploy --only hosting --project workoutbuddyweb

echo ""
echo "========================================================"
echo "Successfully deployed to:"
echo "https://workoutbuddyweb.web.app"
echo "========================================================"
