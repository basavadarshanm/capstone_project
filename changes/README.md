# IEMS Solar Intelligence Platform

A modern, intuitive, decision-support interface for residential solar and battery storage in India. Designed for homeowners with zero technical solar knowledge, as well as solar contractors and installers.

---

## 🌟 Key Features Implemented

### 1. 📍 Location-Based Solar Generation
* **Why it matters**: Estimates output for the user's actual area rather than a generic national average.
* **Implementation**:
  * Integrates real NASA POWER satellite irradiance and CEEW smart-meter measured data for 15+ Indian cities (Mathura, Bareilly, Delhi NCR, Bengaluru, Mumbai, Jaipur, Lucknow, etc.).
  * Calculates Peak Sun Hours (PSH), annual generation yield per kWp (1,460 – 1,690 kWh/kWp/yr).
  * Recommends optimal panel tilt angle (e.g., 27° South for North India, 13° South for Bangalore) and azimuth compass orientation.
  * Captures real measured load-shedding outage patterns (e.g. 4.1 hrs/day in Mathura vs 0.9 hrs/day in Bengaluru).
  * Interactive 12-month generation bar chart displaying summer peaks and monsoon variations.

### 2. 🎯 Budget-Based System Matching
* **Why it matters**: Recommends the most suitable system within the user's budget.
* **Implementation**:
  * Dual-input slider matching: Monthly electricity bill (₹1,000 – ₹25,000) and Total Budget (₹50,000 – ₹8,00,000+).
  * Dynamically computes the highest-capacity solar array and battery storage that fits strictly within the budget after subsidies.
  * Displays terrace roof space requirements (~75 sq. ft per kW).
  * Visual budget utilization progress meter.

### 3. 🏛️ Subsidy Eligibility Checker (PM Surya Ghar)
* **Why it matters**: Shows applicable incentives without promising unapproved benefits.
* **Implementation**:
  * Official Central PM Surya Ghar: Muft Bijli Yojana calculation:
    * 1 kW: ₹30,000
    * 2 kW: ₹60,000
    * 3 kW to 10 kW: ₹78,000 (statutory residential cap)
  * State top-up subsidies (e.g., Uttar Pradesh ₹15,000/kW up to ₹30,000 max; Delhi generation-based incentive).
  * 5-point statutory eligibility checklist (active meter name match, terrace ownership, DCR domestic solar cell compliance, MNRE vendor empanelment, bi-directional net meter).
  * Transparent disclaimers adhering to MNRE compliance.

### 4. ⚡ DISCOM Export Tariff Database
* **Why it matters**: Estimates actual export revenue under local utility rules.
* **Implementation**:
  * Covers 10+ major Indian DISCOMs (DVVNL, PVVNL, MVVNL, BESCOM, MSEDCL, BSES Rajdhani, JVVNL, TSSPDCL, TANGEDCO, Torrent Power).
  * Details retail purchase rates vs surplus export credit rates (e.g., DVVNL ₹2.14/unit, BESCOM ₹3.82/unit, MSEDCL ₹3.15/unit).
  * Explains net-metering vs net-billing and banking settlement periods (annual 31st March settlement vs monthly roll-over).
  * Live surplus revenue calculator: computes how much cash is earned by exporting excess daytime solar power back to the grid.

### 5. ⚖️ Compare 3 Solar Systems Side-by-Side
* **Why it matters**: Lets users compare cost, savings, and payback side-by-side.
* **Implementation**:
  * **Option A: Starter Eco (Pure Grid-Tie)** — Lowest upfront cost, fastest payback (~2.7 years), zero battery maintenance, shuts down during blackouts.
  * **Option B: Smart Hybrid (Solar + 5 kWh LiFePO4 Battery)** — Recommended sweet spot, high savings + 6-8 hours power backup during power cuts.
  * **Option C: Resilience Pro (High Capacity + 10 kWh Battery)** — Maximum energy independence, 14+ hours backup (runs ACs and heavy loads), off-grid capability.
  * Side-by-side comparison matrix covering 10 metrics with a "Select this system" button to propagate into the financial engine.

