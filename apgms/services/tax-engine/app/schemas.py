from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Dict, Literal, Union

from pydantic import BaseModel, Field


class DecimalConfigMixin(BaseModel):
    class Config:
        json_encoders = {Decimal: lambda value: format(value, "f")}
        arbitrary_types_allowed = True


class GSTLiabilityRequest(DecimalConfigMixin):
    gst_collected: Decimal = Field(..., ge=0)
    gst_paid: Decimal = Field(..., ge=0)
    adjustments: Decimal = Field(default=Decimal("0"), ge=0)
    credits: Decimal = Field(default=Decimal("0"), ge=0)


class PAYGLiabilityRequest(DecimalConfigMixin):
    gross_wages: Decimal = Field(..., ge=0)
    withholding_rate: Decimal = Field(..., ge=0, le=1)
    instalment_credits: Decimal = Field(default=Decimal("0"), ge=0)
    other_adjustments: Decimal = Field(default=Decimal("0"), ge=0)


class TaxCalculationResponse(DecimalConfigMixin):
    liability: Decimal
    breakdown: Dict[str, Decimal]

    @classmethod
    def from_result(cls, result) -> "TaxCalculationResponse":
        payload = result.to_payload()
        return cls(**payload)


class GatewayValidationResponse(DecimalConfigMixin):
    valid: bool
    submission_id: str | None = None
    errors: list[str] = Field(default_factory=list)
    liability: Decimal | None = None
    breakdown: Dict[str, Decimal] | None = None
    submitted: bool = False

    @classmethod
    def from_service(cls, result) -> "GatewayValidationResponse":
        payload = {
            "valid": result.valid,
            "submission_id": result.submission_id,
            "errors": result.errors,
            "submitted": result.submitted,
        }
        if result.result is not None:
            payload.update(result.result.to_payload())
        return cls(**payload)


class GatewayEnvelopeBase(DecimalConfigMixin):
    submission_id: str = Field(..., min_length=1)
    submit: bool = False


class GatewayGSTEnvelope(GatewayEnvelopeBase):
    product: Literal["GST"]
    payload: GSTLiabilityRequest


class GatewayPAYGEnvelope(GatewayEnvelopeBase):
    product: Literal["PAYG"]
    payload: PAYGLiabilityRequest


GatewayPayload = Annotated[
    Union[GatewayGSTEnvelope, GatewayPAYGEnvelope],
    Field(discriminator="product"),
]
