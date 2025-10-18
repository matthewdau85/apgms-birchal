from datetime import date
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class Jurisdiction(BaseModel):
    code: str
    name: str
    rate: float
    remittance_frequency: str = Field(alias="remittanceFrequency")
    notes: str | None = None

    class Config:
        allow_population_by_field_name = True


class TaxLineItem(BaseModel):
    description: str
    amount: float
    tax_code: str = Field(alias="taxCode")

    class Config:
        allow_population_by_field_name = True


class TaxCalculationRequest(BaseModel):
    org_id: str = Field(alias="orgId")
    jurisdiction: str
    filing_date: date = Field(alias="filingDate")
    lines: List[TaxLineItem]

    class Config:
        allow_population_by_field_name = True


class CalculatedLine(BaseModel):
    description: str
    amount: float
    tax_amount: float = Field(alias="taxAmount")
    tax_code: str = Field(alias="taxCode")

    class Config:
        allow_population_by_field_name = True


class TaxCalculationResponse(BaseModel):
    org_id: str = Field(alias="orgId")
    jurisdiction: Jurisdiction
    filing_date: date = Field(alias="filingDate")
    subtotal: float
    tax_total: float = Field(alias="taxTotal")
    grand_total: float = Field(alias="grandTotal")
    lines: List[CalculatedLine]

    class Config:
        allow_population_by_field_name = True


app = FastAPI(title="APGMS Tax Engine", description="Simplified tax calculation service")


JURISDICTIONS: Dict[str, Jurisdiction] = {
    "au-nsw": Jurisdiction(
        code="au-nsw",
        name="Australia - New South Wales",
        rate=0.1,
        remittance_frequency="monthly",
        notes="GST for standard rated goods and services.",
    ),
    "au-vic": Jurisdiction(
        code="au-vic",
        name="Australia - Victoria",
        rate=0.1,
        remittance_frequency="quarterly",
        notes="GST aligned with national rate; quarterly for SMEs.",
    ),
    "nz": Jurisdiction(
        code="nz",
        name="New Zealand",
        rate=0.15,
        remittance_frequency="bi-monthly",
        notes="GST standard rate for domestic transactions.",
    ),
}


TAX_CODE_MULTIPLIERS: Dict[str, float] = {
    "standard": 1.0,
    "reduced": 0.5,
    "exempt": 0.0,
}


@app.get("/health")
def health() -> Dict[str, str | bool]:
    return {"ok": True, "service": "tax-engine"}


@app.get("/jurisdictions", response_model=List[Jurisdiction])
def list_jurisdictions() -> List[Jurisdiction]:
    return list(JURISDICTIONS.values())


@app.get("/jurisdictions/{code}", response_model=Jurisdiction)
def get_jurisdiction(code: str) -> Jurisdiction:
    jurisdiction = JURISDICTIONS.get(code)
    if jurisdiction is None:
        raise HTTPException(status_code=404, detail="Unknown jurisdiction")
    return jurisdiction


@app.post("/calculate", response_model=TaxCalculationResponse)
def calculate(request: TaxCalculationRequest) -> TaxCalculationResponse:
    jurisdiction = JURISDICTIONS.get(request.jurisdiction)
    if jurisdiction is None:
        raise HTTPException(status_code=404, detail="Unsupported jurisdiction")

    lines: List[CalculatedLine] = []
    subtotal = 0.0
    tax_total = 0.0

    for line in request.lines:
        multiplier = TAX_CODE_MULTIPLIERS.get(line.tax_code, 1.0)
        tax_amount = round(line.amount * jurisdiction.rate * multiplier, 2)
        subtotal += line.amount
        tax_total += tax_amount
        lines.append(
            CalculatedLine(
                description=line.description,
                amount=line.amount,
                taxAmount=tax_amount,
                taxCode=line.tax_code,
            )
        )

    subtotal = round(subtotal, 2)
    tax_total = round(tax_total, 2)
    grand_total = round(subtotal + tax_total, 2)

    return TaxCalculationResponse(
        orgId=request.org_id,
        jurisdiction=jurisdiction,
        filingDate=request.filing_date,
        subtotal=subtotal,
        taxTotal=tax_total,
        grandTotal=grand_total,
        lines=lines,
    )
