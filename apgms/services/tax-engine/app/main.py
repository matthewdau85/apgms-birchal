from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI

from .calculations import calculate_paygw_withholding
from .models import CalculationInputs, CalculationRequest, TraceableResponse

app = FastAPI()


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/paygw/calculate")
def paygw_calculate(payload: Dict[str, Any]) -> TraceableResponse:
    request = CalculationRequest.from_dict(payload)
    inputs = CalculationInputs(
        gross_income=request.gross_income,
        bas_period_start=request.bas_period_start,
    )
    result = calculate_paygw_withholding(inputs, request.rule_pack_version)
    return TraceableResponse(result=result)
