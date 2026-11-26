@echo off
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
  start "" "%ONLINE%"
  echo.
  echo To play from this folder, install Python from https://www.python.org/downloads/
  echo ^(tick "Add python.exe to PATH" during setup^), then run play.bat again.
  echo.
  pause
  exit /b 0
)

start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%"
rem tools\dev-server.py serves the game and saves F9 snapshots into the feedback folder.
%PY% tools\dev-server.py %PORT%
