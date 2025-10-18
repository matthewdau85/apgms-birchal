from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal
from typing import List, Sequence

try:
    import httpx
except ImportError:  # pragma: no cover - fallback path when httpx missing during tests
    httpx = None  # type: ignore[assignment]

from .calculations import TaxRule
from .schemas import AuditLogEntry, FilingRequest, FilingResponse, ResidencyStatus


@dataclass
class TaxRateSchedule:
    residency_status: ResidencyStatus
    tax_year: int
    rules: Sequence[TaxRule]


class TaxRateService:
    """Fetches tax rate schedules from an upstream service.

    The service is expected to be Prisma-backed, however for offline usage the class falls
    back to a static in-memory schedule that is adequate for unit testing.
    """

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url or os.getenv("TAX_RATE_SERVICE_URL")

    async def get_schedule(self, *, tax_year: int, residency_status: ResidencyStatus) -> TaxRateSchedule:
        if self.base_url:
            if httpx is None:
                raise RuntimeError("httpx is required when TAX_RATE_SERVICE_URL is configured")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url.rstrip('/')}/tax-rates/{tax_year}",
                    params={"residency_status": residency_status.value},
                    timeout=10.0,
                )
                response.raise_for_status()
                payload = response.json()
                rules = [
                    TaxRule(threshold=Decimal(str(item["threshold"])), rate=Decimal(str(item["rate"])))
                    for item in payload["brackets"]
                ]
                return TaxRateSchedule(residency_status=residency_status, tax_year=tax_year, rules=rules)

        # Static fallback derived from generic progressive tax tables
        fallback_rules = [
            TaxRule(threshold=Decimal("18200"), rate=Decimal("0.0")),
            TaxRule(threshold=Decimal("45000"), rate=Decimal("0.19")),
            TaxRule(threshold=Decimal("120000"), rate=Decimal("0.325")),
            TaxRule(threshold=Decimal("180000"), rate=Decimal("0.37")),
            TaxRule(threshold=Decimal("999999999"), rate=Decimal("0.45")),
        ]
        return TaxRateSchedule(residency_status=residency_status, tax_year=tax_year, rules=fallback_rules)


class FilingService:
    """Persist filings and produce audit trail entries.

    In a production environment this service would talk to a database or Prisma API. For the
    purposes of automated testing we simply return deterministic responses.
    """

    async def submit_filing(self, request: FilingRequest) -> FilingResponse:
        submission_id = f"{request.taxpayer_id}-{request.estimate.input.tax_year}"
        return FilingResponse(submission_id=submission_id, received_at=request.estimate.generated_at, status="accepted")

    async def audit_trail(self, request: FilingRequest) -> List[AuditLogEntry]:
        return [
            AuditLogEntry(
                submission_id=f"{request.taxpayer_id}-{request.estimate.input.tax_year}",
                taxpayer_id=request.taxpayer_id,
                action="filed",
                details={
                    "net_tax": str(request.estimate.breakdown.net_tax),
                    "warnings": request.estimate.compliance_warnings,
                },
            )
        ]
