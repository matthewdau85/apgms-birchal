from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, condecimal, validator


Money = condecimal(max_digits=12, decimal_places=2, ge=Decimal("0"))


class ResidencyStatus(str, Enum):
    RESIDENT = "resident"
    NON_RESIDENT = "non_resident"


class FilingStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    HEAD_OF_HOUSEHOLD = "head_of_household"


class IncomeType(str, Enum):
    SALARY = "salary"
    INVESTMENT = "investment"
    BUSINESS = "business"
    OTHER = "other"


class AdjustmentType(str, Enum):
    CREDIT = "credit"
    SURCHARGE = "surcharge"


class IncomeStream(BaseModel):
    source: str = Field(..., description="Source of the income, e.g. employer or account name")
    type: IncomeType = Field(..., description="Type of income stream")
    amount: Money = Field(..., description="Gross amount received")
    withholding: Optional[Money] = Field(
        None, description="Tax already withheld for this income stream"
    )

    @validator("withholding")
    def validate_withholding(cls, value: Optional[Decimal], values: dict[str, object]) -> Optional[Decimal]:
        amount: Optional[Decimal] = values.get("amount")  # type: ignore[assignment]
        if value is not None and amount is not None and value > amount:
            raise ValueError("Withholding cannot exceed gross income")
        return value


class Deduction(BaseModel):
    description: str
    amount: Money


class Adjustment(BaseModel):
    description: str
    amount: Money
    type: AdjustmentType


class TaxInput(BaseModel):
    tax_year: int = Field(..., ge=2000, le=datetime.utcnow().year + 1)
    residency_status: ResidencyStatus
    filing_status: FilingStatus
    incomes: List[IncomeStream] = Field(default_factory=list)
    deductions: List[Deduction] = Field(default_factory=list)
    adjustments: List[Adjustment] = Field(default_factory=list)
    dependents: int = Field(0, ge=0)

    @property
    def total_income(self) -> Decimal:
        return sum((income.amount for income in self.incomes), Decimal("0"))

    @property
    def total_withheld(self) -> Decimal:
        return sum((income.withholding or Decimal("0") for income in self.incomes), Decimal("0"))

    @property
    def total_deductions(self) -> Decimal:
        return sum((deduction.amount for deduction in self.deductions), Decimal("0"))


class TaxBreakdown(BaseModel):
    taxable_income: Decimal
    gross_tax: Decimal
    credits: Decimal
    surcharges: Decimal
    net_tax: Decimal
    effective_rate: Decimal


class TaxEstimate(BaseModel):
    input: TaxInput
    breakdown: TaxBreakdown
    compliance_warnings: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class FilingRequest(BaseModel):
    taxpayer_id: str = Field(..., min_length=3)
    estimate: TaxEstimate


class FilingSubmission(BaseModel):
    taxpayer_id: str = Field(..., min_length=3)
    input: TaxInput


class FilingResponse(BaseModel):
    submission_id: str
    received_at: datetime
    status: str


class AuditLogEntry(BaseModel):
    submission_id: str
    taxpayer_id: str
    action: str
    details: dict[str, object] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditTrailRequest(BaseModel):
    taxpayer_id: str = Field(..., min_length=3)
    input: TaxInput
