"""Deterministic calculation routines for the tax engine."""

from __future__ import annotations

from decimal import Decimal
from typing import Dict

from .models import (
    BASCompileRequest,
    BASCompileResponse,
    GSTCalcRequest,
    GSTCalcResponse,
    PaygwCalcRequest,
    PaygwCalcResponse,
    quantise,
)
from .rules_loader import load_bas_rules, load_gst_rules, load_paygw_rules


def calculate_gst(payload: GSTCalcRequest) -> GSTCalcResponse:
    rules = load_gst_rules()
    rate_map: Dict[str, float] = rules["rates"]
    if payload.category not in rate_map:
        available = ", ".join(sorted(rate_map))
        raise ValueError(f"Unknown GST category '{payload.category}'. Available: {available}.")

    rate = Decimal(str(rate_map[payload.category]))
    net_amount = payload.net_amount
    gst_amount = quantise(net_amount * rate)
    gross_amount = quantise(net_amount + gst_amount)

    return GSTCalcResponse(
        rule_version=rules["version"],
        category=payload.category,
        rate=rate,
        net_amount=quantise(net_amount),
        gst_amount=gst_amount,
        gross_amount=gross_amount,
    )


def calculate_paygw(payload: PaygwCalcRequest) -> PaygwCalcResponse:
    rules = load_paygw_rules()
    tiers = rules["tiers"]
    taxable_income = payload.taxable_income

    applicable_rate = Decimal("0")
    for tier in tiers:
        up_to = tier["up_to"]
        applicable_rate = Decimal(str(tier["rate"]))
        if up_to is None or taxable_income <= Decimal(str(up_to)):
            break

    allowances_reduction = payload.allowances * Decimal(str(rules["allowance_rate"]))
    withheld = quantise((taxable_income * applicable_rate) - allowances_reduction)
    if withheld < Decimal("0"):
        withheld = Decimal("0")

    return PaygwCalcResponse(
        rule_version=rules["version"],
        applicable_rate=applicable_rate,
        taxable_income=quantise(taxable_income),
        allowances=quantise(payload.allowances),
        withheld_amount=withheld,
    )


def compile_bas(payload: BASCompileRequest) -> BASCompileResponse:
    rules = load_bas_rules()
    formulas: Dict[str, Dict[str, float]] = rules["formulas"]

    totals: Dict[str, Decimal] = {}
    base_values: Dict[str, Decimal] = {
        "gst_collected": payload.gst_collected,
        "gst_paid": payload.gst_paid,
        "paygw_withheld": payload.paygw_withheld,
        "paygw_credits": payload.paygw_credits,
        "fuel_tax_credit": payload.fuel_tax_credit,
    }

    for name, coefficients in formulas.items():
        total = Decimal("0")
        for key, coefficient in coefficients.items():
            value = base_values.get(key, totals.get(key))
            if value is None:
                raise ValueError(f"Unknown component '{key}' in BAS formula '{name}'.")
            total += Decimal(str(coefficient)) * value
        totals[name] = quantise(total)

    return BASCompileResponse(rule_version=rules["version"], totals=totals)


__all__ = [
    "calculate_gst",
    "calculate_paygw",
    "compile_bas",
]
