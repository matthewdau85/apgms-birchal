"""High level façade for working with the SBR AS4 stub."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

from apgms.storage import StorageManager

from .messages import AS4Message, generate_as4_message
from .receipts import Receipt, build_receipt, parse_receipt


class SBRStubClient:
    """Client that mimics the behaviour of the SBR AS4 gateway.

    The client focuses on developer ergonomics rather than protocol accuracy.
    It allows payload generation, persistence of message artefacts, and receipt
    parsing so developers can exercise integration flows locally.
    """

    def __init__(self, storage: Optional[StorageManager] = None) -> None:
        self.storage = storage or StorageManager(app_subdir="sbr")

    # ------------------------------------------------------------------
    # Message helpers
    # ------------------------------------------------------------------
    def create_message(
        self,
        payload: Dict[str, Any],
        *,
        message_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        attachments: Optional[Dict[str, bytes]] = None,
    ) -> AS4Message:
        """Generate and persist an AS4 message for the supplied payload."""

        message = generate_as4_message(
            payload,
            message_id=message_id,
            conversation_id=conversation_id,
            attachments=attachments,
        )

        self._persist_artifact(message.message_id, "payload.json", message.to_dict())
        return message

    def submit_payload(
        self,
        payload: Dict[str, Any],
        *,
        message_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        attachments: Optional[Dict[str, bytes]] = None,
        receipt_status: str = "ACCEPTED",
    ) -> Receipt:
        """Create a payload, persist it, and return a receipt.

        This method mirrors what a full integration would perform while keeping
        the implementation deliberately simple.
        """

        message = self.create_message(
            payload,
            message_id=message_id,
            conversation_id=conversation_id,
            attachments=attachments,
        )

        receipt = build_receipt(
            message.message_id,
            message.conversation_id,
            status=receipt_status,
            details={"payload_checksum": self._checksum_payload(payload)},
        )

        self._persist_artifact(message.message_id, "receipt.json", receipt.to_dict())
        return receipt

    # ------------------------------------------------------------------
    # Receipt helpers
    # ------------------------------------------------------------------
    def parse_receipt(self, raw_receipt: str | bytes | Dict[str, Any]) -> Receipt:
        """Parse a stored or inline receipt representation."""

        return parse_receipt(raw_receipt)

    # ------------------------------------------------------------------
    # Storage helpers
    # ------------------------------------------------------------------
    def list_interactions(self) -> Iterable[str]:
        """Return the set of interaction identifiers stored on disk."""

        return self.storage.list_interactions()

    def load_payload(self, message_id: str) -> Dict[str, Any]:
        """Load the stored payload for a given message identifier."""

        return self.storage.load_json(message_id, "payload.json")

    def load_receipt(self, message_id: str) -> Receipt:
        """Load and parse the stored receipt for a given message identifier."""

        data = self.storage.load_json(message_id, "receipt.json")
        return parse_receipt(data)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _persist_artifact(self, message_id: str, name: str, content: Any) -> Path:
        return self.storage.save_artifact(message_id, name, content)

    @staticmethod
    def _checksum_payload(payload: Dict[str, Any]) -> str:
        """Generate a reproducible checksum string for diagnostics."""

        normalised = json.dumps(payload, sort_keys=True)
        return f"sha256-mock-{abs(hash(normalised)) % 10 ** 12:012d}"

