from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Iterable

from .models import RuleBracket, RuleSet

DATA_PATH = Path(__file__).resolve().parent / "data" / "paygw_rules.json"


def _read_rule_sets() -> Iterable[RuleSet]:
    payload = json.loads(DATA_PATH.read_text())
    rule_sets = []
    for item in payload.get("rule_sets", []):
        brackets = tuple(
            RuleBracket(
                lower_bound=Decimal(str(bracket["lower_bound"])),
                upper_bound=None if bracket.get("upper_bound") is None else Decimal(str(bracket["upper_bound"])),
                base_tax=Decimal(str(bracket["base_tax"])),
                marginal_rate=Decimal(str(bracket["marginal_rate"])),
            )
            for bracket in item.get("brackets", [])
        )
        rule_sets.append(
            RuleSet(
                ruleset_id=item["ruleset_id"],
                rule_pack_version=item["rule_pack_version"],
                effective_from=date.fromisoformat(item["effective_from"]),
                effective_to=date.fromisoformat(item["effective_to"]) if item.get("effective_to") else None,
                source_url=item["source_url"],
                source_digest=item["source_digest"],
                brackets=brackets,
            )
        )
    return rule_sets


def load_rules(rule_pack_version: str, bas_period_start: date) -> RuleSet:
    if bas_period_start is None:
        raise ValueError("bas_period_start is required for rule lookup")

    matching_versions = [
        ruleset for ruleset in _read_rule_sets() if ruleset.rule_pack_version == rule_pack_version
    ]

    if not matching_versions:
        raise LookupError(f"Unknown rule pack version: {rule_pack_version}")

    for ruleset in matching_versions:
        effective_to = ruleset.effective_to or date.max
        if ruleset.effective_from <= bas_period_start <= effective_to:
            return ruleset

    raise LookupError(
        "No ruleset matches the provided BAS period start; ensure you requested"
        " the correct historical version instead of using the latest rules."
    )
