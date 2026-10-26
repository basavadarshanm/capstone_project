from __future__ import annotations

import pytest

from src.battery.battery_model import BatteryModel


def test_charge_respects_rate_limit_and_increases_soc():
    battery = BatteryModel(initial_soc=0.50, max_charge_rate_kw=2.0)

    step = battery.step(charge_kw=5.0, dt_hours=0.25)

    assert step.actual_charge_kw == pytest.approx(2.0)
    assert step.charge_curtailed_kw == pytest.approx(3.0)
    assert step.soc_after > step.soc_before
    assert battery.soc <= battery.max_soc


def test_discharge_respects_soc_floor_and_reports_unmet_request():
    battery = BatteryModel(
        capacity_kwh=10.0,
        max_discharge_rate_kw=10.0,
        min_soc=0.10,
        initial_soc=0.12,
    )

    step = battery.step(discharge_kw=10.0, dt_hours=0.25)

    assert battery.soc == pytest.approx(battery.min_soc)
    assert step.actual_discharge_kw < 10.0
    assert step.discharge_unmet_kw > 0


def test_round_trip_efficiency_loses_energy():
    battery = BatteryModel(initial_soc=0.50, round_trip_efficiency=0.90)

    charge = battery.step(charge_kw=2.0, dt_hours=0.25)
    discharge = battery.step(discharge_kw=charge.actual_charge_kw, dt_hours=0.25)

    assert discharge.energy_from_battery_kwh > discharge.actual_discharge_kw * 0.25
    assert battery.soc < battery.initial_soc
    assert battery.total_cycles > 0


def test_simultaneous_charge_and_discharge_is_safe():
    battery = BatteryModel(initial_soc=0.50)

    step = battery.step(charge_kw=1.0, discharge_kw=1.0)

    assert step.is_charging
    assert not step.is_discharging
