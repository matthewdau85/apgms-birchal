"""Receipt builders and parsers for the SBR AS4 stub."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class Receipt:
    """Simple acknowledgement format returned by the stub."""

    message_id: str
    conversation_id: str
    status: str = "ACCEPTED"
    received_at: str = field(default_factory=_now_iso)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message_id": self.message_id,
            "conversation_id": self.conversation_id,
            "status": self.status,
            "received_at": self.received_at,
            "details": self.details,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, sort_keys=True)


def build_receipt(
    message_id: str,
    conversation_id: str,
    *,
    status: str = "ACCEPTED",
    details: Dict[str, Any] | None = None,
) -> Receipt:
    """Construct a receipt for the supplied identifiers."""

    return Receipt(
        message_id=message_id,
        conversation_id=conversation_id,
        status=status,
        details=details or {},
    )


def parse_receipt(raw_receipt: str | bytes | Dict[str, Any]) -> Receipt:
    """Parse a receipt representation back into a :class:`Receipt`."""

    if isinstance(raw_receipt, Receipt):  # type: ignore[unreachable]
        return raw_receipt

    if isinstance(raw_receipt, bytes):
        data: Dict[str, Any] = json.loads(raw_receipt.decode())
    elif isinstance(raw_receipt, str):
        data = json.loads(raw_receipt)
    else:
        data = raw_receipt

    return Receipt(
        message_id=data["message_id"],
        conversation_id=data["conversation_id"],
        status=data.get("status", "ACCEPTED"),
        received_at=data.get("received_at", _now_iso()),
        details=data.get("details", {}),
    )

