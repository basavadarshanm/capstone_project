from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.environment.energy_env import EnergyEnv
from src.grid.grid_model import GridModel


@pytest.fixture
def battery_config() -> dict:
    return {
        "capacity_kwh": 10.0,
        "max_charge_rate_kw": 3.0,
        "max_discharge_rate_kw": 3.0,
        "round_trip_efficiency": 0.90,
        "min_soc": 0.10,
        "max_soc": 0.95,
        "initial_soc": 0.50,
    }


@pytest.fixture
def household_series() -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]:
    """A deterministic three-day series with both surplus and deficit steps."""
    timestamps = pd.date_range("2025-01-01", periods=3 * 96, freq="15min")
    hours = (timestamps.hour + timestamps.minute / 60).to_numpy()
    load_kw = (
        0.35
        + 0.35 * np.exp(-((hours - 8) ** 2) / 4)
        + 0.55 * np.exp(-((hours - 19) ** 2) / 4)
    ).astype(np.float32)
    solar_kw = np.where(
        (hours >= 6) & (hours <= 18),
        3.0 * np.exp(-((hours - 12) ** 2) / 8),
        0.0,
    ).astype(np.float32)
    return load_kw, solar_kw, timestamps


@pytest.fixture
def available_grid() -> GridModel:
    lookup = pd.Series(
        False,
        index=pd.date_range("2025-01-01", periods=3 * 96, freq="15min"),
        dtype=bool,
    )
    return GridModel(outage_lookup=lookup)


@pytest.fixture
def environment(household_series, battery_config, available_grid) -> EnergyEnv:
    load_kw, solar_kw, timestamps = household_series
    return EnergyEnv(
        load_kw=load_kw,
        solar_kw=solar_kw,
        timestamps=timestamps,
        battery_config=battery_config,
        grid=available_grid,
        episode_days=1,
        seed=42,
    )
