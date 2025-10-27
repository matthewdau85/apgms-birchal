"""Compile Business Activity Statement (BAS) label totals."""

from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from importlib import resources
from typing import Any, Mapping, TypeAlias

LabelTotals: TypeAlias = dict[str, int]


@lru_cache
def _load_label_rules() -> dict[str, Any]:
    """Load the label mapping rules from the packaged JSON file."""
    with resources.files("app.rules.bas").joinpath("labels_v1.json").open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _to_decimal(value: Any) -> Decimal:
    """Convert a value to :class:`~decimal.Decimal`, returning zero for unsupported types."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, str)):
        return Decimal(str(value))
    if isinstance(value, float):
        # Avoid floating point surprises by converting via ``repr``.
        return Decimal(repr(value))
    raise TypeError(f"Unsupported numeric value type: {type(value)!r}")


def _resolve_path(source: Mapping[str, Any], path: str) -> Decimal:
    """Resolve a dotted path within ``source`` and return a :class:`Decimal` value."""
    current: Any = source
    for part in path.split("."):
        if isinstance(current, Mapping) and part in current:
            current = current[part]
        else:
            return Decimal("0")
    if isinstance(current, (list, tuple)):
        total = Decimal("0")
        for item in current:
            total += _to_decimal(item)
        return total
    return _to_decimal(current)


def _round_half_up(value: Decimal) -> int:
    """Round to the nearest whole dollar using ATO half-up rounding rules."""
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compileBas(period: str, gstResult: Mapping[str, Any], paygwResult: Mapping[str, Any]) -> dict[str, Any]:
    """Compile BAS label totals for the given ``period``.

    Parameters
    ----------
    period:
        Identifier for the BAS period, e.g. ``"2024-05"``.
    gstResult:
        Aggregated GST calculation results.
    paygwResult:
        Aggregated PAYGW calculation results.

    Returns
    -------
    dict[str, Any]
        A structure containing the ``period``, ``labels`` and the ``rulesVersion`` used.
    """

    rules = _load_label_rules()
    labels_config = rules["labels"]
    sources = {"gst": gstResult, "paygw": paygwResult}

    compiled: LabelTotals = {}

    for label, config in labels_config.items():
        total = Decimal("0")
        for source in config["sources"]:
            source_key = source["source"]
            if source_key not in sources:
                raise KeyError(f"Unknown source '{source_key}' for label {label}")
            total += _resolve_path(sources[source_key], source["path"])
        compiled[label] = _round_half_up(total)

    return {
        "period": period,
        "labels": compiled,
        "rulesVersion": rules.get("version", "unknown"),
    }


__all__ = ["compileBas"]
