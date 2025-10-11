"""Utilities for exporting the OpenAPI schema."""

from __future__ import annotations

import json
from pathlib import Path

from .app import create_app


def export_schema(destination: Path) -> Path:
    app = create_app()
    schema = app.openapi()
    destination.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    return destination


def export_cli(path: str = "openapi.json") -> None:
    destination = Path(path)
    export_schema(destination)
    print(f"OpenAPI schema exported to {destination.resolve()}")


__all__ = ["export_schema", "export_cli"]
