# IEMS Testing Guide

## 1. Purpose

This document describes the testing strategy implemented in the IEMS project.
It explains:

- What is tested by the automated pytest suite
- What is tested by the executable validation scripts
- Which tests are unit, integration, API, acceptance, performance, or
  demonstration tests
- How to execute each test
- What evidence each test produces
- Why some tests are fast and others are intentionally expensive

The project uses two complementary testing layers:

```text
Fast automated tests
    pytest tests/

Long-running acceptance and experiment scripts
    python scripts/<script_name>.py
```

The fast tests verify reusable code components and contracts. The scripts
exercise complete pipelines and research experiments using larger datasets,
longer simulations, optimization, or machine-learning training.

---

## 2. Test directory structure

```text
pytest.ini
tests/
├── __init__.py
├── conftest.py
├── test_api.py
├── test_battery.py
├── test_controllers.py
├── test_environment.py
├── test_financials.py
└── test_grid.py

scripts/
├── 01_data_pipeline.py
├── 02_solar_pipeline.py
├── 03_battery_grid_check.py
├── 04_environment_check.py
├── 05_rule_based_check.py
├── 06_sizing_pipeline.py
├── 07_train_dqn.py
├── 08_mpc_check.py
├── 09_compare_controllers.py
├── 10_nsga2_sizing.py
├── 11_validate_sizing.py
└── 12_live_deployment_demo.py
```

---

## 3. Test classification

| Test type | Main location | Purpose |
|---|---|---|
| Unit testing | `tests/test_battery.py`, `tests/test_grid.py`, `tests/test_financials.py` | Verify individual functions and classes |
| Integration testing | `tests/test_environment.py`, `tests/test_controllers.py` | Verify multiple IEMS components working together |
| API contract testing | `tests/test_api.py` | Verify HTTP responses, validation, and JSON contracts |
| Smoke testing | Scripts 01, 02, 07, and 10 in reduced mode | Confirm that a pipeline is wired correctly |
| System testing | Scripts 04, 05, 08, 09, and 11 | Exercise complete simulation and controller workflows |
| Optimization testing | Scripts 06, 10, and 11 | Verify sizing, financial objectives, Pareto solutions, and ranking |
| Performance testing | Scripts 08, 09, and documented runtime measurements | Measure controller and optimizer execution time |
| End-to-end demonstration | Script 12 and the FastAPI application | Demonstrate a deployment-like year-long workflow |

---

# 4. Pytest suite

## 4.1 Running the pytest suite

Run all fast tests from the project root:

```bash
pytest -q
```

Equivalent command using the project virtual environment:

```bash
venv/bin/python -m pytest -q
```

Run one test file:

```bash
pytest -q tests/test_battery.py
pytest -q tests/test_environment.py
pytest -q tests/test_api.py
```

Run one test by name:

```bash
pytest -q tests/test_grid.py::test_monthly_bill_matches_slab_arithmetic
```

Run with source coverage:

```bash
pytest --cov=src --cov-report=term-missing -q
```

Generate an HTML coverage report:

```bash
pytest --cov=src --cov-report=html
```

The HTML report is written to `htmlcov/index.html`.

The pytest suite is designed to be:

- Fast enough to run after every code change
- Deterministic
- Independent of NASA network access
- Independent of raw CSV files
- Independent of full DQN training
- Independent of large NSGA-II searches

---

## 4.2 Shared fixtures: `tests/conftest.py`

[tests/conftest.py](./tests/conftest.py) contains reusable pytest fixtures.

### `battery_config`

Provides a standard battery configuration:

```text
capacity: 10 kWh
maximum charge rate: 3 kW
maximum discharge rate: 3 kW
round-trip efficiency: 90%
minimum SOC: 10%
maximum SOC: 95%
initial SOC: 50%
```

Using one shared configuration ensures that battery and environment tests
use consistent assumptions.

### `household_series`

Creates a deterministic three-day, 15-minute household profile with:

- Morning demand peak
- Evening demand peak
- Daytime solar generation
- Night-time zero solar generation

The series is generated in memory, so the tests do not depend on external
files.

### `available_grid`

Creates a grid with a timestamped outage lookup where all test timestamps are
available. This makes normal environment tests independent of the statistical
outage fallback.

### `environment`

Creates a one-day `EnergyEnv` using the shared household, battery, and grid
fixtures. A one-day environment has 96 fifteen-minute steps, making the test
suite fast.

