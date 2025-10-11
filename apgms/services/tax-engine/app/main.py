from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator

app = FastAPI(title="APGMS Tax Engine", version="0.2.0")

RULES_DIR = Path(__file__).resolve().parent / "rules"


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache()
def load_gst_rules() -> List[dict]:
    rules_file = RULES_DIR / "gst_rates_2024.json"
    return _load_json(rules_file)["rates"]


@lru_cache()
def load_gst_adjustments() -> List[dict]:
    return _load_json(RULES_DIR / "gst_adjustments.json")


@lru_cache()
def load_paygw_schedules() -> List[dict]:
    return _load_json(RULES_DIR / "paygw_schedules_2024.json")


def select_rule(effective_date: date, rules: List[dict]) -> dict:
    applicable = None
    for rule in rules:
        start = date.fromisoformat(rule["effective_from"])
        end_raw = rule.get("effective_to")
        end = date.fromisoformat(end_raw) if end_raw else None
        if effective_date >= start and (end is None or effective_date <= end):
            applicable = rule
    if applicable is None:
        raise HTTPException(status_code=400, detail="no_rule_for_date")
    return applicable


def round_cents_to_dollars(value: int) -> int:
    if value >= 0:
        return (value + 50) // 100
    return -((-value + 50) // 100)


class GstLine(BaseModel):
    date: Optional[date] = Field(None, alias="date")
    amount_cents: int
    gst_cents: int
    tax_code: str

    @validator("tax_code")
    def validate_tax_code(cls, value: str) -> str:
        allowed = {"TX", "FRE", "NT", "INP", "ADJ"}
        if value not in allowed:
            raise ValueError(f"unsupported tax code {value}")
        return value


class GstCalcRequest(BaseModel):
    period_due_date: Optional[date] = None
    supplies: List[GstLine] = Field(default_factory=list)
    purchases: List[GstLine] = Field(default_factory=list)
    adjustments: List[GstLine] = Field(default_factory=list)


class GstCalcResponse(BaseModel):
    g1: int
    g2: int
    g3: int
    g10: int
    g11: int
    label_1A: int = Field(..., alias="1A")
    label_1B: int = Field(..., alias="1B")
    net_payable: int
    metadata: dict

    class Config:
        allow_population_by_field_name = True


class PayEvent(BaseModel):
    date: Optional[date] = None
    gross_cents: int
    withheld_cents: int
    stsl_cents: int = 0


class PaygwCalcRequest(BaseModel):
    period_due_date: Optional[date] = None
    pay_events: List[PayEvent] = Field(default_factory=list)


class PaygwCalcResponse(BaseModel):
    W1: int
    W2: int
    metadata: dict


class BasCompileRequest(BaseModel):
    period: dict
    gst: GstCalcRequest
    paygw: PaygwCalcRequest


class BasCompileResponse(BaseModel):
    period: dict
    gst: GstCalcResponse
    paygw: PaygwCalcResponse
    bas: dict


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "tax-engine"}


@app.post("/gst/calc", response_model=GstCalcResponse)
def gst_calc(payload: GstCalcRequest) -> GstCalcResponse:
    if not payload.supplies and not payload.purchases and not payload.adjustments:
        return GstCalcResponse(
            g1=0,
            g2=0,
            g3=0,
            g10=0,
            g11=0,
            **{"1A": 0, "1B": 0},
            net_payable=0,
            metadata={"note": "no activity"},
        )

    effective_date = payload.period_due_date or date.today()
    rule = select_rule(effective_date, load_gst_rules())
    adjustments_catalogue = load_gst_adjustments()

    taxable_codes = {"TX", "ADJ"}
    gst_free_codes = {"FRE"}
    non_taxable_codes = {"NT"}

    g1_cents = sum(item.amount_cents for item in payload.supplies)
    g2_cents = sum(item.amount_cents for item in payload.supplies if item.tax_code in gst_free_codes)
    g3_cents = sum(item.amount_cents for item in payload.supplies if item.tax_code in non_taxable_codes)

    g10_cents = sum(item.amount_cents for item in payload.purchases if item.tax_code in taxable_codes | {"INP"})
    g11_cents = sum(item.amount_cents for item in payload.purchases)

    adjustments_cents = sum(item.amount_cents for item in payload.adjustments)
    adjustments_gst_cents = sum(item.gst_cents for item in payload.adjustments)

    one_a_cents = sum(item.gst_cents for item in payload.supplies if item.tax_code in taxable_codes)
    one_b_cents = sum(item.gst_cents for item in payload.purchases if item.tax_code in taxable_codes | {"INP"})

    one_a_cents += adjustments_gst_cents
    g1_cents += adjustments_cents

    net_payable_cents = one_a_cents - one_b_cents

    metadata = {
        "rule_version": rule.get("version"),
        "adjustment_codes": [entry["code"] for entry in adjustments_catalogue],
    }

    return GstCalcResponse(
        g1=round_cents_to_dollars(g1_cents),
        g2=round_cents_to_dollars(g2_cents),
        g3=round_cents_to_dollars(g3_cents),
        g10=round_cents_to_dollars(g10_cents),
        g11=round_cents_to_dollars(g11_cents),
        **{"1A": round_cents_to_dollars(one_a_cents), "1B": round_cents_to_dollars(one_b_cents)},
        net_payable=round_cents_to_dollars(net_payable_cents),
        metadata=metadata,
    )


@app.post("/paygw/calc", response_model=PaygwCalcResponse)
def paygw_calc(payload: PaygwCalcRequest) -> PaygwCalcResponse:
    if not payload.pay_events:
        return PaygwCalcResponse(W1=0, W2=0, metadata={"note": "no payroll"})

    effective_date = payload.period_due_date or date.today()
    schedule = select_rule(effective_date, load_paygw_schedules())

    total_gross = sum(event.gross_cents for event in payload.pay_events)
    total_withheld = sum(event.withheld_cents + event.stsl_cents for event in payload.pay_events)

    metadata = {
        "schedule_version": schedule.get("version"),
        "events_count": len(payload.pay_events),
    }

    return PaygwCalcResponse(
        W1=round_cents_to_dollars(total_gross),
        W2=round_cents_to_dollars(total_withheld),
        metadata=metadata,
    )


@app.post("/bas/compile", response_model=BasCompileResponse)
def bas_compile(payload: BasCompileRequest) -> BasCompileResponse:
    gst_result = gst_calc(
        GstCalcRequest(
            period_due_date=payload.gst.period_due_date or payload.period.get("dueDate"),
            supplies=payload.gst.supplies,
            purchases=payload.gst.purchases,
            adjustments=payload.gst.adjustments,
        )
    )
    paygw_result = paygw_calc(
        PaygwCalcRequest(
            period_due_date=payload.paygw.period_due_date or payload.period.get("dueDate"),
            pay_events=payload.paygw.pay_events,
        )
    )

    net_payable = gst_result.net_payable + paygw_result.W2
    bas_summary = {
        "net_payable": net_payable,
        "labels": {
            "1A": gst_result.label_1A,
            "1B": gst_result.label_1B,
            "W1": paygw_result.W1,
            "W2": paygw_result.W2,
        },
    }

    return BasCompileResponse(
        period=payload.period,
        gst=gst_result,
        paygw=paygw_result,
        bas=bas_summary,
    )
