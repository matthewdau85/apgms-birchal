from __future__ import annotations

from .repository import ObligationRepository
from .rules.gst import GSTRuleSet
from .rules.paygw import PaygwRuleSet
from .schemas import EventType, PosEvent, PayrollEvent, QueuedEvent, TaxType


class EventProcessor:
    """Applies tax rules to queued events and records obligations."""

    def __init__(
        self,
        repository: ObligationRepository,
        paygw_rules: PaygwRuleSet,
        gst_rules: GSTRuleSet,
    ) -> None:
        self._repository = repository
        self._paygw_rules = paygw_rules
        self._gst_rules = gst_rules

    async def process_event(self, event: QueuedEvent) -> None:
        if event.type is EventType.PAYROLL:
            payroll_event = event.payload
            assert isinstance(payroll_event, PayrollEvent)
            self._process_payroll_event(payroll_event)
        elif event.type is EventType.POS:
            pos_event = event.payload
            assert isinstance(pos_event, PosEvent)
            self._process_pos_event(pos_event)
        else:
            raise ValueError(f"Unknown event type {event.type}")

    def _process_payroll_event(self, event: PayrollEvent) -> None:
        withholding = self._paygw_rules.calculate_withholding(event.gross_pay)
        context = {
            "employee_id": event.employee_id,
            "pay_period_ending": event.pay_period_ending.isoformat(),
        }
        self._repository.add_obligation(
            entity_id=event.employer_id,
            tax_type=TaxType.PAYGW,
            amount=withholding,
            context=context,
        )

    def _process_pos_event(self, event: PosEvent) -> None:
        gst_amount = self._gst_rules.calculate_gst(
            sale_amount=event.sale_amount,
            gst_free=event.gst_free,
            tax_rate_override=event.tax_rate_override,
        )
        context = {"gst_free": str(event.gst_free)}
        self._repository.add_obligation(
            entity_id=event.business_id,
            tax_type=TaxType.GST,
            amount=gst_amount,
            context=context,
        )


__all__ = ["EventProcessor"]
