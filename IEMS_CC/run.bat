@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   IEMS - Intelligent Energy Management Simulator
echo   Automated Environment Setup & Server Launcher
echo ============================================================
echo.

cd /d "%~dp0"

:: 1. Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [*] Creating virtual environment 'venv'...
    python -m venv venv
    if errorlevel 1 (
        echo [!] Failed to create venv. Please ensure Python 3.10+ is installed and on PATH.
        pause
        exit /b 1
    )
    echo [*] Virtual environment created successfully.
)

:: 2. Activate virtual environment
echo [*] Activating virtual environment...
call venv\Scripts\activate.bat

:: 3. Check / Install dependencies
echo [*] Checking dependencies...
python -c "import fastapi, uvicorn, pymoo, pyarrow, pvlib, torch" >nul 2>&1
if errorlevel 1 (
    echo [*] Installing / updating required packages from requirements.txt...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [!] Failed to install dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
) else (
    echo [*] Core dependencies already satisfied.
)

:: 4. Launch FastAPI server and open browser
echo.
echo ============================================================
echo   Starting IEMS Server on http://localhost:8000
echo   - Main Platform:  http://localhost:8000/
echo   - Pipeline Demo:  http://localhost:8000/pipeline
echo   - GA Explainer:   http://localhost:8000/ga-explainer
echo   - Contractor UI:  http://localhost:8000/contractor
echo   - Swagger Docs:   http://localhost:8000/docs
echo ============================================================
echo.

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 >nul && start http://localhost:8000/"

:: Start Uvicorn
uvicorn app:app --reload --port 8000
pause