---

## 4.3 Battery tests: `tests/test_battery.py`

[tests/test_battery.py](./tests/test_battery.py) tests
[BatteryModel](./src/battery/battery_model.py).

### Test: charge rate and SOC increase

```text
test_charge_respects_rate_limit_and_increases_soc
```

Input:

```text
Requested charging power: 5 kW
Maximum battery charging power: 2 kW
Initial SOC: 50%
```

Expected behavior:

- Actual charging is limited to 2 kW.
- 3 kW is reported as curtailed.
- SOC increases.
- SOC does not exceed the maximum SOC.

This detects failures in the battery power-rate limiter.

### Test: discharge floor and unmet demand

```text
test_discharge_respects_soc_floor_and_reports_unmet_request
```

Input:

```text
Initial SOC: 12%
Minimum SOC: 10%
Requested discharge: 10 kW
```

Expected behavior:

- The battery discharges only the available energy above 10% SOC.
- SOC finishes at the minimum limit.
- The entire requested discharge is not accepted.
- The unserved discharge request is reported.

This protects the battery from deep discharge.

### Test: round-trip efficiency

```text
test_round_trip_efficiency_loses_energy
```

The test charges and discharges the battery and verifies that the internal
energy drawn from the battery is greater than the energy delivered to the
load. It also checks that battery cycle count increases.

This verifies the intended 90% round-trip efficiency behavior.

### Test: simultaneous charge and discharge

```text
test_simultaneous_charge_and_discharge_is_safe
```

The battery receives both charge and discharge requests. The model must
prioritize charging and must not report simultaneous charging and discharging.

This protects the model from physically invalid states.

---

## 4.4 Grid tests: `tests/test_grid.py`

[tests/test_grid.py](./tests/test_grid.py) tests
[GridModel](./src/grid/grid_model.py).

### Test: tariff slab boundaries

```text
test_marginal_rate_changes_at_tariff_boundaries
```

The test checks the marginal tariff at:

```text
0 kWh   -> ₹3.35/kWh
100 kWh -> ₹3.85/kWh
150 kWh -> ₹5.00/kWh
500 kWh -> ₹6.00/kWh
```

This verifies that the next imported unit is charged using the correct slab.

### Test: monthly bill

```text
test_monthly_bill_matches_slab_arithmetic
```

For 310 kWh, the test independently calculates:

```text
100 kWh × ₹3.35
 50 kWh × ₹3.85
150 kWh × ₹5.00
 10 kWh × ₹5.50
+ fixed monthly charge
```

The result is compared with `GridModel.bill_for_month()`.

This is important because the financial reports depend on accurate billing.

### Test: outage lookup and deterministic fallback

```text
test_outage_lookup_and_fallback_are_deterministic
```

The test verifies:

- A measured outage lookup returns `True` for an outage timestamp.
- The statistical fallback returns the same result when queried repeatedly
  for the same timestamp.

Determinism is required for reproducible simulation experiments.

### Test: invalid tariff configuration

```text
test_invalid_tariff_configuration_is_rejected
```

The test creates a tariff configuration without an infinite final slab and
expects an assertion failure.

This prevents a tariff model from silently failing for consumption above the
last configured boundary.

---

## 4.5 Environment tests: `tests/test_environment.py`

[tests/test_environment.py](./tests/test_environment.py) tests the integrated
[EnergyEnv](./src/environment/energy_env.py).

### Test: Gymnasium reset and step contract

```text
test_reset_and_step_follow_gymnasium_contract
```

The test checks that:

- `reset()` returns an observation and info dictionary.
- The observation is inside `observation_space`.
- `step()` returns five values.
- The reward is numeric.
- The environment does not terminate unexpectedly after one step.
- Flow information is present in the returned info dictionary.

This is required for compatibility with Stable-Baselines3 and other
Gymnasium-compatible tools.

### Test: energy-flow balance

```text
test_energy_flows_balance_for_every_action
```

The test runs all four actions:

```text
0 = idle
1 = charge from solar
2 = charge from grid
3 = discharge to load
```

For each action it verifies that the household load is accounted for by:

```text
solar-to-load
+ battery-to-load
+ grid-to-load
+ unmet load
```

It also verifies that solar allocation does not exceed available solar input.

This is a core physical consistency test.

### Test: outage restrictions

