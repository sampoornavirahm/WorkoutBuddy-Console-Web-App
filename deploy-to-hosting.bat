@echo off
echo ========================================================
echo Deploying Workout Companion to workoutbuddyweb.web.app
echo ========================================================
echo.

echo [1/3] Verifying Firebase CLI Authentication...
call npx firebase login
if %errorlevel% neq 0 (
    echo.
    echo Please log in to Firebase using your Google account in the browser.
)

echo.
echo [2/3] Building production assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Deploying to Firebase Hosting (workoutbuddyweb)...
call npx firebase deploy --only hosting --project workoutbuddyweb
if %errorlevel% neq 0 (
    echo.
    echo [TIP] If Hosting is not yet enabled on your project, enable it here:
    echo https://console.firebase.google.com/project/workoutbuddyweb/hosting
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo Successfully deployed to:
echo https://workoutbuddyweb.web.app
echo ========================================================
pause
