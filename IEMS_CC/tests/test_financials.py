from __future__ import annotations

import numpy as np
import pytest

from src.report.financials import (
    capex,
    irr,
    npv,
    payback_period,
    project_annual_savings,
)


def test_subsidy_is_tiered_and_excludes_battery():
    result = capex(panel_kw=3.0, battery_kwh=5.0)

    expected_subsidy = 2.0 * 45000 * 0.40 + 1.0 * 45000 * 0.20
    assert result["subsidy_amount"] == pytest.approx(expected_subsidy)
    assert result["battery_cost"] == pytest.approx(75000)
    assert result["total_capex"] == pytest.approx(
        3 * 45000 - expected_subsidy + 75000 + 10000
    )


def test_projected_savings_has_requested_lifetime_and_maintenance():
    savings = project_annual_savings(
        year1_savings_inr=10000,
        years=5,
        maintenance_cost_annual_inr=2000,
    )

    assert len(savings) == 5
    assert savings[0] == pytest.approx(10000 * 1.05 * 0.995 - 2000)


def test_npv_and_irr_have_expected_sign_and_value():
    annual_savings = np.array([60.0, 60.0])

    assert npv(annual_savings, initial_capex=100.0, discount_rate=0.0) == pytest.approx(20.0)
    assert irr(np.array([-100.0, 60.0, 60.0])) == pytest.approx(0.130662, abs=1e-5)


def test_payback_supports_fractional_years_and_unpaid_systems():
    assert payback_period(150.0, np.array([100.0, 100.0])) == pytest.approx(1.5)
    assert payback_period(300.0, np.array([100.0, 100.0])) == float("inf")