```text
test_outage_blocks_grid_import_and_export
```

All timestamps are configured as outages. The test selects grid charging and
verifies that:

- Grid import is zero.
- Grid export is zero.

This confirms that the environment respects grid unavailability.

### Test: episode length

```text
test_full_episode_has_expected_length
```

The test runs the complete one-day environment and verifies that exactly 96
steps are executed.

This checks the 15-minute time resolution and episode truncation behavior.

---

## 4.6 Controller tests: `tests/test_controllers.py`

[tests/test_controllers.py](./tests/test_controllers.py) tests
[RuleBasedController](./src/controllers/rule_based.py).

### Test: solar surplus

```text
test_rule_controller_charges_when_solar_is_surplus
```

When solar generation is greater than the household load, the controller must
select action 1: charge from solar.

### Test: solar deficit

```text
test_rule_controller_discharges_when_load_exceeds_solar
```

When household load exceeds solar generation and the battery has usable
energy, the controller must select action 3: discharge to load.

### Test: no grid charging

```text
test_rule_controller_never_selects_grid_charging
```

The controller is intentionally a simple baseline. It must not select action
2, which represents charging the battery from the grid.

These tests verify decision logic. They do not claim that the rule-based
controller is globally optimal. Long-term performance is tested by
`scripts/05_rule_based_check.py` and `scripts/09_compare_controllers.py`.

---

## 4.7 Financial tests: `tests/test_financials.py`

[tests/test_financials.py](./tests/test_financials.py) tests the pure financial
functions in [src/report/financials.py](./src/report/financials.py).

### Test: tiered subsidy and battery exclusion

```text
test_subsidy_is_tiered_and_excludes_battery
```

For a 3 kWp solar system:

```text
First 2 kWp: 40% subsidy
Next 1 kWp: 20% subsidy
Battery: no subsidy
Balance of system: no subsidy
```

The test verifies both the subsidy amount and total CAPEX.

### Test: savings projection

```text
test_projected_savings_has_requested_lifetime_and_maintenance
```

The test verifies:

- The output contains the requested number of years.
- Tariff inflation is applied.
- Panel degradation is applied.
- Annual maintenance is deducted.

### Test: NPV and IRR

```text
test_npv_and_irr_have_expected_sign_and_value
```

Small manually verifiable cash flows are used to verify:

- NPV calculation.
- Newton-Raphson IRR calculation.

### Test: payback

```text
test_payback_supports_fractional_years_and_unpaid_systems
```

The test verifies:

- Fractional payback, such as 1.5 years.
- Infinite payback when the investment is not recovered within the
  projection period.

---

## 4.8 API tests: `tests/test_api.py`

[tests/test_api.py](./tests/test_api.py) uses FastAPI's `TestClient` to test
[app.py](./app.py) without starting an external web server.

### Test: health endpoint

```text
test_health_endpoint
```

Expected response:

```http
GET /api/health
HTTP 200
```

```json
{"status": "ok"}
```

### Test: lead submission and listing

```text
test_lead_submission_and_listing
```

The test:

1. Submits a valid customer lead.
2. Verifies a successful response.
3. Requests the lead list.
4. Verifies the lead is present.

The in-memory lead store is reset for each test so tests do not affect one
another.

### Test: request validation

```text
test_lead_validation_rejects_missing_required_fields
```

An incomplete request is submitted and the API must return HTTP 422.

This verifies Pydantic request validation.

---

## 4.9 Current pytest result

The implemented fast suite currently contains 22 tests.

Expected result:

```text
22 passed
```

Coverage can be run with:

```bash
pytest --cov=src --cov-report=term-missing -q
```

The total source coverage is currently approximately 34%. This is expected
because the source tree contains expensive or external modules that are not
run by the fast suite, including:

- DQN training
- Full MPC optimization
- NASA POWER requests
- Full NSGA-II optimization
- Pipeline orchestration
- Full data ingestion

Coverage should be improved incrementally by adding isolated tests and mocks,
not by forcing expensive external workflows into every pytest run.

---

# 5. Executable validation and acceptance scripts

The scripts are run explicitly because they perform longer simulations,
network access, machine-learning training, optimization, or complete
end-to-end workflows.

## 5.1 Script execution order

The recommended order is:

