from datetime import date

import pytest

from app.rules_loader import load_rules


def test_load_rules_requires_matching_bas_period():
    with pytest.raises(LookupError):
        load_rules("2023.4", date(2025, 7, 1))


def test_load_rules_supports_historical_period():
    ruleset = load_rules("2023.4", date(2024, 6, 15))
    assert ruleset.ruleset_id == "paygw-2023-07"
