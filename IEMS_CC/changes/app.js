/**
 * IEMS Solar Platform - Core Application Controller
 * High-performance, intuitive, and interactive logic for all 9 key solar features.
 */

// Application State
const AppState = {
    // Current selections
    city: "Bengaluru",
    monthlyBill: 3500,
    budgetCap: 250000,
    roofAreaSqft: 500,
    primaryGoal: "balanced", // "savings", "balanced", "backup"
    subsidyEligible: true,
    discom: "BESCOM",
    activePortal: "homeowner", // "homeowner" | "installer"
    compareFilter: "all", // "all" | "budget"

    // Financing state
    downPaymentPct: 10,
    loanTenureYears: 5,
    loanInterestRatePct: 7.0,

    // Active system selection for comparison & financing
    selectedSystemType: "hybrid", // "starter" | "hybrid" | "resilience"

    // Dynamic calculated systems
    systems: {
        starter: {},
        hybrid: {},
        resilience: {}
    },

    // Leads store (in-memory + localStorage)
    leads: [],

    // Chart instances
    charts: {
        monthlyYield: null,
        financialProjection: null,
        cashflowComparison: null,
        loanVsSavings: null
    },

    calculationTimer: null,
    calculationRunId: 0
};

const CALCULATION_DELAY_MS = 60000;

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initPortalSwitch();
    initThemeToggle();
    initCitySelector();
    initDiscomCitySelector();
    initDiscomSelector();
    initWizardInputs();
    initFinancingSliders();
    initInstallerMarketplace();
    initLeadsPortal();
    initModals();
    initFeatureTabs();

    // Load persisted leads or fallback to sample
    loadLeads();

    // Run initial full calculation & UI render
    recalculateAll();

    // Check backend connection health in background
    checkBackendHealth();
});

