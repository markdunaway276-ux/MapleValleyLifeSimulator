@echo off
setlocal
if /i "%~1"=="--open" goto openLocal
title Maple Valley Life Simulator
rem Starts the game: runs a small local web server in this folder and opens it in your browser.
rem F9 snapshots (screenshot + note) are saved into the feedback folder here.
rem Keep this file in the MapleValleyLifeSimulator folder (next to index.html).
rem Close this window to stop the server when you are done playing.

cd /d "%~dp0"
set "PORT=8080"
set "ONLINE=https://markdunaway276-ux.github.io/MapleValleyLifeSimulator/"

if not exist "index.html" (
  echo Could not find index.html next to this file.
  echo Move play.bat into the MapleValleyLifeSimulator folder, then try again.
  echo.
  pause
  exit /b 1
)

set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY python --version >nul 2>&1 && set "PY=python"

if not defined PY (
  echo Python is not installed, so the game cannot run from this folder.
  echo Opening the online version instead:
  echo %ONLINE%
  call :openWindow "%ONLINE%"
  echo.
  echo To play from this folder, install Python from https://www.python.org/downloads/
  echo ^(tick "Add python.exe to PATH" during setup^), then run play.bat again.
  echo.
  pause
  exit /b 0
)

start "" /min "%ComSpec%" /c call "%~f0" --open %PORT%
rem tools\dev-server.py serves the game and saves F9 snapshots into the feedback folder.
%PY% tools\dev-server.py %PORT%
exit /b %errorlevel%

:openLocal
timeout /t 2 /nobreak >nul
call :openWindow "http://localhost:%~2"
exit /b %errorlevel%

:openWindow
for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if exist "%%~B" (
    start "" "%%~B" "--app=%~1"
    exit /b
  )
)
start "" "%~1"
exit /b
