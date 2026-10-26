from __future__ import annotations

import pandas as pd
import pytest

from src.environment.energy_env import EnergyEnv
from src.grid.grid_model import GridModel


def test_reset_and_step_follow_gymnasium_contract(environment):
    observation, info = environment.reset(seed=7)

    assert environment.observation_space.contains(observation)
    assert isinstance(info, dict)

    next_observation, reward, terminated, truncated, step_info = environment.step(0)

    assert environment.observation_space.contains(next_observation)
    assert isinstance(reward, float)
    assert terminated is False
    assert truncated is False
    assert "grid_import_kwh" in step_info


def test_energy_flows_balance_for_every_action(environment):
    environment.reset(seed=7)

    for action in range(4):
        environment.reset(seed=7)
        _, _, _, _, flows = environment.step(action)

        served_load = (
            flows["solar_to_load_kwh"]
            + flows["battery_to_load_kwh"]
            + flows["grid_to_load_kwh"]
            + flows["unmet_load_kwh"]
        )
        available_solar = (
            flows["solar_to_load_kwh"]
            + flows["solar_to_battery_kwh"]
            + flows["solar_exported_kwh"]
        )
        assert served_load == pytest.approx(
            float(environment.load_kw[environment._start_idx]) * environment.dt_hours,
            abs=1e-6,
        )
        solar_input = float(environment.solar_kw[environment._start_idx]) * environment.dt_hours
        assert available_solar <= solar_input + 1e-6


def test_outage_blocks_grid_import_and_export(household_series, battery_config):
    load_kw, solar_kw, timestamps = household_series
    outage_grid = GridModel(
        outage_lookup=pd.Series(True, index=timestamps, dtype=bool)
    )

    env = EnergyEnv(
        load_kw=load_kw,
        solar_kw=solar_kw,
        timestamps=timestamps,
        battery_config=battery_config,
        grid=outage_grid,
        episode_days=1,
        seed=42,
    )
    env.reset(seed=42)
    _, _, _, _, info = env.step(2)

    assert info["grid_import_kwh"] == pytest.approx(0.0)
    assert info["grid_export_kwh"] == pytest.approx(0.0)


def test_full_episode_has_expected_length(environment):
    observation, _ = environment.reset(seed=42)
    steps = 0
    terminated = truncated = False

    while not (terminated or truncated):
        observation, _, terminated, truncated, _ = environment.step(0)
        steps += 1

    assert steps == environment.episode_steps
    assert environment.observation_space.contains(observation)