```text
01_data_pipeline.py
        |
        v
02_solar_pipeline.py
        |
        v
03_battery_grid_check.py
        |
        v
04_environment_check.py
        |
        v
05_rule_based_check.py
        |
        v
06_sizing_pipeline.py
        |
        +--> 07_train_dqn.py
        |
        +--> 08_mpc_check.py
        |
        +--> 09_compare_controllers.py
        |
        +--> 10_nsga2_sizing.py
                    |
                    v
              11_validate_sizing.py
                    |
                    v
              12_live_deployment_demo.py
```

Some scripts can run independently with synthetic data. Real-data execution
requires the outputs of the earlier data and solar pipelines.

---

## 5.2 Script 01: data pipeline

File:

[scripts/01_data_pipeline.py](./scripts/01_data_pipeline.py)

Command:

```bash
python scripts/01_data_pipeline.py
```

Purpose:

1. Load raw CEEW smart-meter data.
2. Validate physical values.
3. Derive power values.
4. Resample three-minute data to 15-minute data.
5. Detect outages.
6. Add time features.
7. Extract load-profile archetypes.
8. Train K-Means clustering.
9. Generate a sample profile as a smoke test.

Expected outputs:

```text
data/processed/meters_15min.parquet
data/processed/daily_summary.parquet
models/load_profiles.parquet
models/profile_kmeans.pkl
```

Testing category:

```text
Data-pipeline smoke test and preprocessing validation
```

Important limitation:

This script requires the raw smart-meter CSV files and can take several
minutes. It is not part of the default pytest run.

---

## 5.3 Script 02: solar pipeline

File:

[scripts/02_solar_pipeline.py](./scripts/02_solar_pipeline.py)

Command:

```bash
python scripts/02_solar_pipeline.py
```

Purpose:

1. Fetch NASA POWER weather data.
2. Cache yearly weather data.
3. Simulate PV output using pvlib.
4. Convert output to 15-minute resolution.
5. Save city-specific solar data.
6. Print monthly yield and capacity factor.

Expected outputs:

```text
data/solar/Mathura_solar_15min.parquet
data/solar/Bareilly_solar_15min.parquet
```

The script performs a domain sanity check on the capacity factor. It warns if
the result falls outside the expected rooftop-PV range.

Testing category:

```text
External-data integration, solar-model smoke test, and domain validation
```

Important limitation:

The first run requires network access to NASA POWER. Cached data should be
used for repeatable offline execution.

---

## 5.4 Script 03: battery and grid check

File:

[scripts/03_battery_grid_check.py](./scripts/03_battery_grid_check.py)

Command:

```bash
python scripts/03_battery_grid_check.py
```

Battery checks:

- Charging behavior
- Discharging behavior
- Charge-rate limit
- Discharge-rate limit
- Maximum SOC
- Minimum SOC
- Round-trip efficiency
- Cycle tracking

Grid checks:

- Marginal tariff at slab boundaries
- Full monthly bill
- Fixed charge
- Measured outage lookup
- Deterministic fallback outage behavior
- Approximate fallback outage rate

Testing category:

```text
Component acceptance test
```

Relationship to pytest:

This script tests similar core behavior to `test_battery.py` and
`test_grid.py`, but it is a larger, logging-oriented validation procedure.
The pytest tests are the fast regression checks; this script is the manual
acceptance command for the same model layer.

---

## 5.5 Script 04: environment check

File:

[scripts/04_environment_check.py](./scripts/04_environment_check.py)

Command:

```bash
python scripts/04_environment_check.py
```

Purpose:

- Run longer synthetic episodes.
- Verify observations remain valid.
- Verify the expected number of steps.
- Test all actions.
- Check energy conservation.
- Check idle behavior.
- Check outage restrictions.
- Check reward signs.
- Compare accumulated step rewards with monthly slab billing.

Testing category:

```text
Environment integration and physics consistency acceptance test
```

Relationship to pytest:

`tests/test_environment.py` performs small deterministic checks on the same
contracts. This script exercises the environment for longer episodes and
provides detailed log output.

---

## 5.6 Script 05: rule-based controller check

File:

[scripts/05_rule_based_check.py](./scripts/05_rule_based_check.py)

Command:

```bash
python scripts/05_rule_based_check.py
```

The controller is compared with:

```text
Random actions
Always idle
Rule-Based controller
```

Metrics:

- Total reward
- Total cost
- Grid import
- Grid export
- Unmet load
- Final battery SOC

Acceptance conditions:

