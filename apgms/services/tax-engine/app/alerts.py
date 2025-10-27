from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class OpsAlertRequired(Exception):
    """Raised when a PAYGW bracket update requires an operational alert."""

    message: str

    def __str__(self) -> str:  # pragma: no cover - dataclass repr
        return self.message


def require_ops_alert_for_paygw_change(
    *,
    previous_brackets: Sequence[Mapping[str, object]],
    proposed_brackets: Sequence[Mapping[str, object]],
    alert_opened: bool,
) -> None:
    """Enforce that PAYGW bracket changes cannot proceed without sign-off."""

    if _has_paygw_change(previous_brackets, proposed_brackets) and not alert_opened:
        raise OpsAlertRequired(
            "PAYGW brackets were updated without an operational alert and approval."
        )


def _has_paygw_change(
    previous_brackets: Iterable[Mapping[str, object]],
    proposed_brackets: Iterable[Mapping[str, object]],
) -> bool:
    return list(previous_brackets) != list(proposed_brackets)
