"""FastAPI application for tax calculations."""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI, HTTPException

from .calculators import calculate_gst, calculate_paygw, compile_bas
from .models import (
    BASCompileRequest,
    BASCompileResponse,
    GSTCalcRequest,
    GSTCalcResponse,
    PaygwCalcRequest,
    PaygwCalcResponse,
)
from .rules_loader import load_bas_rules, load_gst_rules, load_paygw_rules


def create_app() -> FastAPI:
    app = FastAPI(
        title="APGMS Tax Engine",
        version="0.1.0",
        description="Deterministic tax calculation engine for GST, PAYGW, and BAS.",
    )

    @app.post("/gst/calc", response_model=GSTCalcResponse, summary="Calculate GST")
    def gst_calc(payload: GSTCalcRequest) -> GSTCalcResponse:
        try:
            return calculate_gst(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post(
        "/paygw/calc",
        response_model=PaygwCalcResponse,
        summary="Calculate PAYGW withholding",
    )
    def paygw_calc(payload: PaygwCalcRequest) -> PaygwCalcResponse:
        try:
            return calculate_paygw(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post(
        "/bas/compile",
        response_model=BASCompileResponse,
        summary="Compile BAS totals",
    )
    def bas_compile(payload: BASCompileRequest) -> BASCompileResponse:
        try:
            return compile_bas(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/rules/versions", summary="Rule versions")
    def rule_versions() -> dict[str, str]:
        return {
            "gst": load_gst_rules()["version"],
            "paygw": load_paygw_rules()["version"],
            "bas": load_bas_rules()["version"],
        }

    return app


app = create_app()


def main() -> None:
    uvicorn.run("tax_engine.app:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
