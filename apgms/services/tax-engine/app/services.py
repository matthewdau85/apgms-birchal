from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Protocol, Union

from .calculations import (
    CalculationError,
    GSTCalculationData,
    GSTCalculator,
    PAYGCalculationData,
    PAYGCalculator,
    TaxCalculationResult,
)


class SBRClientProtocol(Protocol):
    async def submit_liability(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...


@dataclass
class GatewayValidationResult:
    valid: bool
    submission_id: str | None
    errors: List[str] = field(default_factory=list)
    result: TaxCalculationResult | None = None
    submitted: bool = False


class TaxEngineService:
    """Application service coordinating tax calculations and submissions."""

    def __init__(self, sbr_client: SBRClientProtocol) -> None:
        self._sbr_client = sbr_client
        self._gst_calculator = GSTCalculator()
        self._payg_calculator = PAYGCalculator()

    def calculate_gst(self, data: GSTCalculationData) -> TaxCalculationResult:
        return self._gst_calculator.calculate(data)

    def calculate_payg(self, data: PAYGCalculationData) -> TaxCalculationResult:
        return self._payg_calculator.calculate(data)

    async def validate_gateway_payload(
        self,
        *,
        product: str,
        submission_id: str,
        data: Union[GSTCalculationData, PAYGCalculationData],
        submit: bool = False,
    ) -> GatewayValidationResult:
        try:
            if product == "GST":
                result = self.calculate_gst(data)  # type: ignore[arg-type]
            elif product == "PAYG":
                result = self.calculate_payg(data)  # type: ignore[arg-type]
            else:
                return GatewayValidationResult(
                    valid=False,
                    submission_id=submission_id,
                    errors=[f"Unsupported product '{product}'."],
                )
        except CalculationError as exc:  # pragma: no cover - defensive; constructors validate inputs
            return GatewayValidationResult(
                valid=False,
                submission_id=submission_id,
                errors=[str(exc)],
            )

        submitted = False
        if submit:
            payload = self._build_submission_payload(product=product, submission_id=submission_id, result=result)
            await self._sbr_client.submit_liability(payload)
            submitted = True

        return GatewayValidationResult(
            valid=True,
            submission_id=submission_id,
            result=result,
            submitted=submitted,
        )

    def _build_submission_payload(
        self, *, product: str, submission_id: str, result: TaxCalculationResult
    ) -> Dict[str, Any]:
        payload = result.normalized()
        return {
            "submissionId": submission_id,
            "product": product,
            "liability": str(payload.liability),
            "breakdown": {key: str(value) for key, value in payload.breakdown.items()},
        }


__all__ = ["GatewayValidationResult", "TaxEngineService", "SBRClientProtocol"]
