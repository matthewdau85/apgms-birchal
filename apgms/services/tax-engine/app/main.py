from __future__ import annotations

import os
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, status

from .calculations import CalculationError, GSTCalculationData, PAYGCalculationData
from .clients import SBRClient
from .schemas import (
    GSTLiabilityRequest,
    GatewayPayload,
    GatewayValidationResponse,
    PAYGLiabilityRequest,
    TaxCalculationResponse,
)
from .services import TaxEngineService

app = FastAPI(title="APGMS Tax Engine")


@lru_cache()
def get_tax_service() -> TaxEngineService:
    base_url = os.getenv("SBR_BASE_URL", "http://sbr:8080")
    return TaxEngineService(SBRClient(base_url))


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/gst/liability", response_model=TaxCalculationResponse)
def compute_gst(
    payload: GSTLiabilityRequest,
    service: TaxEngineService = Depends(get_tax_service),
) -> TaxCalculationResponse:
    try:
        data = GSTCalculationData(
            gst_collected=payload.gst_collected,
            gst_paid=payload.gst_paid,
            adjustments=payload.adjustments,
            credits=payload.credits,
        )
    except CalculationError as exc:  # pragma: no cover - defensive, inputs validated via Pydantic
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    result = service.calculate_gst(data)
    return TaxCalculationResponse.from_result(result)


@app.post("/payg/liability", response_model=TaxCalculationResponse)
def compute_payg(
    payload: PAYGLiabilityRequest,
    service: TaxEngineService = Depends(get_tax_service),
) -> TaxCalculationResponse:
    try:
        data = PAYGCalculationData(
            gross_wages=payload.gross_wages,
            withholding_rate=payload.withholding_rate,
            instalment_credits=payload.instalment_credits,
            other_adjustments=payload.other_adjustments,
        )
    except CalculationError as exc:  # pragma: no cover - defensive, inputs validated via Pydantic
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    result = service.calculate_payg(data)
    return TaxCalculationResponse.from_result(result)


@app.post("/gateway/validate", response_model=GatewayValidationResponse)
async def validate_gateway_payload(
    envelope: GatewayPayload,
    service: TaxEngineService = Depends(get_tax_service),
) -> GatewayValidationResponse:
    if envelope.product == "GST":
        try:
            data = GSTCalculationData(
                gst_collected=envelope.payload.gst_collected,
                gst_paid=envelope.payload.gst_paid,
                adjustments=envelope.payload.adjustments,
                credits=envelope.payload.credits,
            )
        except CalculationError as exc:
            return GatewayValidationResponse(valid=False, submission_id=envelope.submission_id, errors=[str(exc)])
    else:
        try:
            data = PAYGCalculationData(
                gross_wages=envelope.payload.gross_wages,
                withholding_rate=envelope.payload.withholding_rate,
                instalment_credits=envelope.payload.instalment_credits,
                other_adjustments=envelope.payload.other_adjustments,
            )
        except CalculationError as exc:
            return GatewayValidationResponse(valid=False, submission_id=envelope.submission_id, errors=[str(exc)])

    validation = await service.validate_gateway_payload(
        product=envelope.product,
        submission_id=envelope.submission_id,
        data=data,
        submit=envelope.submit,
    )
    return GatewayValidationResponse.from_service(validation)