### 6. 📈 25-Year Financial Projection
* **Why it matters**: Accounts for degradation, maintenance, tariff changes, and replacement costs.
* **Implementation**:
  * Compound annual panel degradation (0.55%/year).
  * Retail electricity tariff inflation (+4.5%/year compounding).
  * Inverter replacement cost modeled and deducted at Year 10.
  * Battery cell replacement modeled and deducted at Year 12 (for hybrid/resilience systems).
  * Annual O&M cleaning and inspection inflating at 3.5%/year.
  * Key financial KPIs: 25-Year NPV (discounted @ 8%), Cumulative Lifetime Net Profit, Breakeven Payback Year, and Levelized Cost of Energy (LCOE ₹2.10/kWh vs Grid ₹6.80+).
  * Interactive Chart.js graph + expandable year-by-year cashflow audit table (Years 1 to 25).

### 7. 👷 Verified Installer Marketplace
* **Why it matters**: Connects users with verified solar installers.
* **Implementation**:
  * Directory of pre-screened solar EPC contractors.
  * Badges: "MNRE Empanelled", "PM Surya Ghar Approved", "ISO Certified", "Tier-1 Panels Only".
  * Customer star ratings (4.8 - 4.9★), completed project counts, turnaround times, and warranty terms (25-year panel, 5-10 year inverter/battery).
  * City-level filter to find local installers nearby.
  * "Request Free Rooftop Site Survey" modal with auto-filled system specs.

### 8. 💳 Financing & Solar Loan EMI Calculator
* **Why it matters**: Shows EMI, down payment, and returns after loan costs.
* **Implementation**:
  * Interactive sliders for Down Payment (0% to 50%), Loan Tenure (1 to 10 years), and Interest Rate (default 7.0% p.a. for PM Surya Ghar concessional loans).
  * Real-time EMI calculation and total interest breakdown.
  * **Net Positive Cashflow Indicator**: Visually demonstrates how Monthly Solar Savings (₹3,150) exceed the Loan EMI (₹2,180), putting +₹970 net cash in the homeowner's pocket every single month from Day 1.
  * Bank comparison cards for SBI Surya Ghar Loan, Canara Bank, PNB, and Tata Capital.

### 9. 💼 Solar Project Leads (Installer B2B Portal)
* **Why it matters**: Lets installers pay for and browse qualified customer enquiries.
* **Implementation**:
  * Dual-portal architecture: Seamless toggle in header between **Homeowner View** and **Installer Leads Hub**.
  * Live feed of high-intent homeowner leads with automated Lead Scores (e.g. 96/100).
  * Detailed lead cards with monthly power bill, roof size, desired kW, sanctioned load, and verification badges (Phone OTP Verified, Bill Verified, Owner Occupied).
  * "Claim Lead (Unlock Contact Details)" modal with refund guarantee policy.
  * Interactive simulation: submitting any site survey request in the homeowner calculator automatically adds a live qualified lead to the installer portal.

---

## 🚀 How to Run

### Method 1: Double-Click Standalone (No Server Needed)
Simply open `index.html` directly in any web browser:
```
d:\PESU\Sem 7\capstone\changes\index.html
```
or
```
d:\PESU\Sem 7\capstone\IEMS_CC\changes\index.html
```
The entire application runs 100% locally with all formulas, physics data, and interactive charts built-in.

### Method 2: Via FastAPI Backend
If you are running the project's Python backend:
```bash
cd IEMS_CC
uvicorn app:app --reload --port 8000
```
Then visit in your browser:
* **http://localhost:8000/** (Serves this new interface by default)
* **http://localhost:8000/changes/** (Static mount)

---

## 🎨 Design Philosophy
* **Extreme Ease of Use**: Zero prior technical solar knowledge required. Every technical term includes layman explanations and real-world analogies.
* **Modern Aesthetic**: Dark/Light mode support, curated color palette (Solar Amber `#F59E0B`, Clean Teal `#0D9488`, Midnight Navy `#0F172A`), glassmorphism cards, micro-animations, and clean typography via Google Fonts (`Space Grotesk`, `Inter`, `IBM Plex Mono`).
* **Print & PDF Ready**: Click the 📄 icon in the top header or press `Ctrl + P` to generate a formatted solar proposal report.
