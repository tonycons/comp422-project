@echo off
REM ============================================================================
REM  AI-GENERATED FILE - written by Claude (Anthropic AI), 2026-10-29,
REM  at the request of George Rule. See AI_CONTRIBUTIONS.md.
REM ============================================================================
REM  The Greedy Raccoon - one-click launcher for Windows.
REM    Double-click run.bat         -> menu
REM    run.bat demo --n 12          -> any main.py command
REM  First run creates a private Python environment (.venv) and installs
REM  numpy + matplotlib into it. Needs Python 3.9+ from python.org.
REM ============================================================================
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" goto install

echo First run: creating a Python environment in .venv ...
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m venv .venv
) else (
    python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
    echo.
    echo Could not create the environment. Install Python 3.9+ from https://www.python.org
    echo and tick "Add python.exe to PATH" during setup, then run this file again.
    pause
    exit /b 1
)

:install
".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo.
    echo Installing numpy/matplotlib failed - check your internet connection.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" main.py %*
set EXITCODE=%errorlevel%
if "%~1"=="" pause
exit /b %EXITCODE%
