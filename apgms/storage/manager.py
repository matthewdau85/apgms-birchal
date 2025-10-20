"""Filesystem backed storage for generated artefacts."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable


class StorageManager:
    """Persist integration artefacts to a local directory."""

    def __init__(self, base_dir: str | Path | None = None, *, app_subdir: str | None = None) -> None:
        env_dir = os.environ.get("APGMS_STORAGE_DIR")
        base_path = Path(base_dir or env_dir or Path(__file__).resolve().parent / "artifacts")

        if app_subdir:
            base_path = base_path / app_subdir

        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Directory helpers
    # ------------------------------------------------------------------
    def interaction_path(self, interaction_id: str) -> Path:
        path = self.base_path / interaction_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_interactions(self) -> Iterable[str]:
        for child in self.base_path.iterdir():
            if child.is_dir():
                yield child.name

    # ------------------------------------------------------------------
    # Persist & load helpers
    # ------------------------------------------------------------------
    def save_artifact(self, interaction_id: str, name: str, content: Any) -> Path:
        target = self.interaction_path(interaction_id) / name

        if isinstance(content, (dict, list)):
            target.write_text(json.dumps(content, indent=2, sort_keys=True), encoding="utf-8")
        elif isinstance(content, bytes):
            target.write_bytes(content)
        else:
            target.write_text(str(content), encoding="utf-8")

        return target

    def load_text(self, interaction_id: str, name: str) -> str:
        path = self.interaction_path(interaction_id) / name
        return path.read_text(encoding="utf-8")

    def load_json(self, interaction_id: str, name: str) -> Dict[str, Any]:
        raw = self.load_text(interaction_id, name)
        return json.loads(raw)

