# 🚀 How to Run the Complete IEMS Platform

This guide provides step-by-step instructions to run the entire **IEMS (Intelligent Energy Management Simulator)** platform from scratch after cloning the repository.

---

## ⚡ Quick Start (1-Click Run)

### On Windows
Double-click `run.bat` or run in PowerShell / Command Prompt:
```powershell
cd IEMS_CC
.\run.bat
```
*This automatically sets up the Python virtual environment, installs all required packages, starts the FastAPI server, and opens your browser.*

### On macOS / Linux
Open terminal and run:
```bash
cd IEMS_CC
chmod +x run.sh
./run.sh
```

---

## 🛠 Manual Step-by-Step Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/MYTH-09/IEMS_CC.git
cd IEMS_CC
```

---

### Step 2: Create and Activate Virtual Environment

#### On Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(If PowerShell gives an execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, or activate via Command Prompt: `venv\Scripts\activate.bat`)*

#### On macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

---

### Step 3: Install Required Dependencies
All required dependencies (including FastAPI, Uvicorn, PyMoo, PyArrow, CVXPY, PVLib, Stable-Baselines3, PyTorch) are listed in `requirements.txt`:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 4: Start the Backend & Web Application Server
Run the unified FastAPI server:
```bash
uvicorn app:app --reload --port 8000
```
*(Leave this terminal window running)*

---

### Step 5: Access the Web Interfaces in Your Browser

Once the server is running on `http://localhost:8000`, open any of the following URLs in your web browser:

| Interface | URL | Description |
|---|---|---|
| **Residential Solar Intelligence Platform** *(Default)* | **[http://localhost:8000/](http://localhost:8000/)** or **[http://localhost:8000/changes/](http://localhost:8000/changes/)** | Interactive solar & battery sizing wizard, budget cap filter, PM Surya Ghar subsidy calculator, 15-city DISCOM net-metering tariffs, 25-yr financial comparison, and MNRE empanelled contractor site survey requests. |
| **Pipeline Demo** | **[http://localhost:8000/pipeline](http://localhost:8000/pipeline)** | Interactive step-by-step multi-stage physics & optimization pipeline visualization. |
| **Contractor Sizing UI** | **[http://localhost:8000/contractor](http://localhost:8000/contractor)** | B2B contractor engineering sizing and validation dashboard. |
| **GA Explainer** | **[http://localhost:8000/ga-explainer](http://localhost:8000/ga-explainer)** | Live interactive genetic algorithm (NSGA-II) generation recorder, chromosome crossover, mutation & Pareto front math explainer. |
| **Backend API Health Check** | **[http://localhost:8000/api/health](http://localhost:8000/api/health)** | JSON health probe returning `{"status": "ok"}`. |
| **Interactive API Documentation** | **[http://localhost:8000/docs](http://localhost:8000/docs)** | Swagger UI documentation with live testing for all REST endpoints. |

---

## 🌐 Running Standalone (No Server / Client-Only Mode)
The Solar Intelligence frontend (`changes/index.html`) can also run **standalone without any Python backend**:
1. Navigate to the `changes/` folder.
2. Double-click or open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Brave, Safari).
3. The platform operates in **Standalone Physics Mode** with full offline solar physics calculations, budget cap filtering, DISCOM tariffs, and lead management.

---

## 🔍 Troubleshooting & Common Fixes

| Issue | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` or `pymoo` or `pyarrow` | Run `pip install -r requirements.txt` inside your activated virtual environment. |
| `Cannot be loaded because running scripts is disabled on this system` (PowerShell) | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in your PowerShell terminal, then re-run `.\venv\Scripts\Activate.ps1`. |
| Port 8000 is already in use | Run `uvicorn app:app --reload --port 8080` instead. All web interfaces will dynamically adapt to the active port. |
| Parquet file read error | Ensure `pyarrow` is installed (`pip install pyarrow>=12.0.0`). Pre-processed parquet files are located in `data/processed/`, `data/solar/`, and `models/`. |

---

## 🧪 Automated Testing

The project has a fast, deterministic pytest suite in `tests/`. It covers:

- Battery charge/discharge limits, SOC bounds, and efficiency
- Tariff slabs, monthly billing, and outage behavior
- Gymnasium environment reset/step contracts and energy-flow balance
- Rule-based controller decisions
- CAPEX, subsidy, NPV, IRR, and payback calculations
- FastAPI health, lead submission, and request validation contracts

Run the normal test suite from the project root:

```bash
pytest -q
```

Run it with source coverage:

```bash
pytest --cov=src --cov-report=term-missing -q
```

The pytest suite intentionally does not train a DQN, fetch NASA data, solve
thousands of MPC problems, or run a full NSGA-II search. Those are acceptance
and demonstration activities that are run explicitly:

```bash
python scripts/03_battery_grid_check.py
python scripts/04_environment_check.py
python scripts/05_rule_based_check.py
python scripts/06_sizing_pipeline.py
python scripts/07_train_dqn.py              # quick smoke test
python scripts/08_mpc_check.py
python scripts/09_compare_controllers.py
python scripts/10_nsga2_sizing.py           # quick smoke test by default
python scripts/11_validate_sizing.py
python scripts/12_live_deployment_demo.py
```

The `tests/` suite is suitable for every code change and continuous
integration. The longer scripts should be run when changing the associated
model, controller, optimization, or deployment behavior.
