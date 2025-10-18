"""Utilities for generating mock AS4 payloads."""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _now_iso() -> str:
    """Return an ISO-8601 timestamp in UTC."""

    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class AS4Message:
    """Representation of a simplified AS4 message."""

    message_id: str
    conversation_id: str
    payload: Dict[str, Any]
    attachments: Dict[str, str] = field(default_factory=dict)
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        """Convert the message to a serialisable dictionary."""

        return {
            "message_id": self.message_id,
            "conversation_id": self.conversation_id,
            "payload": self.payload,
            "attachments": self.attachments,
            "created_at": self.created_at,
        }

    def to_json(self) -> str:
        """Return the message as a JSON string."""

        return json.dumps(self.to_dict(), indent=2, sort_keys=True)


def generate_as4_message(
    payload: Dict[str, Any],
    *,
    message_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    attachments: Optional[Dict[str, bytes]] = None,
) -> AS4Message:
    """Generate a mock AS4 message ready to persist.

    Args:
        payload: JSON serialisable payload that mimics the business document.
        message_id: Optional pre-determined message identifier. When omitted a
            random UUID is generated.
        conversation_id: Optional conversation identifier used to correlate
            multi-message exchanges.
        attachments: Optional mapping of attachment name to raw bytes. Binary
            content is base64 encoded to simplify storage.

    Returns:
        AS4Message: A dataclass instance capturing the AS4 envelope.
    """

    generated_message_id = message_id or str(uuid.uuid4())
    generated_conversation_id = conversation_id or str(uuid.uuid4())

    encoded_attachments: Dict[str, str] = {}
    if attachments:
        for name, content in attachments.items():
            encoded_attachments[name] = base64.b64encode(content).decode()

    return AS4Message(
        message_id=generated_message_id,
        conversation_id=generated_conversation_id,
        payload=payload,
        attachments=encoded_attachments,
    )

