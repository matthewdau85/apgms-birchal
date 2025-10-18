from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, status

from .processor import EventProcessor
from .repository import ObligationRepository
from .rules.gst import GSTRuleSet
from .rules.paygw import PaygwRuleSet
from .schemas import (
    EventType,
    ObligationCollection,
    PosEvent,
    PayrollEvent,
    QueuedEvent,
    ReconciliationRequest,
    ReconciliationResponse,
    serialize_discrepancies,
    serialize_obligations,
)


async def _event_consumer(queue: asyncio.Queue[QueuedEvent | None], processor: EventProcessor) -> None:
    while True:
        queued = await queue.get()
        if queued is None:
            queue.task_done()
            break
        try:
            await processor.process_event(queued)
        finally:
            queue.task_done()


@asynccontextmanager
async def lifespan(app: FastAPI):
    queue: asyncio.Queue[QueuedEvent | None] = asyncio.Queue()
    repository = ObligationRepository()
    processor = EventProcessor(repository, PaygwRuleSet(), GSTRuleSet())
    worker = asyncio.create_task(_event_consumer(queue, processor))
    app.state.queue = queue
    app.state.repository = repository
    app.state.processor = processor
    try:
        yield
    finally:
        await queue.put(None)
        await queue.join()
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/events/payroll", status_code=status.HTTP_202_ACCEPTED)
async def queue_payroll_event(event: PayrollEvent) -> dict[str, str]:
    await app.state.queue.put(QueuedEvent(EventType.PAYROLL, event))
    return {"status": "queued"}


@app.post("/events/pos", status_code=status.HTTP_202_ACCEPTED)
async def queue_pos_event(event: PosEvent) -> dict[str, str]:
    await app.state.queue.put(QueuedEvent(EventType.POS, event))
    return {"status": "queued"}


@app.post("/events/flush")
async def flush_events() -> dict[str, str]:
    await app.state.queue.join()
    return {"status": "flushed"}


@app.get("/obligations", response_model=ObligationCollection)
async def get_obligations() -> ObligationCollection:
    repository: ObligationRepository = app.state.repository
    return ObligationCollection(
        obligations=serialize_obligations(repository.all_snapshots())
    )


@app.post("/reconcile", response_model=ReconciliationResponse)
async def reconcile_accounts(request: ReconciliationRequest) -> ReconciliationResponse:
    repository: ObligationRepository = app.state.repository
    discrepancies = repository.reconcile(request.account_balances)
    return ReconciliationResponse(discrepancies=serialize_discrepancies(discrepancies))


@app.get("/discrepancies", response_model=ReconciliationResponse)
async def list_discrepancies() -> ReconciliationResponse:
    repository: ObligationRepository = app.state.repository
    return ReconciliationResponse(
        discrepancies=serialize_discrepancies(repository.list_discrepancies())
    )
