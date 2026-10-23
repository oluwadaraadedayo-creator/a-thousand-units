@echo off
setlocal
cd /d "%~dp0"
title A Thousand Units MVP

echo ==========================================
echo   A THOUSAND UNITS - LOCAL PREVIEW
echo ==========================================
echo.

if not exist package.json (
  echo ERROR: package.json was not found.
  echo Please keep this file inside the extracted project folder.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing project dependencies. This requires an internet connection.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)

echo.
echo Downloading the 10 album covers from Apple's public music catalog...
call npm run download:album-covers
if errorlevel 1 (
  echo.
  echo ERROR: Not all 10 official album covers were verified and downloaded.
  echo The site will NOT start with missing or placeholder album art.
  echo Check your internet connection and the failed album names above, then run this file again.
  pause
  exit /b 1
)

echo.
echo Downloading remaining demo images...
call npm run download:images
if errorlevel 1 (
  echo WARNING: Some demo images could not be downloaded. The app will still start.
)

echo.
echo Starting the website. Keep this window open.
echo Open the local URL shown below, usually http://localhost:5173/
echo Press Ctrl+C in this window to stop the server.
echo.
call npm run dev
pause
