from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional


def _to_decimal(value: Any) -> Decimal:
    decimal_value = Decimal(str(value))
    if decimal_value < 0:
        raise ValueError("Monetary values must be non-negative")
    return decimal_value


@dataclass(frozen=True)
class CalculationInputs:
    gross_income: Decimal
    bas_period_start: date

    def __post_init__(self) -> None:
        if self.gross_income <= 0:
            raise ValueError("gross_income must be positive")

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "CalculationInputs":
        return cls(
            gross_income=_to_decimal(payload["gross_income"]),
            bas_period_start=date.fromisoformat(payload["bas_period_start"]),
        )


@dataclass(frozen=True)
class CalculationRequest(CalculationInputs):
    rule_pack_version: str

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "CalculationRequest":
        base = CalculationInputs.from_dict(payload)
        rule_pack_version = payload.get("rule_pack_version")
        if not rule_pack_version:
            raise ValueError("rule_pack_version is required")
        return cls(
            gross_income=base.gross_income,
            bas_period_start=base.bas_period_start,
            rule_pack_version=str(rule_pack_version),
        )


@dataclass(frozen=True)
class RuleBracket:
    lower_bound: Decimal
    upper_bound: Optional[Decimal]
    base_tax: Decimal
    marginal_rate: Decimal

    def __post_init__(self) -> None:
        if self.upper_bound is not None and self.upper_bound <= self.lower_bound:
            raise ValueError("upper_bound must be greater than lower_bound")


@dataclass(frozen=True)
class RuleSet:
    ruleset_id: str
    rule_pack_version: str
    effective_from: date
    effective_to: Optional[date]
    source_url: str
    source_digest: str
    brackets: tuple[RuleBracket, ...]


@dataclass(frozen=True)
class CalculationResult:
    withheld_amount: Decimal
    rule_pack_version: str
    ruleset_id: str
    effective_from: date
    effective_to: Optional[date]
    source_url: str
    source_digest: str

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "withheld_amount": format(self.withheld_amount, "0.2f"),
            "rule_pack_version": self.rule_pack_version,
            "ruleset_id": self.ruleset_id,
            "effective_from": self.effective_from.isoformat(),
            "source_url": self.source_url,
            "source_digest": self.source_digest,
        }
        if self.effective_to:
            payload["effective_to"] = self.effective_to.isoformat()
        return payload


@dataclass(frozen=True)
class TraceableResponse:
    result: CalculationResult

    def to_dict(self) -> Dict[str, Any]:
        return {"result": self.result.to_dict()}
