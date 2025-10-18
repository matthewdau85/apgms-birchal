from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..calculations import build_estimate
from ..services import FilingService, TaxRateService
from ..validators import validate_tax_input
from ..schemas import (
    AuditLogEntry,
    AuditTrailRequest,
    FilingRequest,
    FilingResponse,
    FilingSubmission,
    TaxEstimate,
    TaxInput,
)

router = APIRouter()

_rate_service = TaxRateService()
_filing_service = FilingService()


def get_rate_service() -> TaxRateService:
    return _rate_service


def get_filing_service() -> FilingService:
    return _filing_service


@router.post("/estimate", response_model=TaxEstimate, status_code=status.HTTP_200_OK)
async def estimate_tax(
    payload: TaxInput,
    rate_service: TaxRateService = Depends(get_rate_service),
) -> TaxEstimate:
    schedule = await rate_service.get_schedule(
        tax_year=payload.tax_year, residency_status=payload.residency_status
    )
    warnings = validate_tax_input(payload)
    return build_estimate(payload, rules=schedule.rules, warnings=warnings)


@router.post("/file", response_model=FilingResponse, status_code=status.HTTP_201_CREATED)
async def file_return(
    submission: FilingSubmission,
    rate_service: TaxRateService = Depends(get_rate_service),
    filing_service: FilingService = Depends(get_filing_service),
) -> FilingResponse:
    schedule = await rate_service.get_schedule(
        tax_year=submission.input.tax_year, residency_status=submission.input.residency_status
    )
    warnings = validate_tax_input(submission.input)
    estimate = build_estimate(submission.input, rules=schedule.rules, warnings=warnings)
    filing_request = FilingRequest(taxpayer_id=submission.taxpayer_id, estimate=estimate)
    return await filing_service.submit_filing(filing_request)


@router.post("/audit", response_model=list[AuditLogEntry], status_code=status.HTTP_200_OK)
async def audit_trail(
    payload: AuditTrailRequest,
    rate_service: TaxRateService = Depends(get_rate_service),
    filing_service: FilingService = Depends(get_filing_service),
) -> list[AuditLogEntry]:
    schedule = await rate_service.get_schedule(
        tax_year=payload.input.tax_year, residency_status=payload.input.residency_status
    )
    warnings = validate_tax_input(payload.input)
    estimate = build_estimate(payload.input, rules=schedule.rules, warnings=warnings)
    filing_request = FilingRequest(taxpayer_id=payload.taxpayer_id, estimate=estimate)
    return await filing_service.audit_trail(filing_request)