```text
Rule-Based reward > Random reward
Rule-Based reward > Always-idle reward
```

Testing category:

```text
Baseline comparison and controller system test
```

Important distinction:

The pytest controller tests check individual decisions. This script checks
long-term behavior over a complete episode.

---

## 5.7 Script 06: sizing pipeline

File:

[scripts/06_sizing_pipeline.py](./scripts/06_sizing_pipeline.py)

Command:

```bash
python scripts/06_sizing_pipeline.py
```

The script runs a grid search over panel and battery combinations.

It validates:

- Expected number of search results
- Positive CAPEX
- Larger systems have higher CAPEX
- Annual savings
- Payback
- 25-year NPV
- IRR
- Annual unmet load
- Three recommendation categories

Recommendation categories:

```text
Fastest payback
Best 25-year NPV
Best outage backup
```

Testing category:

```text
Sizing and financial integration acceptance test
```

---

## 5.8 Script 07: DQN training and evaluation

File:

[scripts/07_train_dqn.py](./scripts/07_train_dqn.py)

Quick smoke test:

```bash
python scripts/07_train_dqn.py
```

Full training:

```bash
python scripts/07_train_dqn.py --full
```

Quick mode:

- Uses approximately 5,000 training steps.
- Verifies environment construction.
- Trains a model.
- Saves the model.
- Loads the model.
- Runs inference.
- Evaluates on a held-out household.

Full mode:

- Uses approximately 500,000 training steps.
- Trains on multiple synthetic households.
- Evaluates generalization to a held-out household.

Expected model output:

```text
models/dqn_policy.zip
```

Testing category:

```text
Machine-learning smoke test and model evaluation
```

Important limitation:

Quick mode only verifies wiring. It is not evidence that the policy is
well-trained.

---

## 5.9 Script 08: MPC check

File:

[scripts/08_mpc_check.py](./scripts/08_mpc_check.py)

Command:

```bash
python scripts/08_mpc_check.py
```

The script runs:

- Rule-Based control
- MPC control

on the same household, solar profile, battery, grid, and episode.

Metrics:

- Reward
- Grid import
- Grid export
- Unmet load
- Total runtime
- Runtime per simulation step

Testing category:

```text
Optimization-controller acceptance and performance test
```

Important limitation:

MPC solves an optimization problem at every step, so this is deliberately not
part of the fast pytest suite.

---

## 5.10 Script 09: three-controller comparison

File:

[scripts/09_compare_controllers.py](./scripts/09_compare_controllers.py)

Command:

```bash
python scripts/09_compare_controllers.py
```

Controllers:

```text
Rule-Based
DQN
MPC
```

Fairness controls:

- Same held-out household
- Same seed
- Same battery specification
- Same solar generation
- Same grid model
- Same episode length

Metrics:

- Total reward
- Total cost
- Grid import
- Grid export
- Unmet load
- Final SOC
- Battery cycles
- Runtime

Output:

```text
outputs/controller_comparison.json
```

Testing category:

```text
Comparative system experiment and regression benchmark
```

---

## 5.11 Script 10: NSGA-II sizing

File:

[scripts/10_nsga2_sizing.py](./scripts/10_nsga2_sizing.py)

Quick smoke test:

```bash
python scripts/10_nsga2_sizing.py
```

Full search:

```bash
python scripts/10_nsga2_sizing.py --full
```

Decision variables:

```text
Panel capacity
Battery capacity
Panel tilt
Panel azimuth
```

Objectives:

```text
Minimize CAPEX
Maximize NPV
Minimize payback
Minimize unmet load
```

Algorithm features:

- Non-dominated sorting
- Crowding distance
- SBX crossover
- Polynomial mutation
- Pareto-front output
- Optional multiprocessing

Testing category:

```text
Optimization acceptance test and research experiment
```

Important limitation:

The full run may evaluate thousands of candidates and is not appropriate for
every commit or normal pytest execution.

---

## 5.12 Script 11: sizing candidate validation

File:

[scripts/11_validate_sizing.py](./scripts/11_validate_sizing.py)

Command:

```bash
python scripts/11_validate_sizing.py
```

Purpose:

1. Select representative sizing candidates.
2. Re-simulate candidates under Rule-Based, MPC, and DQN control.
3. Compare controller rankings.
4. Detect ranking disagreement.
5. Select a final recommendation.
6. Assign a confidence level.

Output:

