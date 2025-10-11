"""Pydantic models for the tax engine."""

from __future__ import annotations

from decimal import Decimal
from typing import Dict

from pydantic import BaseModel, ConfigDict, Field, field_validator


DecimalLike = Decimal | float | int


class MonetaryModel(BaseModel):
    """Base model that normalises monetary values to decimals."""

    model_config = ConfigDict(json_encoders={Decimal: lambda v: float(round(v, 2))})

    @field_validator("*", mode="before")
    @classmethod
    def _coerce_decimal(cls, value: DecimalLike) -> Decimal:
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


class GSTCalcRequest(MonetaryModel):
    net_amount: Decimal = Field(gt=Decimal("-0.0001"))
    category: str = Field(default="standard")


class GSTCalcResponse(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: lambda v: float(round(v, 2))})

    rule_version: str
    category: str
    rate: Decimal
    net_amount: Decimal
    gst_amount: Decimal
    gross_amount: Decimal


class PaygwCalcRequest(MonetaryModel):
    taxable_income: Decimal = Field(gt=Decimal("-0.0001"))
    allowances: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))


class PaygwCalcResponse(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: lambda v: float(round(v, 2))})

    rule_version: str
    applicable_rate: Decimal
    taxable_income: Decimal
    allowances: Decimal
    withheld_amount: Decimal


class BASCompileRequest(MonetaryModel):
    gst_collected: Decimal = Field(default=Decimal("0"))
    gst_paid: Decimal = Field(default=Decimal("0"))
    paygw_withheld: Decimal = Field(default=Decimal("0"))
    paygw_credits: Decimal = Field(default=Decimal("0"))
    fuel_tax_credit: Decimal = Field(default=Decimal("0"))


class BASCompileResponse(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: lambda v: float(round(v, 2))})

    rule_version: str
    totals: Dict[str, Decimal]


def quantise(value: Decimal, precision: str = "0.01") -> Decimal:
    """Quantise to the provided precision using bankers rounding."""

    return value.quantize(Decimal(precision))
