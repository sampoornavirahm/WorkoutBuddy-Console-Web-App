@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo   Workout Companion Web Manager - Move Data to New Firebase Project
echo ====================================================================
echo.
echo This script will:
echo   1. Link your local project to your new Firebase Project
echo   2. Deploy firestore.rules and firestore.indexes.json
echo   3. Seed all exercises, routines, banners, and admin role into Firestore
echo   4. Build and deploy to Firebase Hosting
echo.
set /p PROJECT_ID="Enter your Target Firebase Project ID: "
if "%PROJECT_ID%"=="" (
    echo [Error] Project ID cannot be empty.
    pause
    exit /b 1
)

echo.
echo [1/4] Pointing Firebase CLI to project: %PROJECT_ID%...
call npx firebase-tools use %PROJECT_ID%
if errorlevel 1 (
    echo.
    echo [Notice] If not logged in, run: npx firebase-tools login
    call npx firebase-tools use --add %PROJECT_ID%
)

echo.
echo [2/4] Deploying Firestore Security Rules and Indexes...
call npx firebase-tools deploy --only firestore:rules,firestore:indexes --project %PROJECT_ID%

echo.
echo [3/4] Migrating and Seeding Firestore Collections...
node scripts/seed-new-project.mjs --projectId=%PROJECT_ID%

echo.
echo [4/4] Building production web app and deploying to Firebase Hosting...
call npm run build
call npx firebase-tools deploy --only hosting --project %PROJECT_ID%

echo.
echo ====================================================================
echo   All Data and Hosting Successfully Migrated!
echo   Your new app is live on Firebase!
echo ====================================================================
pause
