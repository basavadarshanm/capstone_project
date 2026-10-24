"""
IEMS – Grid Search Sizing (§9.1)
===================================
Brute-force sweep across commercially realistic panel + battery size
combinations. For each combination, simulates a full year using the
rule-based controller (deliberately NOT DQN/MPC — see the build spec's
§6 dependency resolution: sizing must stay fast and independent of RL
training), then scores each combination financially.

Why grid search here and not a smarter search algorithm
-----------------------------------------------------------
With 8 panel sizes × 6 battery sizes = 48 combinations, each a cheap
vectorized year-long simulation (seconds), brute force finds the exact
best answer in the discrete space in under ~2 minutes. Real hardware
only comes in fixed commercial sizes anyway, so a discrete sweep matches
what's actually purchasable — no rounding a continuous "optimum" down to
something a customer can buy. See §9.2 in the build spec for when a
genetic algorithm (NSGA-II) is actually justified instead (continuous
sizing + multiple simultaneous objectives).

Output
------
Does NOT collapse to one "optimal" system — returns the full scored
table plus three named recommendations (fastest payback / best 25yr NPV /
best outage backup), since "optimal" depends on what the customer values.
"""

from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
import pandas as pd
from loguru import logger

from src.environment.energy_env import EnergyEnv
from src.grid.grid_model import GridModel
from src.controllers.rule_based import RuleBasedController
from src.report.financials import full_financial_analysis, FinancialSummary


# ─────────────────────────────────────────────────────────────────────────────
# Simulation for one candidate system size
# ─────────────────────────────────────────────────────────────────────────────