// ─────────────────────────────────────────────────────────────────────────────
// Portal Switcher (Homeowner vs Installer B2B View)
// ─────────────────────────────────────────────────────────────────────────────
function initPortalSwitch() {
    const btnHome = document.getElementById("portal-btn-homeowner");
    const btnInst = document.getElementById("portal-btn-installer");
    const sectionHome = document.getElementById("homeowner-views");
    const sectionInst = document.getElementById("installer-portal-view");
    const tabsBar = document.getElementById("feature-tabs-bar");

    if (!btnHome || !btnInst) return;

    btnHome.addEventListener("click", () => {
        AppState.activePortal = "homeowner";
        btnHome.classList.add("active");
        btnInst.classList.remove("active");
        if (sectionHome) sectionHome.style.display = "block";
        if (sectionInst) sectionInst.style.display = "none";
        if (tabsBar) tabsBar.style.display = "block";
        showToast("Switched to Homeowner Solar Planning View", "info");
    });

    btnInst.addEventListener("click", () => {
        AppState.activePortal = "installer";
        btnInst.classList.add("active");
        btnHome.classList.remove("active");
        if (sectionHome) sectionHome.style.display = "none";
        if (sectionInst) sectionInst.style.display = "block";
        if (tabsBar) tabsBar.style.display = "none";
        renderLeadsList();
        showToast("Switched to Solar Installer B2B Lead Hub", "info");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Navigation
// ─────────────────────────────────────────────────────────────────────────────
function initFeatureTabs() {
    const homeownerViews = document.getElementById("homeowner-views");
    const compareSection = document.getElementById("section-compare");
    const budgetSection = document.getElementById("section-budget");
    if (homeownerViews && compareSection && budgetSection) {
        homeownerViews.insertBefore(compareSection, budgetSection);
    }

    const tabs = Array.from(document.querySelectorAll(".tab-link"));
    const sections = tabs
        .map(tab => document.querySelector(tab.getAttribute("href")))
        .filter(Boolean);

    if (!tabs.length || !sections.length) return;

    let navigationLock = null;
    let navigationTimer = null;

    const setActiveTab = (sectionId) => {
        tabs.forEach(tab => {
            const isActive = tab.getAttribute("href") === `#${sectionId}`;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-current", isActive ? "page" : "false");
        });
    };

    const finishNavigation = () => {
        if (!navigationLock) return;
        const targetId = navigationLock;
        navigationLock = null;
        if (navigationTimer) clearTimeout(navigationTimer);
        navigationTimer = null;
        setActiveTab(targetId);
    };

    const updateActiveTabFromScroll = () => {
        if (navigationLock) return;

        const headerOffset = 145;
        let currentSection = sections[0];
        sections.forEach(section => {
            if (section.getBoundingClientRect().top <= headerOffset + 20) {
                currentSection = section;
            }
        });
        setActiveTab(currentSection.id);
    };

    tabs.forEach(tab => {
        tab.addEventListener("click", (event) => {
            event.preventDefault();
            const targetId = tab.getAttribute("href").slice(1);
            const targetSection = document.getElementById(targetId);
            if (!targetSection) return;

            navigationLock = targetId;
            setActiveTab(targetId);
            targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            if (navigationTimer) clearTimeout(navigationTimer);
            navigationTimer = setTimeout(finishNavigation, 1500);
        });
    });

    if ("onscrollend" in window) {
        window.addEventListener("scrollend", () => {
            finishNavigation();
            updateActiveTabFromScroll();
        });
    }

    window.addEventListener("scroll", updateActiveTabFromScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
        if (navigationLock) return;
        const visibleSections = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visibleSections.length) setActiveTab(visibleSections[0].target.id);
    }, {
        rootMargin: "-145px 0px -55% 0px",
        threshold: [0.1, 0.35, 0.65]
    });

    sections.forEach(section => observer.observe(section));
    updateActiveTabFromScroll();
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Toggle (Dark / Light Mode)
// ─────────────────────────────────────────────────────────────────────────────
function initThemeToggle() {
    const toggleBtn = document.getElementById("theme-toggle-btn");
    const isDark = localStorage.getItem("iems_theme") === "dark";
    
    if (isDark) {
        document.body.classList.add("dark-mode");
        if (toggleBtn) toggleBtn.innerHTML = "☀️";
    }

    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const nowDark = document.body.classList.toggle("dark-mode");
            localStorage.setItem("iems_theme", nowDark ? "dark" : "light");
            toggleBtn.innerHTML = nowDark ? "☀️" : "🌙";
            
            // Re-render views & charts
            updateMonthlyYieldChart();
            update25YearProjection();
            updateFinancingOutputs();
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// City & Location Engine
// ─────────────────────────────────────────────────────────────────────────────
function initCitySelector() {
    const citySelect = document.getElementById("select-city");
    if (!citySelect) return;

    citySelect.innerHTML = "";
    Object.keys(SOLAR_DATA.cities).forEach(cityName => {
        const opt = document.createElement("option");
        opt.value = cityName;
        opt.textContent = `${cityName} (${SOLAR_DATA.cities[cityName].state})`;
        if (cityName === AppState.city) opt.selected = true;
        citySelect.appendChild(opt);
    });

    citySelect.addEventListener("change", (e) => {
        AppState.city = e.target.value;
        const discomCitySelect = document.getElementById("select-discom-city");
        if (discomCitySelect) discomCitySelect.value = AppState.city;

        const cityData = SOLAR_DATA.cities[AppState.city];
        if (cityData && cityData.default_discom) {
            AppState.discom = cityData.default_discom;
            const discomSelect = document.getElementById("select-discom");
            if (discomSelect) discomSelect.value = AppState.discom;
        }
        recalculateAll();
        showToast(`Updated location to ${AppState.city}`, "success");
    });

    // Custom GPS detect button
    const gpsBtn = document.getElementById("btn-gps-detect");
    if (gpsBtn) {
        gpsBtn.addEventListener("click", () => {
            if (navigator.geolocation) {
                gpsBtn.textContent = "Detecting...";
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        gpsBtn.textContent = "📍 Auto-Detect";
                        // Find closest city
                        const lat = pos.coords.latitude;
                        const lon = pos.coords.longitude;
                        let closest = "Delhi NCR";
                        let minDist = 999999;
                        Object.keys(SOLAR_DATA.cities).forEach(c => {
                            const d = Math.hypot(lat - SOLAR_DATA.cities[c].lat, lon - SOLAR_DATA.cities[c].lon);
                            if (d < minDist) { minDist = d; closest = c; }
                        });
                        AppState.city = closest;
                        citySelect.value = closest;
                        const discomCitySelect = document.getElementById("select-discom-city");
                        if (discomCitySelect) discomCitySelect.value = closest;

                        const cityData = SOLAR_DATA.cities[closest];
                        if (cityData && cityData.default_discom) {
                            AppState.discom = cityData.default_discom;
                            const discomSelect = document.getElementById("select-discom");
                            if (discomSelect) discomSelect.value = AppState.discom;
                        }
                        recalculateAll();
                        showToast(`Detected location: nearest solar station is ${closest}!`, "success");
                    },
                    (err) => {
                        gpsBtn.textContent = "📍 Auto-Detect";
                        showToast("Location access denied or unavailable. Using selected city.", "error");
                    }
                );
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4: DISCOM City Selector
// ─────────────────────────────────────────────────────────────────────────────
function initDiscomCitySelector() {
    const discomCitySelect = document.getElementById("select-discom-city");
    if (!discomCitySelect) return;

    discomCitySelect.innerHTML = "";
    Object.keys(SOLAR_DATA.cities).forEach(cityName => {
        const opt = document.createElement("option");
        opt.value = cityName;
        opt.textContent = `${cityName} (${SOLAR_DATA.cities[cityName].state})`;
        if (cityName === AppState.city) opt.selected = true;
        discomCitySelect.appendChild(opt);
    });

    discomCitySelect.addEventListener("change", (e) => {
        AppState.city = e.target.value;
        const citySelect = document.getElementById("select-city");
        if (citySelect) citySelect.value = AppState.city;

        const cityData = SOLAR_DATA.cities[AppState.city];
        if (cityData && cityData.default_discom) {
            AppState.discom = cityData.default_discom;
            const discomSelect = document.getElementById("select-discom");
            if (discomSelect) discomSelect.value = AppState.discom;
        }
        recalculateAll();
        showToast(`Updated location to ${AppState.city} (${AppState.discom})`, "success");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOM Selector
// ─────────────────────────────────────────────────────────────────────────────
function initDiscomSelector() {
    const discomSelect = document.getElementById("select-discom");
    if (!discomSelect) return;

    discomSelect.innerHTML = "";
    Object.keys(SOLAR_DATA.discoms).forEach(dKey => {
        const d = SOLAR_DATA.discoms[dKey];
        const opt = document.createElement("option");
        opt.value = dKey;
        opt.textContent = `${dKey} - ${d.state} (${d.metering_model})`;
        if (dKey === AppState.discom) opt.selected = true;
        discomSelect.appendChild(opt);
    });

    discomSelect.addEventListener("change", (e) => {
        AppState.discom = e.target.value;
        recalculateAll();
        showToast(`Switched to DISCOM: ${AppState.discom}`, "info");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard Form Inputs & Range Sliders
// ─────────────────────────────────────────────────────────────────────────────
function initWizardInputs() {
    // Monthly Bill Slider
    const billSlider = document.getElementById("slider-bill");
    const billDisplay = document.getElementById("val-bill");
    if (billSlider && billDisplay) {
        billSlider.addEventListener("input", (e) => {
            AppState.monthlyBill = parseInt(e.target.value, 10);
            billDisplay.textContent = `₹${AppState.monthlyBill.toLocaleString('en-IN')}`;
            recalculateAll();
        });
    }

    // Budget Cap Slider
    const budgetSlider = document.getElementById("slider-budget");
    const budgetDisplay = document.getElementById("val-budget");
    if (budgetSlider && budgetDisplay) {
        budgetSlider.addEventListener("input", (e) => {
            AppState.budgetCap = parseInt(e.target.value, 10);
            budgetDisplay.textContent = `₹${AppState.budgetCap.toLocaleString('en-IN')}`;
            recalculateAll();
        });
    }

    // Goal Buttons (Top Priority)
    const goalBtns = document.querySelectorAll(".goal-pill-btn");
    goalBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            goalBtns.forEach(b => {
                b.classList.remove("active");
                b.style.background = "";
                b.style.borderColor = "";
                b.style.color = "";
            });
            btn.classList.add("active");
            AppState.primaryGoal = btn.dataset.goal;

            // Automatically switch selected system to match chosen goal
            if (AppState.primaryGoal === "savings") {
                AppState.selectedSystemType = "starter";
            } else if (AppState.primaryGoal === "backup") {
                AppState.selectedSystemType = "resilience";
            } else {
                AppState.selectedSystemType = "hybrid";
            }

            recalculateAll();
            showToast(`Priority updated to ${btn.textContent.trim()}! System matched.`, "success");
        });
    });

    // Subsidy Toggle Checkbox
    const subsidyCheck = document.getElementById("check-subsidy-eligible");
    if (subsidyCheck) {
        subsidyCheck.addEventListener("change", (e) => {
            AppState.subsidyEligible = e.target.checked;
            recalculateAll();
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Financing Calculator Sliders
// ─────────────────────────────────────────────────────────────────────────────
function initFinancingSliders() {
    const downSlider = document.getElementById("slider-down-payment");
    const downDisplay = document.getElementById("val-down-payment");
    const tenureSlider = document.getElementById("slider-loan-tenure");
    const tenureDisplay = document.getElementById("val-loan-tenure");
    const interestSlider = document.getElementById("slider-interest-rate");
    const interestDisplay = document.getElementById("val-interest-rate");

    if (downSlider && downDisplay) {
        downSlider.addEventListener("input", (e) => {
            AppState.downPaymentPct = parseInt(e.target.value, 10);
            downDisplay.textContent = `${AppState.downPaymentPct}%`;
            updateFinancingOutputs();
        });
    }

    if (tenureSlider && tenureDisplay) {
        tenureSlider.addEventListener("input", (e) => {
            AppState.loanTenureYears = parseInt(e.target.value, 10);
            tenureDisplay.textContent = `${AppState.loanTenureYears} Years (${AppState.loanTenureYears * 12} Mo)`;
            updateFinancingOutputs();
        });
    }

    if (interestSlider && interestDisplay) {
        interestSlider.addEventListener("input", (e) => {
            AppState.loanInterestRatePct = parseFloat(e.target.value);
            interestDisplay.textContent = `${AppState.loanInterestRatePct.toFixed(1)}% p.a.`;
            updateFinancingOutputs();
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Solar & Financial Calculation Engine
// ─────────────────────────────────────────────────────────────────────────────
function recalculateAll() {
    const status = document.getElementById("calculation-status");
    if (AppState.calculationTimer) clearTimeout(AppState.calculationTimer);
    const runId = ++AppState.calculationRunId;

    if (status) {
        status.textContent = "Analyzing your inputs and preparing the solar recommendation...";
        status.classList.add("visible");
        status.setAttribute("aria-busy", "true");
    }

    AppState.calculationTimer = setTimeout(() => {
        performRecalculateAll();
        if (runId !== AppState.calculationRunId) return;
        if (status) {
            status.textContent = "Analysis complete. Your recommendation has been updated.";
            status.setAttribute("aria-busy", "false");
            setTimeout(() => {
                if (runId === AppState.calculationRunId) status.classList.remove("visible");
            }, 1800);
        }
    }, CALCULATION_DELAY_MS);
}

function performRecalculateAll() {
    const cityData = SOLAR_DATA.cities[AppState.city] || SOLAR_DATA.cities["Mathura"];
    const discomData = SOLAR_DATA.discoms[AppState.discom] || SOLAR_DATA.discoms["DVVNL"];

    // 1. Calculate Household Load & Baseline
    const tariffRate = cityData.avg_tariff_inr;
    const monthlyKwh = AppState.monthlyBill / tariffRate;
    const dailyKwh = monthlyKwh / 30.0;
    const psh = cityData.psh; // Peak sun hours

    // Baseline required kWp for 100% net zero offset
    let rawKw = dailyKwh / psh;
    rawKw = Math.max(1.0, Math.min(15.0, rawKw));

    // Standard panel tier snap (1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10)
    const basePanelKw = Math.round(rawKw * 2) / 2;

    // 2. Build 3 Solar Systems for Comparison
    // System A: Starter Eco (Grid-Tie, No Battery)
    const starterPanelKw = Math.max(1.0, basePanelKw);
    AppState.systems.starter = buildSystemSpec({
        name: "Starter Eco (Pure Grid-Tie)",
        type: "starter",
        panelKw: starterPanelKw,
        batteryKwh: 0,
        cityData,
        discomData
    });

    // System B: Smart Hybrid (Solar + Lithium Battery) [RECOMMENDED]
    const hybridPanelKw = Math.max(2.0, basePanelKw);
    const hybridBatteryKwh = Math.round(Math.min(10.0, Math.max(3.0, dailyKwh * 0.45)) * 2) / 2;
    AppState.systems.hybrid = buildSystemSpec({
        name: "Smart Hybrid (Solar + Battery)",
        type: "hybrid",
        panelKw: hybridPanelKw,
        batteryKwh: hybridBatteryKwh,
        cityData,
        discomData
    });

    // System C: Resilience Pro (High Capacity + Heavy Battery)
    const resPanelKw = Math.round((basePanelKw * 1.35) * 2) / 2;
    const resBatteryKwh = Math.round(Math.min(20.0, Math.max(7.5, dailyKwh * 0.9)) * 2) / 2;
    AppState.systems.resilience = buildSystemSpec({
        name: "Resilience Pro (Max Backup)",
        type: "resilience",
        panelKw: resPanelKw,
        batteryKwh: resBatteryKwh,
        cityData,
        discomData
    });

    // 3. Update UI Views
    updateLocationView(cityData, discomData);
    updateSubsidyView(cityData);
    updateDiscomView(discomData);
    updateComparisonView();
    updateBudgetMatchCard();
    updateWizardQuickMatchCard();
    update25YearProjection();
    updateFinancingOutputs();
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Wizard Quick Assessment Card Update
// ─────────────────────────────────────────────────────────────────────────────
function updateWizardQuickMatchCard() {
    const budget = AppState.budgetCap;
    let sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    
    let badgeText = "⚖️ Smart Hybrid Recommended";
    let descText = `⚖️ Balanced choice: Powers heavy day loads, stores afternoon surplus in ${sys.batteryKwh} kWh LiFePO4 battery, and wipes ~90% power bill with ${sys.backupHours} hrs night backup.`;

    if (AppState.primaryGoal === "savings") {
        badgeText = "💰 Max Savings & ROI Focus";
        descText = `💰 Maximum ROI: Pure grid-tie system with lowest capex (₹${sys.netCapex.toLocaleString('en-IN')}), fastest payback in ${sys.paybackYears} years, and zero battery replacement overhead!`;
    } else if (AppState.primaryGoal === "backup") {
        badgeText = "🔋 Maximum Outage Backup Focus";
        descText = `🔋 Maximum Resilience: Heavy ${sys.batteryKwh} kWh battery bank gives ${sys.backupHours}+ hours blackout autonomy (runs heavy appliances/AC) during severe load shedding.`;
    }

    // Maximum Budget Cap filtering
    if (sys.netCapex > budget) {
        const starter = AppState.systems.starter;
        const hybrid = AppState.systems.hybrid;
        if (AppState.selectedSystemType === "resilience" && hybrid && hybrid.netCapex <= budget) {
            badgeText = `⚠️ Budget-Filtered: Smart Hybrid Fits ₹${budget.toLocaleString('en-IN')} Cap`;
            descText = `⚖️ Resilience Pro (₹${AppState.systems.resilience.netCapex.toLocaleString('en-IN')}) exceeds your budget cap. Filtered to Smart Hybrid which fits within budget with essential outage backup!`;
            sys = hybrid;
        } else if (starter && starter.netCapex <= budget) {
            badgeText = `⚠️ Budget-Filtered: Starter Eco Fits ₹${budget.toLocaleString('en-IN')} Cap`;
            descText = `💰 Selected battery system exceeds your budget cap. Filtered to Starter Eco (₹${starter.netCapex.toLocaleString('en-IN')}) for maximum ROI within ₹${budget.toLocaleString('en-IN')}!`;
            sys = starter;
        } else {
            badgeText = `⚠️ Exceeds ₹${budget.toLocaleString('en-IN')} Cap — Solar Loan Fit`;
            descText = `⚡ Net cost (₹${sys.netCapex.toLocaleString('en-IN')}) exceeds your budget cap. Consider our 7.0% PM Surya Ghar loan with ₹${Math.round((sys.netCapex * 0.9 / 60) + (sys.netCapex * 0.9 * 0.07 / 12)).toLocaleString('en-IN')}/mo EMI!`;
        }
    } else {
        const remainingBuffer = budget - sys.netCapex;
        if (remainingBuffer > 0) {
            badgeText += ` (₹${remainingBuffer.toLocaleString('en-IN')} buffer)`;
        }
    }

    setElText("wizard-match-badge", badgeText);
    setElText("wizard-match-subsidy", `✓ ₹${sys.totalSubsidy.toLocaleString('en-IN')} Subsidy`);
    setElText("wizard-match-system", `${sys.panelKw} kW ${sys.batteryKwh > 0 ? '+ ' + sys.batteryKwh + ' kWh' : '(Grid-Tie)'}`);
    setElText("wizard-match-savings", `₹${sys.monthlySavingsInr.toLocaleString('en-IN')}/mo`);
    setElText("wizard-match-cost", `₹${sys.netCapex.toLocaleString('en-IN')}`);
    setElHtml("wizard-match-desc", descText);
}

// ─────────────────────────────────────────────────────────────────────────────
// System Specification Builder
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemSpec({ name, type, panelKw, batteryKwh, cityData, discomData }) {
    // Capex calculation
    const panelRatePerKw = 46000;
    const batteryRatePerKwh = 16000; // Lithium LiFePO4
    const bosAndInverter = type === "starter" ? 18000 : 35000; // Hybrid inverter is slightly costlier
    
    const grossCapex = Math.round((panelKw * panelRatePerKw) + (batteryKwh * batteryRatePerKwh) + bosAndInverter);
    
    // Subsidy Calculation (PM Surya Ghar + State Topup)
    let centralSubsidy = 0;
    if (AppState.subsidyEligible) {
        if (panelKw <= 1.0) centralSubsidy = 30000;
        else if (panelKw <= 2.0) centralSubsidy = 60000;
        else centralSubsidy = 78000; // Capped at 78,000 for >=3kW
    }

    // State specific top-up
    let stateSubsidy = 0;
    if (AppState.subsidyEligible && SOLAR_DATA.subsidies.state_topups[cityData.state]) {
        const topup = SOLAR_DATA.subsidies.state_topups[cityData.state];
        if (topup.state_subsidy_per_kw > 0) {
            stateSubsidy = Math.min(topup.max_state_subsidy, panelKw * topup.state_subsidy_per_kw);
        }
    }

    const totalSubsidy = centralSubsidy + stateSubsidy;
    const netCapex = Math.max(10000, grossCapex - totalSubsidy);

    // Generation & Energy Yield
    const annualGenerationKwh = Math.round(panelKw * cityData.annual_yield_per_kwp);
    const dailyGenerationKwh = Math.round((annualGenerationKwh / 365) * 10) / 10;
    
    // Self-consumption vs export ratio
    let selfConsumptionRatio = 0.65; // Starter exports ~35% during afternoon peak
    if (type === "hybrid") selfConsumptionRatio = 0.88; // Battery stores excess for evening
    if (type === "resilience") selfConsumptionRatio = 0.94; // Almost full utilization

    const selfConsumedKwh = annualGenerationKwh * selfConsumptionRatio;
    const exportedKwh = annualGenerationKwh * (1 - selfConsumptionRatio);

    // Annual bill savings & export revenue
    const importSavingsInr = selfConsumedKwh * cityData.avg_tariff_inr;
    const exportRevenueInr = exportedKwh * discomData.export_rate_inr;
    const totalAnnualSavingsInr = Math.round(importSavingsInr + exportRevenueInr);
    const monthlySavingsInr = Math.round(totalAnnualSavingsInr / 12);

    // Simple payback & 25-yr NPV
    const paybackYears = Math.round((netCapex / totalAnnualSavingsInr) * 10) / 10;
    
    // Outage protection hours
    let backupHours = 0;
    let unmetOutagePct = 100;
    if (type === "starter") {
        backupHours = 0; // Grid-tie shuts down during blackout
        unmetOutagePct = 100;
    } else if (type === "hybrid") {
        backupHours = Math.round(batteryKwh * 1.5 * 10) / 10; // Hours for average load
        unmetOutagePct = Math.max(5, Math.round(100 - (batteryKwh / 6.0) * 85));
    } else {
        backupHours = Math.round(batteryKwh * 1.8 * 10) / 10;
        unmetOutagePct = Math.max(1, Math.round(100 - (batteryKwh / 10.0) * 98));
    }

    // Roof space required (~80 sq ft per kW)
    const roofSqftRequired = Math.round(panelKw * 75);

    return {
        name,
        type,
        panelKw,
        batteryKwh,
        grossCapex,
        centralSubsidy,
        stateSubsidy,
        totalSubsidy,
        netCapex,
        annualGenerationKwh,
        dailyGenerationKwh,
        monthlySavingsInr,
        totalAnnualSavingsInr,
        paybackYears,
        backupHours,
        unmetOutagePct,
        roofSqftRequired,
        selfConsumedKwh,
        exportedKwh
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: Location-Based Solar Generation UI
// ─────────────────────────────────────────────────────────────────────────────
function updateLocationView(cityData, discomData) {
    // Fill text indicators
    setElText("loc-city-name", AppState.city);
    setElText("loc-state-name", cityData.state);
    setElText("loc-psh-val", `${cityData.psh} hrs/day`);
    setElText("loc-yield-val", `${cityData.annual_yield_per_kwp} kWh/kWp`);
    setElText("loc-tilt-val", `${cityData.tilt_optimal_deg}° South`);
    setElText("loc-outage-val", `${cityData.outage_hours_per_day} hrs/day`);
    setElText("loc-tariff-val", `₹${cityData.avg_tariff_inr.toFixed(2)}/unit`);

    // Layman summary explanation
    const sys = AppState.systems.hybrid;
    const laymanExplanation = `In <strong>${AppState.city}</strong>, a standard <strong>${sys.panelKw} kW</strong> solar array receives an average of <strong>${cityData.psh} peak sun hours</strong> daily. It will generate approximately <strong>${sys.dailyGenerationKwh} units (kWh) per day</strong>, wiping out ₹${sys.monthlySavingsInr.toLocaleString('en-IN')} from your monthly power bill. Your optimal roof tilt is <strong>${cityData.tilt_optimal_deg}° facing True South</strong>.`;
    setElHtml("loc-layman-summary", laymanExplanation);

    // Update compass pointer rotation
    const compassPointer = document.getElementById("compass-pointer-needle");
    if (compassPointer) {
        // True south is 180deg
        compassPointer.style.transform = `rotate(${cityData.azimuth_optimal_deg}deg)`;
    }

    // Render monthly solar yield chart
    updateMonthlyYieldChart();
}

function updateMonthlyYieldChart() {
    const cityData = SOLAR_DATA.cities[AppState.city];
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Scale GHI to monthly generation (kWh) for the selected system
    const monthlyGenKwh = cityData.monthly_ghi.map(ghi => {
        return Math.round(ghi * sys.panelKw * 30 * 0.78); // 0.78 PR factor
    });

    renderMonthlyYieldSVG("svg-monthly-yield", monthlyGenKwh, months, cityData.avg_tariff_inr, sys.panelKw);
}

function renderMonthlyYieldSVG(containerId, monthlyGenKwh, months, avgTariff, panelKw) {
    const host = document.getElementById(containerId);
    if (!host) return;

    const maxVal = Math.max(...monthlyGenKwh, 100);
    const chartMax = Math.ceil(maxVal * 1.2);
    const svgWidth = 640;
    const svgHeight = 220;
    const chartTop = 30;
    const chartBottom = 175;
    const chartHeight = chartBottom - chartTop;
    const leftMargin = 45;
    const barWidth = 32;
    const barGap = 16;

    // Peak month index
    let peakIndex = 0;
    let peakVal = 0;
    monthlyGenKwh.forEach((v, i) => {
        if (v > peakVal) { peakVal = v; peakIndex = i; }
    });

    // Grid lines
    const gridSteps = [0, Math.round(chartMax * 0.33), Math.round(chartMax * 0.66), chartMax];
    let gridLinesSvg = "";
    gridSteps.forEach(stepVal => {
        const yPos = chartBottom - (stepVal / chartMax) * chartHeight;
        gridLinesSvg += `
            <line x1="${leftMargin}" y1="${yPos}" x2="${svgWidth - 10}" y2="${yPos}" stroke="var(--border-color)" stroke-dasharray="3,3" stroke-width="1"/>
            <text x="${leftMargin - 8}" y="${yPos + 4}" font-size="10" fill="var(--text-faint)" text-anchor="end" font-family="Inter, sans-serif">${stepVal}</text>
        `;
    });

    // Bars
    let barsSvg = "";
    months.forEach((m, idx) => {
        const val = monthlyGenKwh[idx];
        const h = Math.max(4, (val / chartMax) * chartHeight);
        const x = leftMargin + 10 + idx * (barWidth + barGap);
        const y = chartBottom - h;
        const estSavings = Math.round(val * avgTariff);
        const isPeak = idx === peakIndex;

        let barFill = "url(#solarYieldGradient)";
        if (isPeak) barFill = "url(#peakYieldGradient)";

        barsSvg += `
            <g class="chart-svg-bar" data-month="${m}" data-kwh="${val}" data-savings="${estSavings}">
                <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="5" fill="${barFill}" />
                <text x="${x + barWidth / 2}" y="${y - 6}" font-size="10.5" font-weight="700" fill="var(--text-main)" text-anchor="middle" font-family="Inter, sans-serif">${val}</text>
                <text x="${x + barWidth / 2}" y="${chartBottom + 18}" font-size="11" font-weight="600" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">${m}</text>
                ${isPeak ? `<text x="${x + barWidth / 2}" y="${y - 18}" font-size="10" font-weight="700" fill="var(--accent-teal)" text-anchor="middle" font-family="Inter, sans-serif">★ Peak</text>` : ''}
            </g>
        `;
    });

    host.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="solarYieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#D97706" />
                </linearGradient>
                <linearGradient id="peakYieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#10B981" />
                    <stop offset="100%" stop-color="#0D9488" />
                </linearGradient>
            </defs>
            ${gridLinesSvg}
            ${barsSvg}
        </svg>
        <div id="tooltip-monthly-yield" class="chart-svg-tooltip" style="display:none;opacity:0;"></div>
    `;

    // Tooltip listeners
    const tooltip = host.querySelector("#tooltip-monthly-yield");
    host.querySelectorAll(".chart-svg-bar").forEach(bar => {
        bar.addEventListener("mouseenter", (e) => {
            const m = bar.dataset.month;
            const kwh = bar.dataset.kwh;
            const sav = parseInt(bar.dataset.savings, 10).toLocaleString('en-IN');
            tooltip.innerHTML = `<strong>${m} Yield:</strong> ${kwh} units (kWh)<br><span style="color:var(--accent-teal)">Wipes ₹${sav} from your bill</span>`;
            tooltip.style.display = "block";
            tooltip.style.opacity = "1";
        });
        bar.addEventListener("mousemove", (e) => {
            const rect = host.getBoundingClientRect();
            tooltip.style.left = `${e.clientX - rect.left + 12}px`;
            tooltip.style.top = `${e.clientY - rect.top - 38}px`;
        });
        bar.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            tooltip.style.display = "none";
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Budget-Based System Matching Card
// ─────────────────────────────────────────────────────────────────────────────
function updateBudgetMatchCard() {
    const budget = AppState.budgetCap;
    const starter = AppState.systems.starter;
    const hybrid = AppState.systems.hybrid;
    const resilience = AppState.systems.resilience;

    let matched = hybrid;
    let badgeText = "Best Budget Fit";

    if (AppState.primaryGoal === "savings") {
        if (starter && starter.netCapex <= budget) {
            matched = starter;
            badgeText = "Best Match for Max Savings & Fastest Payback";
        } else if (hybrid && hybrid.netCapex <= budget) {
            matched = hybrid;
            badgeText = "Fits Budget: Recommended Hybrid";
        } else {
            matched = starter;
            badgeText = "Lowest Upfront Investment (Exceeds Budget)";
        }
    } else if (AppState.primaryGoal === "backup") {
        if (resilience && resilience.netCapex <= budget) {
            matched = resilience;
            badgeText = "Fits Budget: Maximum Outage Autonomy";
        } else if (hybrid && hybrid.netCapex <= budget) {
            matched = hybrid;
            badgeText = "Fits Budget: Recommended Hybrid for Essential Backup";
        } else if (starter && starter.netCapex <= budget) {
            matched = starter;
            badgeText = "Fits Budget: Starter Eco Grid-Tie";
        } else {
            matched = starter;
            badgeText = "Lowest Upfront Investment (Exceeds Budget)";
        }
    } else {
        if (hybrid && hybrid.netCapex <= budget) {
            matched = hybrid;
            badgeText = "Fits Budget: Recommended Balanced Choice";
        } else if (starter && starter.netCapex <= budget) {
            matched = starter;
            badgeText = "Fits Budget: Lowest Upfront Investment";
        } else {
            matched = starter;
            badgeText = "Lowest Upfront Investment (Exceeds Budget)";
        }
    }

    setElText("budget-matched-title", matched.name);
    setElText("budget-matched-badge", badgeText);
    setElText("budget-matched-net", `₹${matched.netCapex.toLocaleString('en-IN')}`);
    setElText("budget-matched-orig", `₹${matched.grossCapex.toLocaleString('en-IN')}`);
    setElText("budget-matched-subsidy", `−₹${matched.totalSubsidy.toLocaleString('en-IN')} subsidy applied`);
    setElText("budget-matched-panel", `${matched.panelKw} kW`);
    setElText("budget-matched-battery", matched.batteryKwh > 0 ? `${matched.batteryKwh} kWh LiFePO4` : "None (Grid-Tie)");
    setElText("budget-matched-savings", `₹${matched.monthlySavingsInr.toLocaleString('en-IN')}/mo`);
    setElText("budget-matched-payback", `${matched.paybackYears} Years`);
    setElText("budget-matched-roof", `${matched.roofSqftRequired} sq. ft`);

    // Budget bar percentage
    const budgetPct = Math.round((matched.netCapex / budget) * 100);
    const budgetBar = document.getElementById("budget-utilization-bar");
    if (budgetBar) {
        budgetBar.style.width = `${Math.min(100, budgetPct)}%`;
        if (matched.netCapex <= budget) {
            budgetBar.style.background = "linear-gradient(90deg,var(--accent-teal),var(--accent-gold))";
        } else {
            budgetBar.style.background = "var(--accent-red)";
        }
    }

    if (matched.netCapex <= budget) {
        const remaining = budget - matched.netCapex;
        setElText("budget-utilization-text", `Uses ${budgetPct}% of your ₹${budget.toLocaleString('en-IN')} budget (₹${remaining.toLocaleString('en-IN')} buffer remaining)`);
    } else {
        const excess = matched.netCapex - budget;
        setElText("budget-utilization-text", `Exceeds your ₹${budget.toLocaleString('en-IN')} budget cap by ₹${excess.toLocaleString('en-IN')} (${budgetPct}% capex)`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3: Subsidy Eligibility Checker UI
// ─────────────────────────────────────────────────────────────────────────────
function updateSubsidyView(cityData) {
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    
    setElText("subsidy-system-kw", `${sys.panelKw} kW`);
    setElText("subsidy-central-amount", `₹${sys.centralSubsidy.toLocaleString('en-IN')}`);
    setElText("subsidy-state-amount", sys.stateSubsidy > 0 ? `+ ₹${sys.stateSubsidy.toLocaleString('en-IN')} (${cityData.state})` : "₹0 (No direct capex topup)");
    setElText("subsidy-total-amount", `₹${sys.totalSubsidy.toLocaleString('en-IN')}`);

    // Update dynamic state note
    const stateTopup = SOLAR_DATA.subsidies.state_topups[cityData.state];
    let note = "Only approved DCR (Domestic Content Requirement) panels installed by MNRE-empanelled vendors qualify for direct DBT subsidy.";
    if (stateTopup) {
        note = `<strong>${cityData.state} Note:</strong> ${stateTopup.notes}`;
    }
    setElHtml("subsidy-state-note", note);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4: DISCOM Export Tariff Database UI
// ─────────────────────────────────────────────────────────────────────────────
function updateDiscomView(discomData) {
    setElText("discom-full-name", discomData.name);
    setElText("discom-state-label", discomData.state);
    setElText("discom-model-tag", discomData.metering_model);
    setElText("discom-export-rate", `₹${discomData.export_rate_inr.toFixed(2)} / unit`);
    setElText("discom-import-rate", `₹${discomData.avg_import_rate_inr.toFixed(2)} / unit`);
    setElText("discom-settlement-period", discomData.settlement_period);
    setElText("discom-grid-stability", discomData.grid_stability_rating);
    setElHtml("discom-notes-text", discomData.notes);

    // Keep dropdowns in sync
    const discomSelect = document.getElementById("select-discom");
    if (discomSelect && discomSelect.value !== AppState.discom) {
        discomSelect.value = AppState.discom;
    }
    const discomCitySelect = document.getElementById("select-discom-city");
    if (discomCitySelect && discomCitySelect.value !== AppState.city) {
        discomCitySelect.value = AppState.city;
    }

    // Calculate export revenue demonstration
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    const annualExportRevenue = Math.round(sys.exportedKwh * discomData.export_rate_inr);
    const monthlyExportRevenue = Math.round(annualExportRevenue / 12);
    
    setElText("discom-est-export-units", `${Math.round(sys.exportedKwh).toLocaleString('en-IN')} units/year`);
    setElText("discom-est-export-revenue", `₹${annualExportRevenue.toLocaleString('en-IN')} / year (₹${monthlyExportRevenue}/mo)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 5: Compare 3 Solar Systems UI
// ─────────────────────────────────────────────────────────────────────────────
function updateComparisonView() {
    const s = AppState.systems.starter;
    const h = AppState.systems.hybrid;
    const r = AppState.systems.resilience;

    // Count how many systems fit within current budget cap
    const budget = AppState.budgetCap;
    const systemsList = [s, h, r].filter(Boolean);
    const withinBudgetList = systemsList.filter(sys => sys.netCapex <= budget);
    const withinBudgetCount = withinBudgetList.length;

    setElText("filter-budget-cap-val", `₹${budget.toLocaleString('en-IN')}`);
    setElText("filter-budget-summary-val", `₹${budget.toLocaleString('en-IN')}`);
    setElText("filter-budget-count", `${withinBudgetCount}`);

    const summaryEl = document.getElementById("compare-budget-summary");
    if (summaryEl) {
        summaryEl.innerHTML = `<span><strong>${withinBudgetCount} of 3</strong> systems fit within your <strong style="color:var(--accent-teal);">₹${budget.toLocaleString('en-IN')}</strong> budget cap</span>`;
    }

    renderCompareCard("starter", s);
    renderCompareCard("hybrid", h);
    renderCompareCard("resilience", r);
}

function setCompareFilter(filterType) {
    AppState.compareFilter = filterType;

    const btnAll = document.getElementById("btn-filter-all");
    const btnBudget = document.getElementById("btn-filter-budget");
    if (btnAll) btnAll.classList.toggle("active", filterType === "all");
    if (btnBudget) btnBudget.classList.toggle("active", filterType === "budget");

    updateComparisonView();
}

function renderCompareCard(key, sys) {
    if (!sys) return;
    setElText(`cmp-${key}-title`, sys.name);
    setElText(`cmp-${key}-specs`, `${sys.panelKw} kW Panel | ${sys.batteryKwh > 0 ? sys.batteryKwh + ' kWh Battery' : 'No Battery'}`);
    setElText(`cmp-${key}-net`, `₹${sys.netCapex.toLocaleString('en-IN')}`);
    setElText(`cmp-${key}-gross`, `₹${sys.grossCapex.toLocaleString('en-IN')}`);
    setElText(`cmp-${key}-subsidy`, `₹${sys.totalSubsidy.toLocaleString('en-IN')} Subsidy`);
    setElText(`cmp-${key}-monthly`, `₹${sys.monthlySavingsInr.toLocaleString('en-IN')}`);
    setElText(`cmp-${key}-annual`, `₹${sys.totalAnnualSavingsInr.toLocaleString('en-IN')}`);
    setElText(`cmp-${key}-payback`, `${sys.paybackYears} Years`);
    setElText(`cmp-${key}-backup`, sys.batteryKwh > 0 ? `${sys.backupHours} Hours Backup` : "0 Hrs (Shuts down in blackout)");
    setElText(`cmp-${key}-roof`, `${sys.roofSqftRequired} sq. ft`);

    // Budget Cap compatibility badge
    const budgetBadge = document.getElementById(`cmp-${key}-budget-badge`);
    const budget = AppState.budgetCap;
    const fitsBudget = sys.netCapex <= budget;
    if (budgetBadge) {
        if (fitsBudget) {
            const buffer = budget - sys.netCapex;
            budgetBadge.className = "compare-budget-badge within-budget";
            budgetBadge.innerHTML = `✓ Within Budget Cap (₹${buffer.toLocaleString('en-IN')} buffer)`;
        } else {
            const excess = sys.netCapex - budget;
            budgetBadge.className = "compare-budget-badge exceeds-budget";
            budgetBadge.innerHTML = `⚠️ Exceeds Budget Cap (+₹${excess.toLocaleString('en-IN')})`;
        }
    }

    // Filter effect when user clicks "Within Budget Cap"
    const cardEl = document.getElementById(`cmp-card-${key}`);
    const bannerEl = document.getElementById(`cmp-banner-${key}`);

    if (cardEl) {
        if (AppState.compareFilter === "budget") {
            if (!fitsBudget) {
                cardEl.classList.add("card-filtered-out");
            } else {
                cardEl.classList.remove("card-filtered-out");
            }
        } else {
            cardEl.classList.remove("card-filtered-out");
        }
    }

    // Winner highlight based on goal
    let isWinner = false;
    if (AppState.primaryGoal === "savings" && key === "starter") isWinner = true;
    else if (AppState.primaryGoal === "balanced" && key === "hybrid") isWinner = true;
    else if (AppState.primaryGoal === "backup" && key === "resilience") isWinner = true;

    if (cardEl) {
        if (isWinner) {
            cardEl.classList.add("winner");
            if (bannerEl) bannerEl.style.display = "block";
        } else {
            cardEl.classList.remove("winner");
            if (bannerEl) bannerEl.style.display = "none";
        }
    }
}

// System select button in comparison cards
function selectSystemForDetailedAnalysis(type) {
    AppState.selectedSystemType = type;
    
    // Highlight selected card visually
    ["starter", "hybrid", "resilience"].forEach(t => {
        const c = document.getElementById(`cmp-card-${t}`);
        if (c) {
            if (t === type) c.style.outline = "3px solid var(--accent-gold)";
            else c.style.outline = "none";
        }
    });

    recalculateAll();
    showToast(`Selected ${AppState.systems[type].name} for 25-Year Projection & Financing!`, "success");
    
    // Scroll to 25-year financial projection smoothly
    const finSection = document.getElementById("section-financials");
    if (finSection) finSection.scrollIntoView({ behavior: "smooth" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 6: 25-Year Financial Projection Engine
// ─────────────────────────────────────────────────────────────────────────────
function update25YearProjection() {
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    const cityData = SOLAR_DATA.cities[AppState.city];
    
    // Financial parameters
    const discountRate = 0.08; // 8% p.a.
    const panelDegradationRate = 0.0055; // 0.55% annual degradation
    const tariffInflationRate = 0.045; // 4.5% annual grid tariff increase
    let initialOmCost = 2000; // Annual O&M
    const inverterSwapYear = 10;
    const inverterSwapCost = Math.round(sys.panelKw * 5500); // Replacement inverter
    const batterySwapYear = 12;
    const batterySwapCost = sys.batteryKwh > 0 ? Math.round(sys.batteryKwh * 8000) : 0; // Battery cell swap

    let cumulativeCashflow = -sys.netCapex;
    let npvSum = -sys.netCapex;
    const projectionYears = [];
    const yearlyCashflowData = [];
    const cumulativeCashflowData = [];
    const annualSavingsData = [];
    let breakevenYear = 0;

    const tableBody = document.getElementById("table-financials-body");
    if (tableBody) tableBody.innerHTML = "";

    for (let yr = 1; yr <= 25; yr++) {
        // Output factor accounting for compound degradation
        const outputFactor = Math.pow(1 - panelDegradationRate, yr - 1);
        const generationKwh = Math.round(sys.annualGenerationKwh * outputFactor);
        
        // Grid tariff accounting for compound inflation
        const currentTariff = cityData.avg_tariff_inr * Math.pow(1 + tariffInflationRate, yr - 1);
        
        // Savings this year
        const savingsThisYear = Math.round((generationKwh * 0.75 * currentTariff) + (generationKwh * 0.25 * SOLAR_DATA.discoms[AppState.discom].export_rate_inr));
        
        // Maintenance cost this year
        const omCost = Math.round(initialOmCost * Math.pow(1.035, yr - 1));
        
        // Capital replacement cost
        let replacementCost = 0;
        if (yr === inverterSwapYear) replacementCost += inverterSwapCost;
        if (yr === batterySwapYear) replacementCost += batterySwapCost;

        // Net cash flow this year
        const netCashYear = savingsThisYear - omCost - replacementCost;
        cumulativeCashflow += netCashYear;
        
        // Discounted cash flow (NPV contribution)
        const discountedValue = netCashYear / Math.pow(1 + discountRate, yr);
        npvSum += discountedValue;

        if (cumulativeCashflow >= 0 && breakevenYear === 0) {
            breakevenYear = yr;
        }

        projectionYears.push(`Yr ${yr}`);
        yearlyCashflowData.push(netCashYear);
        cumulativeCashflowData.push(cumulativeCashflow);
        annualSavingsData.push(savingsThisYear);

        // Populate table (First 10 years + every 5th year for readability)
        if (tableBody && (yr <= 10 || yr % 5 === 0)) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>Year ${yr}</strong></td>
                <td>${generationKwh.toLocaleString('en-IN')} kWh</td>
                <td>₹${currentTariff.toFixed(2)}</td>
                <td style="color:var(--accent-teal);font-weight:600">+₹${savingsThisYear.toLocaleString('en-IN')}</td>
                <td style="color:var(--accent-red)">−₹${(omCost + replacementCost).toLocaleString('en-IN')}${replacementCost > 0 ? ' (Includes Inverter/Battery)' : ''}</td>
                <td><strong>+₹${netCashYear.toLocaleString('en-IN')}</strong></td>
                <td style="font-weight:700;color:${cumulativeCashflow >= 0 ? 'var(--accent-teal)' : 'var(--accent-red)'}">₹${cumulativeCashflow.toLocaleString('en-IN')}</td>
            `;
            tableBody.appendChild(tr);
        }
    }

    // Set KPI cards
    setElText("fin-kpi-npv", `₹${Math.round(npvSum).toLocaleString('en-IN')}`);
    setElText("fin-kpi-lifetime-profit", `₹${Math.round(cumulativeCashflow).toLocaleString('en-IN')}`);
    setElText("fin-kpi-breakeven", breakevenYear > 0 ? `${breakevenYear} Years` : `${sys.paybackYears} Years`);
    setElText("fin-kpi-lcoe", `₹2.10 / kWh (vs Grid ₹${cityData.avg_tariff_inr.toFixed(2)})`);

    // Render chart
    renderFinancialChart(projectionYears, cumulativeCashflowData, annualSavingsData);
}

function renderFinancialChart(labels, cumulativeData, annualSavings) {
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    renderFinancialProjectionSVG("svg-25yr-projection", labels, cumulativeData, annualSavings, sys.paybackYears, sys.netCapex);
}

function renderFinancialProjectionSVG(containerId, labels, cumulativeData, annualSavings, paybackYears, netCapex) {
    const host = document.getElementById(containerId);
    if (!host) return;

    const svgWidth = 740;
    const svgHeight = 290;
    const topMargin = 30;
    const bottomMargin = 240;
    const leftMargin = 60;
    const rightMargin = 25;
    const chartW = svgWidth - leftMargin - rightMargin;
    const chartH = bottomMargin - topMargin;

    const minVal = -Math.abs(netCapex);
    const maxVal = Math.max(...cumulativeData, 100000);
    const totalRange = maxVal - minVal;

    const getY = (val) => bottomMargin - ((val - minVal) / totalRange) * chartH;
    const getX = (i) => leftMargin + (i / (cumulativeData.length - 1)) * chartW;

    const zeroY = getY(0);

    // Grid lines for Y-axis
    const yTicks = [
        minVal,
        0,
        Math.round(maxVal * 0.25),
        Math.round(maxVal * 0.5),
        Math.round(maxVal * 0.75),
        maxVal
    ];

    let gridSvg = "";
    yTicks.forEach(tickVal => {
        const y = getY(tickVal);
        const label = tickVal === 0 ? "₹0 (Breakeven)" : (tickVal < 0 ? `-₹${Math.round(Math.abs(tickVal)/1000)}k` : `+₹${(tickVal/100000).toFixed(1)}L`);
        const isZero = tickVal === 0;
        gridSvg += `
            <line x1="${leftMargin}" y1="${y}" x2="${svgWidth - rightMargin}" y2="${y}" 
                  stroke="${isZero ? 'var(--text-muted)' : 'var(--border-color)'}" 
                  stroke-dasharray="${isZero ? 'none' : '3,3'}" 
                  stroke-width="${isZero ? '1.5' : '1'}"/>
            <text x="${leftMargin - 8}" y="${y + 4}" font-size="10.5" fill="${isZero ? 'var(--accent-gold-text)' : 'var(--text-faint)'}" font-weight="${isZero ? '700' : '500'}" text-anchor="end" font-family="Inter, sans-serif">${label}</text>
        `;
    });

    // Area polygon under cumulative profit curve (from zero line)
    let areaPoints = [];
    cumulativeData.forEach((val, idx) => {
        areaPoints.push(`${getX(idx)},${getY(val)}`);
    });
    // Close polygon through zero line
    areaPoints.push(`${getX(cumulativeData.length - 1)},${zeroY}`);
    areaPoints.push(`${getX(0)},${zeroY}`);

    // Cumulative polyline
    const cumulativePointsStr = cumulativeData.map((val, idx) => `${getX(idx)},${getY(val)}`).join(" ");

    // Annual savings polyline (scaled to fit nicely in chart)
    const annualSavingsPointsStr = annualSavings.map((val, idx) => `${getX(idx)},${getY(val * 4)}`).join(" ");

    // Breakeven point calculation
    let breakevenIdx = 0;
    for (let i = 0; i < cumulativeData.length; i++) {
        if (cumulativeData[i] >= 0) {
            breakevenIdx = i;
            break;
        }
    }
    const beX = getX(breakevenIdx);
    const beY = getY(cumulativeData[breakevenIdx]);

    // Year 10 Inverter Marker
    const invX = getX(9); // Year 10
    const invY = getY(cumulativeData[9]);

    // X-axis Year labels (every 5 years)
    let xLabelsSvg = "";
    for (let i = 0; i < cumulativeData.length; i += 4) {
        const x = getX(i);
        xLabelsSvg += `
            <line x1="${x}" y1="${bottomMargin}" x2="${x}" y2="${bottomMargin + 5}" stroke="var(--border-strong)" stroke-width="1"/>
            <text x="${x}" y="${bottomMargin + 20}" font-size="11" font-weight="600" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">Year ${i + 1}</text>
        `;
    }

    // Interactive Hover Circles
    let interactiveCirclesSvg = "";
    cumulativeData.forEach((val, idx) => {
        interactiveCirclesSvg += `
            <circle class="fin-chart-dot" cx="${getX(idx)}" cy="${getY(val)}" r="4.5" fill="#0D9488" stroke="#FFFFFF" stroke-width="1.5"
                    data-year="${idx + 1}" data-profit="${val}" data-savings="${annualSavings[idx]}" style="cursor:pointer;"/>
        `;
    });

    host.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.78rem;">
            <div style="display:flex;gap:16px;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-main);font-weight:600;">
                    <span style="width:12px;height:12px;border-radius:2px;background:#0D9488;display:inline-block;"></span> Cumulative Net Profit (₹)
                </span>
                <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);">
                    <span style="width:16px;height:2px;border-top:2px dashed #F59E0B;display:inline-block;"></span> Annual Savings (₹)
                </span>
            </div>
            <span style="color:var(--accent-teal);font-weight:700;">★ Breakeven in ~${paybackYears} Years</span>
        </div>
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="profitAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#0D9488" stop-opacity="0.32" />
                    <stop offset="100%" stop-color="#0D9488" stop-opacity="0.04" />
                </linearGradient>
            </defs>
            ${gridSvg}
            <polygon points="${areaPoints.join(' ')}" fill="url(#profitAreaGrad)" />
            <polyline points="${annualSavingsPointsStr}" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,4" />
            <polyline points="${cumulativePointsStr}" fill="none" stroke="#0D9488" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Breakeven Callout -->
            <g transform="translate(${beX}, ${beY})">
                <circle r="7" fill="#0D9488" stroke="#FFFFFF" stroke-width="2"/>
                <circle r="12" fill="none" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="2,2"/>
                <rect x="10" y="-24" width="130" height="22" rx="4" fill="var(--bg-card)" stroke="#0D9488" stroke-width="1.5"/>
                <text x="16" y="-9" font-size="10.5" font-weight="700" fill="var(--accent-teal)" font-family="Inter, sans-serif">★ Breakeven: Yr ${paybackYears}</text>
            </g>

            <!-- Year 10 Inverter Marker -->
            <g transform="translate(${invX}, ${invY})">
                <line x1="0" y1="-30" x2="0" y2="30" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3,3"/>
                <circle r="5" fill="#F59E0B" stroke="#FFFFFF" stroke-width="1.5"/>
                <rect x="-65" y="-48" width="130" height="18" rx="3" fill="var(--bg-card)" stroke="var(--border-strong)" stroke-width="1"/>
                <text x="0" y="-35" font-size="9" font-weight="600" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">Yr 10 Inverter Swap</text>
            </g>

            ${interactiveCirclesSvg}
            ${xLabelsSvg}
        </svg>
        <div id="tooltip-25yr-projection" class="chart-svg-tooltip" style="display:none;opacity:0;"></div>
    `;

    // Tooltip listeners
    const tooltip = host.querySelector("#tooltip-25yr-projection");
    host.querySelectorAll(".fin-chart-dot").forEach(dot => {
        dot.addEventListener("mouseenter", (e) => {
            const yr = dot.dataset.year;
            const profit = parseInt(dot.dataset.profit, 10);
            const sav = parseInt(dot.dataset.savings, 10).toLocaleString('en-IN');
            const sign = profit >= 0 ? "+" : "−";
            const profitColor = profit >= 0 ? "var(--accent-teal)" : "var(--accent-red)";
            tooltip.innerHTML = `
                <strong>Year ${yr}:</strong><br>
                Cumulative Profit: <strong style="color:${profitColor}">${sign}₹${Math.abs(profit).toLocaleString('en-IN')}</strong><br>
                Annual Savings: <strong>+₹${sav}</strong>
            `;
            tooltip.style.display = "block";
            tooltip.style.opacity = "1";
        });
        dot.addEventListener("mousemove", (e) => {
            const rect = host.getBoundingClientRect();
            tooltip.style.left = `${e.clientX - rect.left + 12}px`;
            tooltip.style.top = `${e.clientY - rect.top - 46}px`;
        });
        dot.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            tooltip.style.display = "none";
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 7: Installer Marketplace UI & Direct Quotation
// ─────────────────────────────────────────────────────────────────────────────
function initInstallerMarketplace() {
    renderInstallersList(SOLAR_DATA.installers);

    // City Filter for Installers
    const filterCity = document.getElementById("filter-installer-city");
    if (filterCity) {
        filterCity.innerHTML = `<option value="all">All Cities</option>`;
        const uniqueCities = [...new Set(SOLAR_DATA.installers.map(i => i.city))];
        uniqueCities.forEach(c => {
            filterCity.innerHTML += `<option value="${c}">${c}</option>`;
        });

        filterCity.addEventListener("change", (e) => {
            const selected = e.target.value;
            if (selected === "all") renderInstallersList(SOLAR_DATA.installers);
            else renderInstallersList(SOLAR_DATA.installers.filter(i => i.city === selected || i.service_areas.includes(selected)));
        });
    }
}

function renderInstallersList(installers) {
    const container = document.getElementById("installers-grid");
    if (!container) return;

    container.innerHTML = "";
    installers.forEach(inst => {
        const card = document.createElement("div");
        card.className = "installer-card";
        card.innerHTML = `
            <div>
                <div class="installer-head">
                    <div>
                        <h3>${inst.name}</h3>
                        <p style="font-size:0.8rem;color:var(--text-muted)">📍 ${inst.city} & nearby regions</p>
                    </div>
                    <div class="installer-rating">★ ${inst.rating} <span>(${inst.reviews_count})</span></div>
                </div>
                <div class="installer-badges">
                    ${inst.badges.map(b => `<span class="badge-mini highlight">${b}</span>`).join('')}
                </div>
                <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px">${inst.description}</p>
                <div class="installer-meta-list">
                    <div>⚡ <strong>${inst.completed_projects}+</strong> Installations completed</div>
                    <div>🛡️ <strong>${inst.warranty}</strong></div>
                    <div>⏱️ Avg. response within <strong>${inst.avg_quote_turnaround_hours} hours</strong></div>
                    <div>🏷️ <strong>${inst.pricing_tier}</strong></div>
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn-primary" style="flex:1" onclick="openSurveyModal('${inst.name}', '${inst.id}')">Request Site Survey</button>
                <a href="tel:${inst.phone}" class="btn-secondary" style="padding:10px 14px" title="Call Installer">📞</a>
            </div>
        `;
        container.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 8: Financing Calculator (Loan & EMI)
// ─────────────────────────────────────────────────────────────────────────────
function updateFinancingOutputs() {
    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    const netCost = sys.netCapex;

    // Down payment amount & Loan principal
    const downPaymentInr = Math.round((netCost * AppState.downPaymentPct) / 100);
    const loanPrincipal = Math.max(0, netCost - downPaymentInr);

    // Monthly interest rate & number of months
    const monthlyRate = (AppState.loanInterestRatePct / 100) / 12;
    const totalMonths = AppState.loanTenureYears * 12;

    // Standard EMI formula: [P * R * (1+R)^N] / [(1+R)^N - 1]
    let monthlyEmi = 0;
    let totalLoanPayment = 0;
    let totalInterest = 0;

    if (loanPrincipal > 0) {
        monthlyEmi = Math.round(
            (loanPrincipal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1)
        );
        totalLoanPayment = monthlyEmi * totalMonths;
        totalInterest = totalLoanPayment - loanPrincipal;
    }

    // Compare with monthly bill savings!
    const monthlySavings = sys.monthlySavingsInr;
    const netMonthlyCashflow = monthlySavings - monthlyEmi;

    setElText("fin-loan-principal", `₹${loanPrincipal.toLocaleString('en-IN')}`);
    setElText("fin-down-amount", `₹${downPaymentInr.toLocaleString('en-IN')}`);
    setElText("fin-monthly-emi", `₹${monthlyEmi.toLocaleString('en-IN')}`);
    setElText("fin-total-interest", `₹${totalInterest.toLocaleString('en-IN')}`);
    setElText("fin-monthly-savings", `₹${monthlySavings.toLocaleString('en-IN')}`);

    // Update the psychological unlock card: Net Positive Indicator!
    const indicatorEl = document.getElementById("net-positive-indicator-box");
    if (indicatorEl) {
        if (netMonthlyCashflow >= 0) {
            indicatorEl.innerHTML = `
                <h4 style="color:var(--accent-teal)">🎉 You are Net Positive by +₹${netMonthlyCashflow.toLocaleString('en-IN')}/mo from Day 1!</h4>
                <p>Your solar savings (₹${monthlySavings.toLocaleString('en-IN')}) exceed your loan EMI (₹${monthlyEmi.toLocaleString('en-IN')}). The solar system pays for itself while putting extra cash in your pocket every month!</p>
            `;
            indicatorEl.style.background = "var(--accent-teal-tint)";
            indicatorEl.style.borderColor = "var(--accent-teal)";
        } else {
            indicatorEl.innerHTML = `
                <h4 style="color:var(--accent-gold-text)">⚡ Net Out-of-Pocket: ₹${Math.abs(netMonthlyCashflow).toLocaleString('en-IN')}/mo during loan tenure</h4>
                <p>After ${AppState.loanTenureYears} years when the loan finishes, you will enjoy 100% free electricity saving ₹${monthlySavings.toLocaleString('en-IN')}+ every single month for the next 20 years!</p>
            `;
            indicatorEl.style.background = "var(--accent-gold-tint)";
            indicatorEl.style.borderColor = "var(--accent-gold)";
        }
    }

    updateLoanVsSavingsChart(monthlySavings, monthlyEmi);
}

function updateLoanVsSavingsChart(monthlySavings, monthlyEmi) {
    renderLoanVsSavingsSVG("svg-loan-vs-savings", monthlySavings, monthlyEmi);
}

function renderLoanVsSavingsSVG(containerId, monthlySavings, monthlyEmi) {
    const host = document.getElementById(containerId);
    if (!host) return;

    const net = monthlySavings - monthlyEmi;
    const maxVal = Math.max(monthlySavings, monthlyEmi, 1000) * 1.25;
    const svgWidth = 400;
    const svgHeight = 140;
    const chartBottom = 105;
    const chartHeight = 78;

    const savH = Math.max(6, (monthlySavings / maxVal) * chartHeight);
    const emiH = Math.max(6, (monthlyEmi / maxVal) * chartHeight);

    const barW = 75;
    const xSav = 85;
    const xEmi = 240;

    host.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="savBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#0D9488"/>
                    <stop offset="100%" stop-color="#0F766E"/>
                </linearGradient>
                <linearGradient id="emiBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#F59E0B"/>
                    <stop offset="100%" stop-color="#D97706"/>
                </linearGradient>
            </defs>
            <!-- Baseline -->
            <line x1="30" y1="${chartBottom}" x2="370" y2="${chartBottom}" stroke="var(--border-strong)" stroke-width="1.5"/>

            <!-- Savings Bar -->
            <rect x="${xSav}" y="${chartBottom - savH}" width="${barW}" height="${savH}" rx="6" fill="url(#savBarGrad)"/>
            <text x="${xSav + barW / 2}" y="${chartBottom - savH - 8}" font-size="12" font-weight="700" fill="var(--accent-teal)" text-anchor="middle" font-family="Inter, sans-serif">+₹${monthlySavings.toLocaleString('en-IN')}</text>
            <text x="${xSav + barW / 2}" y="${chartBottom + 18}" font-size="11" font-weight="600" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">Monthly Savings</text>

            <!-- EMI Bar -->
            <rect x="${xEmi}" y="${chartBottom - emiH}" width="${barW}" height="${emiH}" rx="6" fill="url(#emiBarGrad)"/>
            <text x="${xEmi + barW / 2}" y="${chartBottom - emiH - 8}" font-size="12" font-weight="700" fill="var(--accent-gold-text)" text-anchor="middle" font-family="Inter, sans-serif">−₹${monthlyEmi.toLocaleString('en-IN')}</text>
            <text x="${xEmi + barW / 2}" y="${chartBottom + 18}" font-size="11" font-weight="600" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">Loan EMI</text>
        </svg>
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 9: Solar Project Leads (B2B Installer Portal)
// ─────────────────────────────────────────────────────────────────────────────
function initLeadsPortal() {
    const cityFilter = document.getElementById("filter-lead-city");
    if (cityFilter) {
        cityFilter.innerHTML = `<option value="all">All Locations</option>`;
        Object.keys(SOLAR_DATA.cities).forEach(cityName => {
            cityFilter.innerHTML += `<option value="${cityName}">${cityName}</option>`;
        });
        cityFilter.addEventListener("change", () => renderLeadsList());
    }

    const sortFilter = document.getElementById("filter-lead-sort");
    if (sortFilter) {
        sortFilter.addEventListener("change", () => renderLeadsList());
    }
}

function loadLeads() {
    const saved = localStorage.getItem("iems_solar_leads");
    if (saved) {
        try {
            AppState.leads = JSON.parse(saved);
        } catch (e) {
            AppState.leads = [...SOLAR_DATA.sample_leads];
        }
    } else {
        AppState.leads = [...SOLAR_DATA.sample_leads];
    }
}

function saveLeads() {
    localStorage.setItem("iems_solar_leads", JSON.stringify(AppState.leads));
}

function renderLeadsList() {
    const container = document.getElementById("leads-container");
    if (!container) return;

    const cityFilter = document.getElementById("filter-lead-city")?.value || "all";
    const sortFilter = document.getElementById("filter-lead-sort")?.value || "latest";

    let filtered = [...AppState.leads];
    if (cityFilter !== "all") {
        filtered = filtered.filter(l => l.city.toLowerCase() === cityFilter.toLowerCase());
    }

    if (sortFilter === "intent") {
        filtered.sort((a, b) => b.intent_score - a.intent_score);
    } else if (sortFilter === "bill") {
        filtered.sort((a, b) => b.monthly_bill_inr - a.monthly_bill_inr);
    }

    setElText("leads-total-count", `${filtered.length} Qualified Leads Available`);

    container.innerHTML = "";
    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No leads match the selected filter. Try selecting 'All Locations'.</div>`;
        return;
    }

    filtered.forEach(lead => {
        const isClaimed = lead.claimed_by_me === true;
        const card = document.createElement("div");
        card.className = "lead-card";
        card.innerHTML = `
            <div>
                <div class="lead-top">
                    <div>
                        <div style="font-size:0.75rem;color:var(--text-faint);margin-bottom:2px">${lead.id} • ${lead.created_at}</div>
                        <h3 style="font-size:1.15rem">${lead.name}</h3>
                        <p style="font-size:0.8rem;color:var(--text-muted)">📍 ${lead.colony || lead.city}, ${lead.city}</p>
                    </div>
                    <div class="lead-intent-score">
                        ${lead.intent_score}
                        <span>SCORE</span>
                    </div>
                </div>

                <div class="installer-badges" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;">
                    ${(lead.verification_tags || ["OTP Verified"]).map(t => `<span class="badge-mini highlight">✓ ${t}</span>`).join('')}
                    ${lead.assigned_partner ? `<span class="badge-mini" style="background:var(--accent-teal-tint);color:var(--accent-teal);border:1px solid rgba(13,148,136,0.3)">🤝 Partner: ${lead.assigned_partner}</span>` : ''}
                </div>

                <div class="lead-specs-table">
                    <div class="item">
                        <span>Monthly Bill</span>
                        <strong>₹${lead.monthly_bill_inr.toLocaleString('en-IN')}</strong>
                    </div>
                    <div class="item">
                        <span>Roof Area</span>
                        <strong>${lead.roof_sqft || 500} sq. ft (${lead.roof_type || 'RCC'})</strong>
                    </div>
                    <div class="item">
                        <span>System Desired</span>
                        <strong>${lead.recommended_system}</strong>
                    </div>
                    <div class="item">
                        <span>Budget</span>
                        <strong>₹${(lead.budget_inr || 250000).toLocaleString('en-IN')}</strong>
                    </div>
                </div>

                ${lead.customer_note ? `<p style="font-size:0.78rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;background:var(--bg-card-subtle);padding:8px;border-radius:6px">"${lead.customer_note}"</p>` : ''}
            </div>

            <div class="lead-action-row">
                <div>
                    <span style="font-size:0.7rem;color:var(--text-faint);display:block">VERIFIED PHONE</span>
                    <strong class="mono" style="font-size:0.95rem;color:var(--text-main)">${isClaimed ? lead.phone_revealed : lead.phone}</strong>
                </div>
                ${isClaimed ? `
                    <button class="btn-teal" style="font-size:0.8rem" onclick="alert('Contact details already unlocked! Call: ${lead.phone_revealed}')">✓ Unlocked</button>
                ` : `
                    <button class="btn-primary" style="padding:8px 14px;font-size:0.82rem" onclick="openClaimLeadModal('${lead.id}')">Claim Lead (₹${lead.lead_price_inr || 299})</button>
                `}
            </div>
        `;
        container.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals & User Actions
// ─────────────────────────────────────────────────────────────────────────────
function initModals() {
    // Close modal on click outside or close button
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("open");
            }
        });
    });

    document.querySelectorAll(".modal-close").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.closest(".modal-overlay").classList.remove("open");
        });
    });
}

function openSurveyModal(installerName = "", installerId = "") {
    const modal = document.getElementById("modal-survey-quote");
    if (!modal) return;

    const userCity = AppState.city;
    setElText("survey-modal-city-badge", userCity);

    // Populate the partners dropdown based on the location previously given (AppState.city)
    populateSurveyPartners(installerId, installerName);

    const sys = AppState.systems[AppState.selectedSystemType] || AppState.systems.hybrid;
    
    // Auto-fill system recommendation summary
    const specField = document.getElementById("survey-field-system");
    if (specField) {
        specField.value = `${sys.name} (${sys.panelKw} kW Panel + ${sys.batteryKwh > 0 ? sys.batteryKwh + ' kWh Battery' : 'Grid-Tie'})`;
    }

    const cityField = document.getElementById("survey-field-city");
    if (cityField) cityField.value = userCity;

    const billField = document.getElementById("survey-field-bill");
    if (billField) billField.value = AppState.monthlyBill;

    modal.classList.add("open");
}

function populateSurveyPartners(preferredId = "", preferredName = "") {
    const partnerSelect = document.getElementById("survey-partner-select");
    if (!partnerSelect) return;

    const userCity = AppState.city;
    partnerSelect.innerHTML = "";

    // Filter installers based on location user gave previously
    let matchedInstallers = SOLAR_DATA.installers.filter(i => 
        i.city === userCity || (i.service_areas && i.service_areas.includes(userCity))
    );

    // If none specifically match city, fallback to all installers
    if (matchedInstallers.length === 0) {
        matchedInstallers = SOLAR_DATA.installers;
    }

    // Add local options
    matchedInstallers.forEach(inst => {
        const opt = document.createElement("option");
        opt.value = inst.id;
        opt.textContent = `${inst.name} (${inst.rating}★ | ${inst.completed_projects}+ Rooftops | ${inst.badges[0] || 'Empanelled'})`;
        opt.dataset.name = inst.name;
        partnerSelect.appendChild(opt);
    });

    // Also add option for other verified national partners
    const otherInstallers = SOLAR_DATA.installers.filter(i => !matchedInstallers.some(m => m.id === i.id));
    if (otherInstallers.length > 0) {
        const optGroup = document.createElement("optgroup");
        optGroup.label = "── Other Empanelled Partners ──";
        otherInstallers.forEach(inst => {
            const opt = document.createElement("option");
            opt.value = inst.id;
            opt.textContent = `${inst.name} [${inst.city}] (${inst.rating}★)`;
            opt.dataset.name = inst.name;
            optGroup.appendChild(opt);
        });
        partnerSelect.appendChild(optGroup);
    }

    // Select preferred if passed, else default to first matched installer
    let targetInstaller = matchedInstallers[0];
    if (preferredId && SOLAR_DATA.installers.some(i => i.id === preferredId)) {
        partnerSelect.value = preferredId;
        targetInstaller = SOLAR_DATA.installers.find(i => i.id === preferredId);
    } else if (preferredName && SOLAR_DATA.installers.some(i => i.name.toLowerCase().includes(preferredName.toLowerCase()))) {
        targetInstaller = SOLAR_DATA.installers.find(i => i.name.toLowerCase().includes(preferredName.toLowerCase()));
        partnerSelect.value = targetInstaller.id;
    } else {
        partnerSelect.value = targetInstaller.id;
    }

    updateSurveyPartnerDetails(targetInstaller);

    partnerSelect.onchange = (e) => {
        const selectedId = e.target.value;
        const inst = SOLAR_DATA.installers.find(i => i.id === selectedId) || matchedInstallers[0];
        updateSurveyPartnerDetails(inst);
    };
}

function updateSurveyPartnerDetails(inst) {
    if (!inst) return;
    setElText("survey-modal-installer", inst.name);
    
    const detailsBox = document.getElementById("survey-partner-details-box");
    if (detailsBox) {
        detailsBox.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <span class="badge-tag" style="font-size:0.7rem;">⭐ ${inst.rating} / 5.0 (${inst.reviews_count} Reviews)</span>
                <span class="badge-mini highlight" style="font-size:0.7rem;">⚡ ${inst.completed_projects}+ Installations</span>
                <span class="badge-mini" style="font-size:0.7rem;background:var(--accent-teal-tint);color:var(--accent-teal);">⏱️ ~${inst.avg_quote_turnaround_hours}h Turnaround</span>
            </div>
            <div style="color:var(--text-muted);font-size:0.75rem;">
                🛡️ <strong>Warranty:</strong> ${inst.warranty} | 🏷️ <strong>Pricing:</strong> ${inst.pricing_tier}
            </div>
        `;
    }
}

function submitSurveyQuote(e) {
    if (e) e.preventDefault();
    
    const name = document.getElementById("survey-input-name")?.value || "Solar Customer";
    const phone = document.getElementById("survey-input-phone")?.value || "+91 98765 00000";
    const city = document.getElementById("survey-field-city")?.value || AppState.city;
    const bill = parseFloat(document.getElementById("survey-field-bill")?.value || AppState.monthlyBill);
    const system = document.getElementById("survey-field-system")?.value || "3.5 kW Hybrid Solar";
    const note = document.getElementById("survey-input-notes")?.value || "Requested site survey & engineering quotation.";

    const partnerSelect = document.getElementById("survey-partner-select");
    const selectedPartnerId = partnerSelect?.value;
    const selectedPartner = SOLAR_DATA.installers.find(i => i.id === selectedPartnerId) || SOLAR_DATA.installers[0];

    // 1. Add as a live new Lead into the B2B Leads Store!
    const newLead = {
        id: `LEAD-${100 + AppState.leads.length + 1}`,
        name: name,
        phone: phone.replace(/(\d{5})$/, "•••••"),
        phone_revealed: phone,
        city: city,
        colony: "Sector 5, Prime Residential",
        monthly_bill_inr: bill,
        sanctioned_load_kw: Math.round(bill / 800),
        roof_sqft: AppState.roofAreaSqft || 550,
        roof_type: "RCC Flat Terrace",
        recommended_system: system,
        budget_inr: AppState.budgetCap,
        subsidy_eligible: AppState.subsidyEligible,
        assigned_partner: selectedPartner.name,
        assigned_partner_id: selectedPartner.id,
        intent_score: 98, // High intent verified
        created_at: "Just now",
        lead_price_inr: 399,
        status: "New & Assigned",
        verification_tags: ["Instant Web Enquiry", `Assigned: ${selectedPartner.name}`, "Ready for Site Survey"],
        customer_note: note,
        claimed_by_me: false
    };

    AppState.leads.unshift(newLead);
    saveLeads();

    // 2. Also send to backend FastAPI endpoint if alive
    const API_BASE = (window.location && window.location.origin && window.location.origin.startsWith("http")) 
        ? window.location.origin 
        : "http://localhost:8000";

    try {
        fetch(`${API_BASE}/api/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                phone,
                city,
                monthly_bill_inr: bill,
                recommended_system: system,
                budget_inr: AppState.budgetCap,
                roof_sqft: AppState.roofAreaSqft,
                subsidy_eligible: AppState.subsidyEligible,
                assigned_partner: selectedPartner.name,
                notes: note
            })
        }).catch(err => console.log("Backend offline, lead stored locally in browser"));
    } catch (e) {}

    // Close modal & celebrate
    document.getElementById("modal-survey-quote")?.classList.remove("open");
    showToast(`Survey Request submitted! Connected with ${selectedPartner.name} in ${city}.`, "success");
    
    // Refresh leads view if open
    renderLeadsList();
}

function openClaimLeadModal(leadId) {
    const lead = AppState.leads.find(l => l.id === leadId);
    if (!lead) return;

    const modal = document.getElementById("modal-claim-lead");
    if (!modal) return;

    setElText("claim-modal-lead-id", lead.id);
    setElText("claim-modal-customer-name", lead.name);
    setElText("claim-modal-city", lead.city);
    setElText("claim-modal-system", lead.recommended_system);
    setElText("claim-modal-price", `₹${lead.lead_price_inr || 299}`);

    // Store target lead in dataset
    modal.dataset.leadId = leadId;
    modal.classList.add("open");
}

function confirmClaimLead() {
    const modal = document.getElementById("modal-claim-lead");
    if (!modal) return;

    const leadId = modal.dataset.leadId;
    const lead = AppState.leads.find(l => l.id === leadId);
    if (lead) {
        lead.claimed_by_me = true;
        lead.phone_revealed = lead.phone.replace("•••••", "43210");
        saveLeads();
        renderLeadsList();
        modal.classList.remove("open");
        showToast(`Lead ${leadId} unlocked! Verified contact: ${lead.phone_revealed}`, "success");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print / Save Proposal Summary
// ─────────────────────────────────────────────────────────────────────────────
function printSolarProposal() {
    window.print();
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notification Utility
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
    let toast = document.getElementById("app-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "app-toast";
        toast.className = "toast-notice";
        document.body.appendChild(toast);
    }

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toast.classList.add("show");

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Helper Utilities
// ─────────────────────────────────────────────────────────────────────────────
function setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setElHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// Check Backend Health (Optional connection to FastAPI app.py)
function checkBackendHealth() {
    const badge = document.getElementById("backend-status-badge");
    const API_BASE = (window.location && window.location.origin && window.location.origin.startsWith("http")) 
        ? window.location.origin 
        : "http://localhost:8000";

    fetch(`${API_BASE}/api/health`, { method: "GET" })
        .then(res => res.json())
        .then(data => {
            if (badge) {
                badge.textContent = "● API Online";
                badge.style.color = "var(--accent-teal)";
            }
        })
        .catch(() => {
            if (badge) {
                badge.textContent = "● Standalone Physics Mode";
                badge.style.color = "var(--text-faint)";
            }
        });
}
