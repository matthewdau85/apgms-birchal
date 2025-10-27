from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from importlib import resources
from typing import Dict, Iterable, List


@dataclass(frozen=True)
class TaxBracket:
    threshold: Decimal
    rate: Decimal


@dataclass(frozen=True)
class TaxRuleSet:
    id: str
    effective_from: date
    brackets: List[TaxBracket]
    source_url: str
    source_digest: str

    def rate_for_income(self, taxable_income: Decimal) -> Decimal:
        applicable = self.brackets[0]
        for bracket in self.brackets:
            if taxable_income >= bracket.threshold:
                applicable = bracket
            else:
                break
        return applicable.rate


class RuleLoader:
    """Load PAYGW rule sets with explicit version and bas period context."""

    _cache: Dict[str, TaxRuleSet] | None = None
    _ordered_ids: List[str] | None = None

    def __init__(self) -> None:
        if RuleLoader._cache is None:
            RuleLoader._cache, RuleLoader._ordered_ids = self._load_rulesets()

    def _load_rulesets(self) -> tuple[Dict[str, TaxRuleSet], List[str]]:
        data = resources.files(__package__).joinpath("data/rulesets.json").read_text(encoding="utf-8")
        payload = json.loads(data)
        rulesets: Dict[str, TaxRuleSet] = {}
        ordered_ids: List[str] = []
        for raw in sorted(payload["rule_packs"], key=lambda item: item["effective_from"]):
            brackets = [
                TaxBracket(threshold=Decimal(str(entry["threshold"])), rate=Decimal(str(entry["rate"])))
                for entry in raw["brackets"]
            ]
            ruleset = TaxRuleSet(
                id=raw["id"],
                effective_from=date.fromisoformat(raw["effective_from"]),
                brackets=brackets,
                source_url=raw["source_url"],
                source_digest=raw["source_digest"],
            )
            rulesets[ruleset.id] = ruleset
            ordered_ids.append(ruleset.id)
        return rulesets, ordered_ids

    def load_ruleset(self, *, rule_pack_version: str, bas_period_start: date) -> TaxRuleSet:
        if RuleLoader._cache is None or RuleLoader._ordered_ids is None:  # pragma: no cover - defensive
            RuleLoader._cache, RuleLoader._ordered_ids = self._load_rulesets()

        if rule_pack_version == "latest":
            latest = self.get_latest_ruleset()
            if bas_period_start < latest.effective_from:
                raise ValueError(
                    "Cannot use the latest rule pack for a BAS period that predates its effectiveness."
                )
            return latest

        try:
            ruleset = RuleLoader._cache[rule_pack_version]
        except KeyError as exc:  # pragma: no cover - invalid input path
            raise ValueError(f"Unknown rule pack version: {rule_pack_version}") from exc

        if bas_period_start < ruleset.effective_from:
            raise ValueError(
                f"Rule pack {rule_pack_version} is not effective until {ruleset.effective_from.isoformat()}"
            )
        return ruleset

    def get_latest_ruleset(self) -> TaxRuleSet:
        if RuleLoader._cache is None or RuleLoader._ordered_ids is None:  # pragma: no cover - defensive
            RuleLoader._cache, RuleLoader._ordered_ids = self._load_rulesets()
        assert RuleLoader._ordered_ids  # pragma: no cover - data contract
        latest_id = RuleLoader._ordered_ids[-1]
        return RuleLoader._cache[latest_id]

    def iter_rulesets(self) -> Iterable[TaxRuleSet]:
        if RuleLoader._cache is None or RuleLoader._ordered_ids is None:  # pragma: no cover - defensive
            RuleLoader._cache, RuleLoader._ordered_ids = self._load_rulesets()
        for identifier in RuleLoader._ordered_ids:
            yield RuleLoader._cache[identifier]
