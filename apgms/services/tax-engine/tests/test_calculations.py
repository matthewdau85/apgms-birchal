from datetime import date
from decimal import Decimal

from app.calculations import calculate_paygw_withholding
from app.models import CalculationInputs


class FakeRuleSet:
    def __init__(self, *, brackets, metadata):
        self.brackets = brackets
        self.ruleset_id = metadata["ruleset_id"]
        self.rule_pack_version = metadata["rule_pack_version"]
        self.effective_from = metadata["effective_from"]
        self.effective_to = metadata["effective_to"]
        self.source_url = metadata["source_url"]
        self.source_digest = metadata["source_digest"]


def fake_loader(rule_pack_version, bas_period_start):
    metadata = {
        "ruleset_id": "fake",
        "rule_pack_version": rule_pack_version,
        "effective_from": date(2024, 7, 1),
        "effective_to": None,
        "source_url": "https://example.com",
        "source_digest": "sha256:fake",
    }
    brackets = [
        {
            "lower_bound": Decimal("0"),
            "upper_bound": Decimal("1000"),
            "base_tax": Decimal("0"),
            "marginal_rate": Decimal("0.20"),
        }
    ]
    # Convert dicts to objects with attributes for compatibility
    parsed_brackets = []
    for bracket in brackets:
        parsed_brackets.append(
            type(
                "Bracket",
                (),
                {
                    "lower_bound": bracket["lower_bound"],
                    "upper_bound": bracket["upper_bound"],
                    "base_tax": bracket["base_tax"],
                    "marginal_rate": bracket["marginal_rate"],
                },
            )()
        )
    return FakeRuleSet(brackets=parsed_brackets, metadata=metadata)


def test_calculation_is_deterministic():
    inputs = CalculationInputs(gross_income=Decimal("750"), bas_period_start=date(2024, 7, 1))
    first = calculate_paygw_withholding(inputs, "v1", rules_loader=fake_loader)
    second = calculate_paygw_withholding(inputs, "v1", rules_loader=fake_loader)
    assert first == second


def test_calculation_changes_with_version():
    inputs = CalculationInputs(gross_income=Decimal("750"), bas_period_start=date(2024, 7, 1))

    def loader(rule_pack_version, bas_period_start):
        if rule_pack_version == "v1":
            return fake_loader("v1", bas_period_start)
        metadata = {
            "ruleset_id": "fake2",
            "rule_pack_version": rule_pack_version,
            "effective_from": date(2024, 7, 1),
            "effective_to": None,
            "source_url": "https://example.com/v2",
            "source_digest": "sha256:fake2",
        }
        bracket_cls = type(
            "Bracket",
            (),
            {
                "lower_bound": Decimal("0"),
                "upper_bound": Decimal("1000"),
                "base_tax": Decimal("0"),
                "marginal_rate": Decimal("0.25"),
            },
        )
        return FakeRuleSet(brackets=[bracket_cls()], metadata=metadata)

    first = calculate_paygw_withholding(inputs, "v1", rules_loader=loader)
    second = calculate_paygw_withholding(inputs, "v2", rules_loader=loader)
    assert first.withheld_amount != second.withheld_amount
