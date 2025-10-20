"""Tests for the SBR stub integration helpers."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from apgms.integrations.sbr import SBRStubClient, build_receipt
from apgms.storage import StorageManager


class SBRStubClientTests(unittest.TestCase):
    def setUp(self) -> None:  # noqa: D401 - standard unittest hook
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.temp_path = Path(self._tmp.name)

    def _create_client(self) -> SBRStubClient:
        storage = StorageManager(base_dir=self.temp_path)
        return SBRStubClient(storage=storage)

    def test_submit_payload_persists_artifacts(self) -> None:
        client = self._create_client()
        payload = {"type": "test", "value": 42}

        receipt = client.submit_payload(
            payload,
            message_id="msg-123",
            conversation_id="conv-abc",
        )

        self.assertEqual(receipt.message_id, "msg-123")
        self.assertEqual(receipt.conversation_id, "conv-abc")
        self.assertEqual(receipt.status, "ACCEPTED")

        interaction_dir = self.temp_path / "msg-123"
        self.assertTrue(interaction_dir.exists())
        payload_path = interaction_dir / "payload.json"
        receipt_path = interaction_dir / "receipt.json"
        self.assertTrue(payload_path.exists())
        self.assertTrue(receipt_path.exists())

        stored_payload = json.loads(payload_path.read_text(encoding="utf-8"))
        self.assertEqual(stored_payload["payload"], payload)

        stored_receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        self.assertEqual(stored_receipt["message_id"], "msg-123")

        interactions = list(client.list_interactions())
        self.assertIn("msg-123", interactions)

    def test_parse_receipt_from_string(self) -> None:
        client = self._create_client()
        receipt = build_receipt(
            "msg-999",
            "conv-999",
            status="REJECTED",
            details={"error": "invalid data"},
        )

        parsed = client.parse_receipt(receipt.to_json())

        self.assertEqual(parsed.message_id, "msg-999")
        self.assertEqual(parsed.status, "REJECTED")
        self.assertEqual(parsed.details["error"], "invalid data")


if __name__ == "__main__":  # pragma: no cover - convenience
    unittest.main()