def simulate_system_size(
    load_kw: np.ndarray,
    solar_kw_per_kwp: np.ndarray,
    timestamps: pd.DatetimeIndex,
    panel_kw: float,
    battery_kwh: float,
    grid: GridModel,
    episode_days: int = 365,
    seed: int = 42,
) -> dict:
    """
    Run one full year of simulation for a single (panel_kw, battery_kwh)
    combination using the rule-based controller. Optimized for sizing sweeps.

    Parameters
    ----------
    load_kw : np.ndarray
        Household load time series (kW), 15-min resolution, 1 year+ long.
    solar_kw_per_kwp : np.ndarray
        Solar generation PER INSTALLED kWp (kW/kWp) — i.e. the output of
        a 1 kWp reference system. Scaled by `panel_kw` inside this function.
    timestamps : pd.DatetimeIndex
        Aligned to both series.
    panel_kw, battery_kwh : Candidate system size being evaluated.
    grid : GridModel
        Shared grid model (tariffs + outage calendar) for this household.
    episode_days : int
        Simulation length — use 365 for a full annual sizing evaluation
        (longer than the standard 30-day RL training episode).

    Returns
    -------
    dict with keys: panel_kw, battery_kwh, annual_grid_import_kwh,
    annual_grid_export_kwh, annual_unmet_load_kwh, annual_cost_inr,
    outage_steps_covered.
    """
    n_steps = min(int(episode_days * 96), len(load_kw), len(solar_kw_per_kwp), len(timestamps))
    dt = 0.25

    # Random start-index sampling mirroring EnergyEnv.reset(seed)
    max_start = len(load_kw) - n_steps - 1
    if max_start > 0:
        rng = np.random.default_rng(seed)
        start_idx = int(rng.integers(0, max_start + 1))
    else:
        start_idx = 0

    end_idx = start_idx + n_steps
    ld_arr = load_kw[start_idx:end_idx]
    sl_arr = (solar_kw_per_kwp * panel_kw)[start_idx:end_idx]
    ts_arr = timestamps[start_idx:end_idx]
    outage_arr = grid.get_outage_mask(ts_arr)

    net_metering_rate = grid.net_metering_rate
    unmet_penalty_rate = 15.0  # UNMET_LOAD_PENALTY_RATE_INR

    # ── FAST PATH: No battery ─────────────────────────────────────────
    if battery_kwh <= 0.01:
        direct = np.minimum(ld_arr, sl_arr)
        rem_ld = ld_arr - direct
        rem_sl = sl_arr - direct

        export_kwh = rem_sl * dt
        grid_import_kwh = np.where(~outage_arr, rem_ld * dt, 0.0)
        unmet_load_kwh = np.where(outage_arr, rem_ld * dt, 0.0)

        total_grid_import = float(np.sum(grid_import_kwh))
        total_grid_export = float(np.sum(export_kwh))
        total_unmet = float(np.sum(unmet_load_kwh))

        total_import_cost = 0.0
        cum_units = 0.0
        for imp in grid_import_kwh:
            if imp > 0.0:
                total_import_cost += imp * grid.marginal_rate(cum_units)
                cum_units += imp

        total_cost = total_import_cost - (total_grid_export * net_metering_rate) + (total_unmet * unmet_penalty_rate)

        scale = (365.0 / episode_days) if (episode_days and episode_days > 0 and episode_days != 365) else 1.0
        return {
            "panel_kw": panel_kw,
            "battery_kwh": battery_kwh,
            "annual_grid_import_kwh": total_grid_import * scale,
            "annual_grid_export_kwh": total_grid_export * scale,
            "annual_unmet_load_kwh": total_unmet * scale,
            "annual_cost_inr": total_cost * scale,
            "outage_steps_covered": 0,
        }

    # ── STREAMLINED PATH: With battery ───────────────────────────────
    capacity_kwh = max(battery_kwh, 0.01)
    max_charge_rate_kw = min(3.0, capacity_kwh)
    max_discharge_rate_kw = min(3.0, capacity_kwh)
    round_trip_efficiency = 0.90
    min_soc = 0.10
    max_soc = 0.95
    soc = 0.50
    eta_c = float(np.sqrt(round_trip_efficiency))
    eta_d = float(np.sqrt(round_trip_efficiency))

    total_grid_import = 0.0
    total_grid_export = 0.0
    total_unmet = 0.0
    total_cost = 0.0
    cum_units = 0.0
    outage_steps_covered = 0

    for t in range(n_steps):
        ld = float(ld_arr[t])
        sl = float(sl_arr[t])
        is_out = bool(outage_arr[t])

        direct = ld if ld < sl else sl
        rem_load = ld - direct
        rem_solar = sl - direct

        surplus = sl - ld

        if surplus > 1e-9:
            # Action 1: charge_from_solar
            if rem_solar > 0:
                kw = rem_solar if rem_solar < max_charge_rate_kw else max_charge_rate_kw
                headroom = (max_soc - soc) * capacity_kwh
                max_by_hr = headroom / (eta_c * dt + 1e-9)
                if kw > max_by_hr:
                    kw = max_by_hr
                if kw < 0.0:
                    kw = 0.0
                energy_stored = kw * eta_c * dt
                soc = soc + energy_stored / capacity_kwh
                if soc > max_soc:
                    soc = max_soc
                elif soc < min_soc:
                    soc = min_soc
                rem_solar -= kw

        elif surplus < -1e-9 and soc > min_soc + 1e-9:
            # Action 3: discharge_to_load
            if rem_load > 0:
                kw = rem_load if rem_load < max_discharge_rate_kw else max_discharge_rate_kw
                available = (soc - min_soc) * capacity_kwh
                max_by_av = available * eta_d / (dt + 1e-9)
                if kw > max_by_av:
                    kw = max_by_av
                if kw < 0.0:
                    kw = 0.0
                energy_from_bat = kw * dt / eta_d
                soc = soc - energy_from_bat / capacity_kwh
                if soc > max_soc:
                    soc = max_soc
                elif soc < min_soc:
                    soc = min_soc
                rem_load -= kw
                if is_out and rem_load <= 1e-6 and kw > 0:
                    outage_steps_covered += 1

        solar_export_kwh = rem_solar * dt
        if not is_out:
            grid_import_kwh = rem_load * dt
            unmet_kwh = 0.0
        else:
            grid_import_kwh = 0.0
            unmet_kwh = rem_load * dt

        if grid_import_kwh > 0:
            import_cost = grid_import_kwh * grid.marginal_rate(cum_units)
            cum_units += grid_import_kwh
        else:
            import_cost = 0.0

        export_credit = solar_export_kwh * net_metering_rate
        unmet_penalty = unmet_kwh * unmet_penalty_rate

        total_grid_import += grid_import_kwh
        total_grid_export += solar_export_kwh
        total_unmet += unmet_kwh
        total_cost += (import_cost - export_credit + unmet_penalty)

    scale = (365.0 / episode_days) if (episode_days and episode_days > 0 and episode_days != 365) else 1.0
    return {
        "panel_kw": panel_kw,
        "battery_kwh": battery_kwh,
        "annual_grid_import_kwh": total_grid_import * scale,
        "annual_grid_export_kwh": total_grid_export * scale,
        "annual_unmet_load_kwh": total_unmet * scale,
        "annual_cost_inr": total_cost * scale,
        "outage_steps_covered": int(round(outage_steps_covered * scale)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Multiprocessing worker
# ─────────────────────────────────────────────────────────────────────────────

def _score_one_combo(
    panel_kw: float,
    battery_kwh: float,
    load_kw: np.ndarray,
    solar_kw_per_kwp: np.ndarray,
    timestamps: pd.DatetimeIndex,
    grid: GridModel,
    baseline_annual_cost_inr: float,
    financial_config: dict,
    seed: int,
) -> dict:
    """
    Score exactly one (panel_kw, battery_kwh) combination end-to-end —
    simulation + financials. Kept as a plain MODULE-LEVEL function (not a
    closure/nested function) specifically so it can be pickled and
    dispatched to worker processes by ProcessPoolExecutor — the same
    constraint that shaped nsga2_sizing.py's picklable-class requirement
    for solar curve functions. All arguments here are plain data (numpy
    arrays, a DatetimeIndex, a GridModel, dicts, floats), which pickle
    fine on their own; only the *function itself* needed to not be a
    closure.
    """
    result = simulate_system_size(
        load_kw, solar_kw_per_kwp, timestamps,
        panel_kw=panel_kw, battery_kwh=battery_kwh, grid=grid,
        episode_days=365, seed=seed,
    )

    annual_savings_inr = baseline_annual_cost_inr - result["annual_cost_inr"]

    financials = full_financial_analysis(
        panel_kw=panel_kw, battery_kwh=battery_kwh,
        year1_savings_inr=max(annual_savings_inr, 0.0),
        config=financial_config,
    )

    return {
        "panel_kw": panel_kw,
        "battery_kwh": battery_kwh,
        "annual_grid_import_kwh": result["annual_grid_import_kwh"],
        "annual_grid_export_kwh": result["annual_grid_export_kwh"],
        "annual_unmet_load_kwh": result["annual_unmet_load_kwh"],
        "outage_steps_covered": result["outage_steps_covered"],
        "annual_savings_inr": round(annual_savings_inr, 2),
        "total_capex_inr": financials.total_capex_inr,
        "subsidy_amount_inr": financials.subsidy_amount_inr,
        "payback_years": financials.payback_years,
        "npv_25yr_inr": financials.npv_25yr_inr,
        "irr_pct": financials.irr_pct,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Full sweep
# ─────────────────────────────────────────────────────────────────────────────

def run_grid_search(
    load_kw: np.ndarray,
    solar_kw_per_kwp: np.ndarray,
    timestamps: pd.DatetimeIndex,
    grid: GridModel,
    panel_sizes_kw: list[float],
    battery_sizes_kwh: list[float],
    financial_config: dict,
    seed: int = 42,
    n_workers: Optional[int] = None,
) -> pd.DataFrame:
    """
    Sweep all (panel_kw, battery_kwh) combinations and return a scored
    DataFrame, one row per combination, including full financial metrics.

    Parameters
    ----------
    load_kw, solar_kw_per_kwp, timestamps : See `simulate_system_size`.
    grid : GridModel
    panel_sizes_kw, battery_sizes_kwh : Search grid (from config `sizing:` section).
    financial_config : dict
        The `sizing:` section of `default_config.yaml` (cost/subsidy/
        discount-rate parameters, forwarded to `full_financial_analysis`).
    n_workers : Optional[int]
        Number of worker PROCESSES to score combinations in parallel.
        - None (default): auto-detect via os.cpu_count(), capped at 8.
        - 1: disables parallelization — runs serially (easier debugging).
        - N: use exactly N worker processes.
        Each combination's year-long simulation is fully independent of
        every other's, so this gives close to linear speedup — the same
        pattern already used for NSGA-II (src/sizing/nsga2_sizing.py).

    Returns
    -------
    pd.DataFrame sorted by NPV descending, with columns:
        panel_kw, battery_kwh, annual_grid_import_kwh, annual_grid_export_kwh,
        annual_unmet_load_kwh, outage_steps_covered, annual_savings_inr,
        total_capex_inr, payback_years, npv_25yr_inr, irr_pct
    """
    if n_workers is None:
        n_workers = min(os.cpu_count() or 1, 8)

    combos = [(p, b) for p in panel_sizes_kw for b in battery_sizes_kwh]
    total = len(combos)
    logger.info(
        f"Running grid search: {len(panel_sizes_kw)} panel sizes × "
        f"{len(battery_sizes_kwh)} battery sizes = {total} combinations, "
        f"n_workers={n_workers}"
    )

    # ── Step 1: compute the no-solar, no-battery baseline once ────────────
    logger.info("  Computing no-solar baseline (panel=0, battery=0)...")
    baseline_result = simulate_system_size(
        load_kw, solar_kw_per_kwp, timestamps,
        panel_kw=0.0, battery_kwh=0.0, grid=grid,
        episode_days=365, seed=seed,
    )
    baseline_annual_import_kwh = baseline_result["annual_grid_import_kwh"]
    baseline_annual_cost_inr   = baseline_result["annual_cost_inr"]
    logger.info(
        f"  Baseline: {baseline_annual_import_kwh:.0f} kWh/year import, "
        f"₹{baseline_annual_cost_inr:,.0f}/year cost"
    )

    # ── Step 2: sweep all combinations ──────────────────────────────────────
    rows = []
    count = 0

    max_workers = min(os.cpu_count() or 1, 8) if n_workers is None else n_workers
    if max_workers > 1:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    _score_one_combo, panel_kw, battery_kwh,
                    load_kw, solar_kw_per_kwp, timestamps, grid,
                    baseline_annual_cost_inr, financial_config, seed,
                ): (panel_kw, battery_kwh)
                for panel_kw, battery_kwh in combos
            }
            for future in as_completed(futures):
                panel_kw, battery_kwh = futures[future]
                row = future.result()
                rows.append(row)
                count += 1
                logger.debug(
                    f"  [{count}/{total}] {panel_kw}kW + {battery_kwh}kWh → "
                    f"savings=₹{row['annual_savings_inr']:,.0f}/yr, "
                    f"payback={row['payback_years']:.1f}yr, "
                    f"NPV25=₹{row['npv_25yr_inr']:,.0f}"
                )
    else:
        for panel_kw, battery_kwh in combos:
            count += 1
            row = _score_one_combo(
                panel_kw, battery_kwh, load_kw, solar_kw_per_kwp, timestamps,
                grid, baseline_annual_cost_inr, financial_config, seed,
            )
            rows.append(row)
            logger.debug(
                f"  [{count}/{total}] {panel_kw}kW + {battery_kwh}kWh → "
                f"savings=₹{row['annual_savings_inr']:,.0f}/yr, "
                f"payback={row['payback_years']:.1f}yr, "
                f"NPV25=₹{row['npv_25yr_inr']:,.0f}"
            )

    df = pd.DataFrame(rows).sort_values("npv_25yr_inr", ascending=False).reset_index(drop=True)
    logger.success(f"Grid search complete: {len(df)} combinations scored")
    return df


def top_recommendations(df: pd.DataFrame, n: int = 3) -> dict:
    """
    Extract top candidates by three different priorities, since there's
    no single "optimal" answer — a customer might prioritize any of these.

    Works with BOTH grid_search's output schema (has outage_steps_covered)
    AND nsga2_sizing's output schema (has annual_unmet_load_kwh only) —
    the NSGA-II Pareto front never had an outage_steps_covered column,
    so calling this with "thorough" depth's DataFrame previously raised
    KeyError: 'outage_steps_covered'.

    Returns
    -------
    dict with keys 'fastest_payback', 'best_npv', 'best_backup', each a
    pd.DataFrame of the top `n` rows for that criterion.
    """
    # Exclude systems that never pay back (inf) from the payback ranking, but fall back gracefully
    payback_candidates = df[np.isfinite(df["payback_years"])]
    if len(payback_candidates) == 0:
        payback_candidates = df

    if "annual_unmet_load_kwh" in df.columns:
        # Lower unmet load = better backup coverage. Present in both
        # grid_search's and nsga2_sizing's output — the reliable choice.
        best_backup = df.nsmallest(n, "annual_unmet_load_kwh")
    elif "outage_steps_covered" in df.columns:
        # Fallback for any caller whose DataFrame only has this older
        # grid_search-specific column (higher = better here).
        best_backup = df.nlargest(n, "outage_steps_covered")
    else:
        raise KeyError(
            "top_recommendations(): DataFrame has neither "
            "'annual_unmet_load_kwh' nor 'outage_steps_covered' — "
            "cannot determine a backup-coverage ranking."
        )

    return {
        "fastest_payback": payback_candidates.nsmallest(n, "payback_years"),
        "best_npv":         df.nlargest(n, "npv_25yr_inr"),
        "best_backup":      best_backup,
    }