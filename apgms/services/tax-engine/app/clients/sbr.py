from __future__ import annotations

from typing import Any, Dict, Optional

import httpx


class SBRClient:
    """HTTP client adapter for interacting with the SBR submission service."""

    def __init__(self, base_url: str, *, timeout: float = 10.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def submit_liability(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Submit a liability payload to the SBR service."""

        async with httpx.AsyncClient(base_url=self._base_url, timeout=self._timeout) as client:
            response = await client.post("/submissions", json=payload)
            response.raise_for_status()
            return response.json()


__all__ = ["SBRClient"]
