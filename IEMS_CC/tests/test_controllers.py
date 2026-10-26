from __future__ import annotations

from src.controllers.rule_based import RuleBasedController


def test_rule_controller_charges_when_solar_is_surplus(environment):
    environment.reset(seed=42)
    environment._data_idx = next(
        index
        for index, (load, solar) in enumerate(zip(environment.load_kw, environment.solar_kw))
        if solar > load
    )

    assert RuleBasedController().select_action(environment) == 1


def test_rule_controller_discharges_when_load_exceeds_solar(environment):
    environment.reset(seed=42)
    environment._data_idx = next(
        index
        for index, (load, solar) in enumerate(zip(environment.load_kw, environment.solar_kw))
        if load > solar
    )

    assert RuleBasedController().select_action(environment) == 3


def test_rule_controller_never_selects_grid_charging(environment):
    controller = RuleBasedController()
    environment.reset(seed=42)

    actions = []
    for _ in range(96):
        actions.append(controller.select_action(environment))
        environment.step(actions[-1])

    assert 2 not in actions
