from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Dict, Iterable, List, Tuple

from .schemas import (
    AccountBalance,
    DiscrepancyRecord,
    ObligationSnapshot,
    TaxType,
)


class ObligationRepository:
    """In-memory persistence layer representing the shared database."""

    def __init__(self) -> None:
        self._obligations: Dict[Tuple[str, TaxType], ObligationSnapshot] = {}
        self._discrepancies: List[DiscrepancyRecord] = []

    def add_obligation(
        self,
        entity_id: str,
        tax_type: TaxType,
        amount: Decimal,
        *,
        context: Dict[str, str] | None = None,
    ) -> ObligationSnapshot:
        key = (entity_id, tax_type)
        snapshot = self._obligations.get(key)
        if snapshot is None:
            snapshot = ObligationSnapshot(entity_id=entity_id, tax_type=tax_type)
            self._obligations[key] = snapshot
        snapshot.total_amount += amount
        if context:
            snapshot.details.update(context)
        return snapshot

    def all_snapshots(self) -> Iterable[ObligationSnapshot]:
        return list(self._obligations.values())

    def reconcile(self, balances: Iterable[AccountBalance]) -> List[DiscrepancyRecord]:
        balance_map: Dict[Tuple[str, TaxType], Decimal] = defaultdict(lambda: Decimal("0"))
        for balance in balances:
            balance_map[(balance.entity_id, balance.tax_type)] = balance.balance

        discrepancies: List[DiscrepancyRecord] = []
        for key, snapshot in self._obligations.items():
            expected = snapshot.total_amount
            actual = balance_map.get(key, Decimal("0"))
            if expected != actual:
                discrepancy = DiscrepancyRecord(
                    entity_id=snapshot.entity_id,
                    tax_type=snapshot.tax_type,
                    expected_amount=expected,
                    actual_amount=actual,
                    difference=expected - actual,
                    context=snapshot.details.copy(),
                )
                self._discrepancies.append(discrepancy)
                discrepancies.append(discrepancy)
        # Detect extra balances without obligations
        for key, balance in balance_map.items():
            if key not in self._obligations and balance != Decimal("0"):
                entity_id, tax_type = key
                discrepancy = DiscrepancyRecord(
                    entity_id=entity_id,
                    tax_type=tax_type,
                    expected_amount=Decimal("0"),
                    actual_amount=balance,
                    difference=Decimal("0") - balance,
                    context={"note": "No obligation recorded"},
                )
                self._discrepancies.append(discrepancy)
                discrepancies.append(discrepancy)
        return discrepancies

    def list_discrepancies(self) -> List[DiscrepancyRecord]:
        return list(self._discrepancies)


__all__ = ["ObligationRepository"]
