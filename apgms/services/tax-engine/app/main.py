from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import urlparse

from fastapi import FastAPI, Response

app = FastAPI()

SERVICE_NAME = "tax-engine"

CheckResult = Dict[str, Any]


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _latency_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)


async def _check_endpoint(url: str | None, default_port: int) -> CheckResult:
    started = time.perf_counter()
    if not url:
        return {
            "status": "fail",
            "latencyMs": _latency_ms(started),
            "checkedAt": _timestamp(),
            "error": "missing connection string",
        }

    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or default_port
    if not host:
        return {
            "status": "fail",
            "latencyMs": _latency_ms(started),
            "checkedAt": _timestamp(),
            "error": "missing host",
        }

    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=1.5)
        writer.close()
        await writer.wait_closed()
        return {
            "status": "pass",
            "latencyMs": _latency_ms(started),
            "checkedAt": _timestamp(),
        }
    except Exception as exc:  # pragma: no cover - best effort network probe
        return {
            "status": "fail",
            "latencyMs": _latency_ms(started),
            "checkedAt": _timestamp(),
            "error": str(exc),
        }


async def _collect_checks() -> Dict[str, CheckResult]:
    database_url = os.getenv("DATABASE_URL")
    redis_url = os.getenv("REDIS_URL")

    database, redis = await asyncio.gather(
        _check_endpoint(database_url, 5432),
        _check_endpoint(redis_url, 6379),
    )

    return {"database": database, "redis": redis}


def _overall_status(checks: Dict[str, CheckResult]) -> str:
    if all(check.get("status") == "pass" for check in checks.values()):
        return "ok"
    return "degraded"


def _ready_status(checks: Dict[str, CheckResult]) -> tuple[str, int]:
    ready = all(check.get("status") == "pass" for check in checks.values())
    return ("ready", 200) if ready else ("not_ready", 503)


@app.get("/health")
async def health() -> Dict[str, Any]:
    checks = await _collect_checks()
    return {
        "service": SERVICE_NAME,
        "status": _overall_status(checks),
        "checkedAt": _timestamp(),
        "checks": checks,
    }


@app.get("/ready")
async def ready(response: Response) -> Dict[str, Any]:
    checks = await _collect_checks()
    status, code = _ready_status(checks)
    response.status_code = code
    return {
        "service": SERVICE_NAME,
        "status": status,
        "checkedAt": _timestamp(),
        "checks": checks,
    }
