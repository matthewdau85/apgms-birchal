from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Iterable, List

from pydantic import BaseModel, Field


class TaxType(str, Enum):
    """Supported obligation types within the tax engine."""

    PAYGW = "PAYGW"
    GST = "GST"


class EventType(str, Enum):
    """Types of queued events the engine can consume."""

    PAYROLL = "payroll"
    POS = "pos"


class PayrollEvent(BaseModel):
    """Inbound payroll event reported by payroll integrations."""

    employer_id: str = Field(..., description="Identifier of the employing entity")
    employee_id: str = Field(..., description="Identifier of the employee")
    gross_pay: Decimal = Field(..., ge=Decimal("0"), description="Gross pay for the period")
    pay_period_ending: date = Field(..., description="Date the pay period ends")


class PosEvent(BaseModel):
    """Inbound point-of-sale event for GST calculations."""

    business_id: str = Field(..., description="Identifier for the business entity")
    sale_amount: Decimal = Field(
        ..., ge=Decimal("0"), description="Total sale amount including any GST"
    )
    gst_free: bool = Field(
        False, description="Whether the sale item is GST-free (e.g. basic food)"
    )
    tax_rate_override: Decimal | None = Field(
        None,
        ge=Decimal("0"),
        description="Optional override for GST rate for special categories",
    )


@dataclass(slots=True)
class QueuedEvent:
    """Wrapper for queued inbound events."""

    type: EventType
    payload: BaseModel


@dataclass(slots=True)
class ObligationSnapshot:
    """Current obligation state for a tax type and entity."""

    entity_id: str
    tax_type: TaxType
    total_amount: Decimal = field(default=Decimal("0"))
    details: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["total_amount"] = str(self.total_amount)
        payload["tax_type"] = self.tax_type.value
        return payload


@dataclass(slots=True)
class DiscrepancyRecord:
    """Recorded mismatch between calculated obligations and ledger balances."""

    entity_id: str
    tax_type: TaxType
    expected_amount: Decimal
    actual_amount: Decimal
    difference: Decimal
    context: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["expected_amount"] = str(self.expected_amount)
        payload["actual_amount"] = str(self.actual_amount)
        payload["difference"] = str(self.difference)
        payload["tax_type"] = self.tax_type.value
        return payload


class AccountBalance(BaseModel):
    """Reported balance for a tax-designated ledger account."""

    entity_id: str
    tax_type: TaxType
    balance: Decimal
    reference: str | None = None


class ReconciliationRequest(BaseModel):
    """Request payload for performing reconciliation."""

    account_balances: List[AccountBalance]


class ReconciliationResponse(BaseModel):
    """Response payload for reconciliation results."""

    discrepancies: List[Dict[str, Any]]


class ObligationCollection(BaseModel):
    """Response payload for listing obligation snapshots."""

    obligations: List[Dict[str, Any]]


def serialize_discrepancies(records: Iterable[DiscrepancyRecord]) -> List[Dict[str, Any]]:
    return [record.as_dict() for record in records]


def serialize_obligations(records: Iterable[ObligationSnapshot]) -> List[Dict[str, Any]]:
    return [record.as_dict() for record in records]
