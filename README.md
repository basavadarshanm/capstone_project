# IEMS — Intelligent Energy Management Simulator

A decision-support and sizing platform for residential solar + battery energy storage systems, grounded in real Indian smart-meter data (CEEW), NASA POWER satellite solar irradiance physics, and local DISCOM net-metering regulations.

---

## ⚡ Quick Start

### 1. Windows (1-Click Run)
Navigate to `IEMS_CC` and run `run.bat`:
```cmd
cd IEMS_CC
run.bat
```
*(Or in PowerShell: `cd IEMS_CC; .\run.bat`)*

### 2. Linux / macOS
```bash
cd IEMS_CC
chmod +x run.sh
./run.sh
```

---

## 🛠 Manual Setup (Any OS)

### 1. Create Virtual Environment
```bash
cd IEMS_CC
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Windows (Command Prompt):
venv\Scripts\activate.bat

# Linux / macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Launch Backend & Web Server
```bash
uvicorn app:app --reload --port 8000
```

### 4. Open in Browser
- **Solar Intelligence Platform**: [http://localhost:8000/](http://localhost:8000/)
- **Pipeline Demo**: [http://localhost:8000/pipeline](http://localhost:8000/pipeline)
- **Genetic Algorithm (NSGA-II) Explainer**: [http://localhost:8000/ga-explainer](http://localhost:8000/ga-explainer)
- **Contractor Engineering UI**: [http://localhost:8000/contractor](http://localhost:8000/contractor)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

*Alternatively, open [IEMS_CC/changes/index.html](IEMS_CC/changes/index.html) directly in any browser for standalone client-only mode.*

---

## 📁 Repository Structure
```
IEMS_CC/
├── app.py                     # FastAPI backend (JSON API + static web server)
├── requirements.txt           # Unified Python dependencies
├── run.bat                    # 1-click launcher for Windows
├── run.sh                     # 1-click launcher for Linux/macOS
├── How_TO_RUN.md              # Detailed setup, troubleshooting & endpoints guide
├── changes/                   # Solar Intelligence residential web application
│   ├── index.html             # Multi-feature interactive solar & battery portal
│   ├── app.js                 # Frontend application controller & physics logic
│   ├── data.js                # DISCOM tariffs, solar data & 19 MNRE installers
│   └── styles.css             # High-contrast accessible design system
├── src/                       # Core simulation & optimization modules
│   ├── battery/               # Battery physics model (efficiency, degradation)
│   ├── controllers/           # Rule-based, MPC, DQN battery dispatch controllers
│   ├── data/                  # Smart-meter data loader & load profile generator
│   ├── environment/           # Gymnasium simulation environment
│   ├── grid/                  # Slab-rate grid billing & outage modeling
│   ├── pipeline/              # Multi-stage orchestrator
│   ├── report/                # PM Surya Ghar subsidy & 25-yr financial models
│   ├── sizing/                # Commercial grid search & NSGA-II Pareto optimization
│   └── solar/                 # pvlib PVWatts physics & NASA POWER irradiance
├── data/                      # Processed smart-meter and solar data caches
└── models/                    # Pre-trained DQN policy & load profile cluster models
```
"# capstone_project" 
