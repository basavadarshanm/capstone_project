#!/usr/bin/env bash
set -e

echo "============================================================"
echo "  IEMS - Intelligent Energy Management Simulator"
echo "  Automated Environment Setup & Server Launcher"
echo "============================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Check if virtual environment exists
if [ ! -f "venv/bin/activate" ]; then
    echo "[*] Creating virtual environment 'venv'..."
    python3 -m venv venv
    echo "[*] Virtual environment created successfully."
fi

# 2. Activate virtual environment
echo "[*] Activating virtual environment..."
source venv/bin/activate

# 3. Check / Install dependencies
echo "[*] Checking dependencies..."
if ! python3 -c "import fastapi, uvicorn, pymoo, pyarrow, pvlib, torch" >/dev/null 2>&1; then
    echo "[*] Installing / updating required packages from requirements.txt..."
    python3 -m pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "[*] Core dependencies already satisfied."
fi

# 4. Launch FastAPI server and open browser
echo ""
echo "============================================================"
echo "  Starting IEMS Server on http://localhost:8000"
echo "  - Main Platform:  http://localhost:8000/"
echo "  - Pipeline Demo:  http://localhost:8000/pipeline"
echo "  - GA Explainer:   http://localhost:8000/ga-explainer"
echo "  - Contractor UI:  http://localhost:8000/contractor"
echo "  - Swagger Docs:   http://localhost:8000/docs"
echo "============================================================"
echo ""

# Try opening default browser in background
if command -v xdg-open >/dev/null 2>&1; then
    (sleep 2 && xdg-open "http://localhost:8000/") &
elif command -v open >/dev/null 2>&1; then
    (sleep 2 && open "http://localhost:8000/") &
fi

# Start Uvicorn
uvicorn app:app --reload --port 8000
