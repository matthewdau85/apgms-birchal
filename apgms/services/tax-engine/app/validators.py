from __future__ import annotations

from decimal import Decimal
from typing import List

from .schemas import TaxInput


class ComplianceWarning(str):
    """Simple alias to indicate compliance messages."""


class ComplianceChecker:
    def __init__(self) -> None:
        self._warnings: List[ComplianceWarning] = []

    def add_warning(self, message: str) -> None:
        self._warnings.append(ComplianceWarning(message))

    def results(self) -> List[str]:
        return list(self._warnings)


def validate_tax_input(tax_input: TaxInput) -> List[str]:
    checker = ComplianceChecker()

    if tax_input.total_income == Decimal("0"):
        checker.add_warning("Total income is zero; confirm this is expected for the tax year.")

    for deduction in tax_input.deductions:
        if deduction.amount > tax_input.total_income:
            checker.add_warning(
                f"Deduction '{deduction.description}' exceeds total income and may trigger manual review."
            )

    if tax_input.dependents > 5:
        checker.add_warning("Dependents exceed standard threshold and may require additional documentation.")

    for income in tax_input.incomes:
        if income.withholding and income.withholding == Decimal("0"):
            checker.add_warning(
                f"Income source '{income.source}' reports zero withholding; verify withholding details."
            )

    return checker.results()
