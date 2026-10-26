from __future__ import annotations

import pandas as pd
import pytest

from src.grid.grid_model import GridModel


def test_marginal_rate_changes_at_tariff_boundaries():
    grid = GridModel()

    assert grid.marginal_rate(0) == pytest.approx(3.35)
    assert grid.marginal_rate(100) == pytest.approx(3.85)
    assert grid.marginal_rate(150) == pytest.approx(5.00)
    assert grid.marginal_rate(500) == pytest.approx(6.00)


def test_monthly_bill_matches_slab_arithmetic():
    grid = GridModel()

    bill = grid.bill_for_month(310)
    expected_energy = 100 * 3.35 + 50 * 3.85 + 150 * 5.00 + 10 * 5.50

    assert bill["energy_charge_inr"] == pytest.approx(expected_energy)
    assert bill["total_bill_inr"] == pytest.approx(expected_energy + 125.0)


def test_outage_lookup_and_fallback_are_deterministic():
    timestamp = pd.Timestamp("2025-01-01 10:00")
    lookup = pd.Series([True], index=pd.DatetimeIndex([timestamp]))
    measured_grid = GridModel(outage_lookup=lookup)
    fallback_grid = GridModel(fallback_outage_hours_per_day=4.0)

    assert measured_grid.is_outage(timestamp) is True
    assert fallback_grid.is_outage(timestamp) == fallback_grid.is_outage(timestamp)


def test_invalid_tariff_configuration_is_rejected():
    with pytest.raises(AssertionError):
        GridModel(
            tariff_slabs=[
                # The last slab must be unbounded.
                type("Slab", (), {"units_upto": 100.0, "rate": 3.0})(),
            ]
        )
