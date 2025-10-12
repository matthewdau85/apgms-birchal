from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Callable, Dict, Mapping, Tuple

from .calculator import CalculationResult, calculate_paygw
from .rule_loader import RuleLoader


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class FastAPI:
    """Minimal FastAPI-like router used for deterministic testing."""

    def __init__(self) -> None:
        self._routes: Dict[Tuple[str, str], Callable[..., Any]] = {}

    def get(self, path: str, response_model: type | None = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self._routes[("GET", path)] = func
            return func

        return decorator

    def post(self, path: str, response_model: type | None = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self._routes[("POST", path)] = func
            return func

        return decorator

    def handle(self, method: str, path: str, payload: Any | None = None) -> Any:
        try:
            handler = self._routes[(method.upper(), path)]
        except KeyError as exc:  # pragma: no cover - invalid test usage
            raise KeyError(f"No route registered for {method} {path}") from exc
        if payload is None:
            return handler()
        return handler(payload)


app = FastAPI()


@dataclass(frozen=True)
class HealthResponse:
    ok: bool
    ruleset_id: str
    effective_from: date
    source_url: str
    source_digest: str


@dataclass(frozen=True)
class CalculationRequest:
    income: Decimal
    deductions: Decimal
    rule_pack_version: str
    bas_period_start: date

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> "CalculationRequest":
        missing = {field for field in ("income", "rule_pack_version", "bas_period_start") if field not in payload}
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(sorted(missing))}")

        income = Decimal(str(payload["income"]))
        deductions = Decimal(str(payload.get("deductions", "0")))
        if income < 0 or deductions < 0:
            raise HTTPException(status_code=400, detail="Income and deductions must be non-negative")
        rule_pack_version = str(payload["rule_pack_version"])
        if not rule_pack_version:
            raise HTTPException(status_code=400, detail="rule_pack_version cannot be blank")
        bas_period_start = date.fromisoformat(str(payload["bas_period_start"]))
        return cls(
            income=income,
            deductions=deductions,
            rule_pack_version=rule_pack_version,
            bas_period_start=bas_period_start,
        )


@dataclass(frozen=True)
class CalculationResponse:
    paygw_withheld: Decimal
    ruleset_id: str
    effective_from: date
    source_url: str
    source_digest: str


def _serialize_result(result: CalculationResult) -> CalculationResponse:
    ruleset = result.ruleset
    return CalculationResponse(
        paygw_withheld=result.paygw_withheld,
        ruleset_id=ruleset.id,
        effective_from=ruleset.effective_from,
        source_url=ruleset.source_url,
        source_digest=ruleset.source_digest,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    loader = RuleLoader()
    ruleset = loader.get_latest_ruleset()
    return HealthResponse(
        ok=True,
        ruleset_id=ruleset.id,
        effective_from=ruleset.effective_from,
        source_url=ruleset.source_url,
        source_digest=ruleset.source_digest,
    )


@app.post("/calculate", response_model=CalculationResponse)
def calculate(payload: Mapping[str, Any]) -> CalculationResponse:
    request = CalculationRequest.from_payload(payload)
    try:
        result = calculate_paygw(
            inputs={
                "income": request.income,
                "deductions": request.deductions,
            },
            rule_pack_version=request.rule_pack_version,
            bas_period_start=request.bas_period_start,
        )
    except ValueError as exc:  # backdating guardrails bubble up as 400s
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_result(result)
