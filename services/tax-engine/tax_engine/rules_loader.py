"""Utility functions for reading tax rules."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

RULES_DIR = Path(__file__).resolve().parent.parent / "rules"


class RuleError(RuntimeError):
    """Raised when there is a problem with a rule definition."""


def _load_rule_file(filename: str) -> Dict[str, Any]:
    path = RULES_DIR / filename
    if not path.exists():
        raise RuleError(f"Rule file {filename} was not found in {RULES_DIR}.")

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if "version" not in data:
        raise RuleError(f"Rule file {filename} is missing the 'version' field.")
    return data


@lru_cache(maxsize=None)
def load_gst_rules() -> Dict[str, Any]:
    return _load_rule_file("gst_v1.json")


@lru_cache(maxsize=None)
def load_paygw_rules() -> Dict[str, Any]:
    return _load_rule_file("paygw_v1.json")


@lru_cache(maxsize=None)
def load_bas_rules() -> Dict[str, Any]:
    return _load_rule_file("bas_v1.json")


__all__ = [
    "RuleError",
    "load_gst_rules",
    "load_paygw_rules",
    "load_bas_rules",
]