```text
outputs/candidate_validation_recommendation.json
```

Testing category:

```text
Cross-controller validation and recommendation stability test
```

---

## 5.13 Script 12: live deployment demonstration

File:

[scripts/12_live_deployment_demo.py](./scripts/12_live_deployment_demo.py)

Example:

```bash
python scripts/12_live_deployment_demo.py --city Mathura --bill 2400
```

Optional arguments:

```text
--city Mathura or Bareilly
--bill monthly bill in INR
--panel-kw installed panel capacity
--battery-kwh battery capacity
```

Purpose:

- Load real cached solar data where available.
- Load or generate a household profile.
- Replay a year chronologically.
- Process the simulation in daily streaming units.
- Record daily cost.
- Measure grid import and export.
- Measure unmet load.
- Demonstrate MPC operation with historical forecasts.

Testing category:

```text
End-to-end deployment-like demonstration
```

Important distinction:

This is not the same experiment as the fairness-controlled controller
comparison. It demonstrates realistic deployment mechanics using historical
data and may use accurate historical forecasts.

---

# 6. API and UI manual tests

Start the application:

```bash
uvicorn app:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/health
```

Expected:

```json
{"status": "ok"}
```

Useful browser pages:

```text
http://localhost:8000/
http://localhost:8000/pipeline
http://localhost:8000/contractor
http://localhost:8000/ga-explainer
http://localhost:8000/docs
```

Manual UI checks should include:

- Page loads successfully.
- City selection changes the displayed location.
- Bill and budget inputs accept valid values.
- Invalid values are rejected or handled safely.
- Sizing results display.
- Financial values are shown.
- Installer lead form submits successfully.
- Submitted lead appears in the lead listing.
- Pipeline status changes are visible.
- GA explainer loads generation information.

The API contract tests in `tests/test_api.py` automate the health and lead
request checks. Browser visual behavior still requires manual or browser
automation testing.

---

# 7. Recommended CI workflow

A continuous-integration job should run the fast suite on every change:

```bash
python -m pip install -r requirements.txt
pytest -q
```

A scheduled or manual acceptance job can run:

```bash
python scripts/03_battery_grid_check.py
python scripts/04_environment_check.py
python scripts/05_rule_based_check.py
python scripts/06_sizing_pipeline.py
python scripts/07_train_dqn.py
python scripts/08_mpc_check.py
python scripts/09_compare_controllers.py
python scripts/10_nsga2_sizing.py
python scripts/11_validate_sizing.py
```

The NASA data pipeline should be run in an environment with network access,
preferably with cached weather data:

```bash
python scripts/01_data_pipeline.py
python scripts/02_solar_pipeline.py
```

---

# 8. Why the project has two testing layers

The pytest tests and executable scripts answer different questions.

## Pytest question

> Does this function, model, controller decision, API endpoint, or small
> integration behave correctly for known inputs?

Properties:

- Fast
- Deterministic
- Repeatable
- Suitable for every code change
- Suitable for CI

## Script question

> Does the complete IEMS workflow behave plausibly under a realistic,
> long-running, data-driven, optimization, or machine-learning experiment?

Properties:

- Slower
- May require large data
- May require network access
- May require significant CPU time
- May produce research artifacts
- Run during acceptance, release, or experiment phases

Both layers are necessary. Unit tests alone cannot prove that the complete
controller comparison or sizing experiment works. Full experiments alone are
too slow and too broad to diagnose small regressions efficiently.

---

# 9. Current limitations and future improvements

The current test implementation is a strong starting point, but the
following improvements are recommended:

1. Add unit tests for the data preprocessing pipeline.
2. Add mocked tests for NASA POWER API failures and retries.
3. Add isolated tests for the PV model using known weather inputs.
4. Add tests for grid-search result ranking.
5. Add a reduced NSGA-II test with a tiny population and generation count.
6. Add mocked MPC solver tests for infeasible and solver-fallback cases.
7. Add a DQN model-loading test using the existing saved policy.
8. Add FastAPI tests for invalid city, invalid bill, and invalid budget input.
9. Add browser tests using Playwright or Selenium.
10. Add load tests using Locust or JMeter.
11. Add security scans using Bandit and pip-audit.
12. Add a CI workflow that runs pytest on every pull request.

These improvements should be added incrementally. Expensive external
operations should be mocked or reduced in unit tests and reserved for
scheduled acceptance tests.

