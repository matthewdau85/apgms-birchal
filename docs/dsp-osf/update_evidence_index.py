#!/usr/bin/env python3
"""Update the DSP-OSF Evidence Index with links to CI artifacts.

The script scans a directory for common compliance artifacts and injects
Markdown links into the evidence table located between the `evidence-start`
and `evidence-end` markers in `evidence-index.md`.
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path
from typing import Iterable, List, Optional

EVIDENCE_FILE = Path(__file__).with_name("evidence-index.md")
START_MARKER = "<!-- evidence-start -->"
END_MARKER = "<!-- evidence-end -->"

ARTIFACT_PATTERNS = {
    "Supply Chain Security": ("Software Bill of Materials (SBOM)", ("sbom",)),
    "Vulnerability Management": ("Security Scan Log", ("scan", "sast", "zap")),
    "Performance & Resilience": ("k6 Load Test Report", ("k6", "load")),
}


def find_artifact(artifacts_dir: Path, tokens: Iterable[str]) -> Optional[Path]:
    """Return the first file whose name contains any of the tokens (case-insensitive)."""

    lower_tokens = [t.lower() for t in tokens]
    for path in sorted(artifacts_dir.rglob("*")):
        if path.is_file():
            name = path.name.lower()
            if any(token in name for token in lower_tokens):
                return path
    return None


def format_row(control: str, artifact_name: str, link_path: Optional[Path]) -> str:
    if link_path is None:
        return f"| {control} | {artifact_name} | _Pending link_ | _Pending_ |"

    repo_root = EVIDENCE_FILE.parents[2]
    try:
        relative_path = link_path.relative_to(repo_root)
    except ValueError:
        relative_path = link_path

    timestamp = dt.datetime.fromtimestamp(link_path.stat().st_mtime, tz=dt.timezone.utc)
    formatted_ts = timestamp.strftime("%Y-%m-%d %H:%M:%S %Z")
    return f"| {control} | [{artifact_name}]({relative_path.as_posix()}) | {relative_path.as_posix()} | {formatted_ts} |"


def build_table(artifacts_dir: Path) -> List[str]:
    rows: List[str] = ["| Control | Artifact | Location | Last Updated |", "| --- | --- | --- | --- |"]
    for control, (artifact_name, tokens) in ARTIFACT_PATTERNS.items():
        artifact_path = find_artifact(artifacts_dir, tokens)
        rows.append(format_row(control, artifact_name, artifact_path))
    return rows


def replace_table(content: str, new_rows: List[str]) -> str:
    if START_MARKER not in content or END_MARKER not in content:
        raise RuntimeError("Evidence markers not found in evidence index")

    pre, remainder = content.split(START_MARKER, 1)
    middle, post = remainder.split(END_MARKER, 1)

    table = "\n".join([START_MARKER, *new_rows, END_MARKER])
    # Ensure existing surrounding newlines are respected
    if not pre.endswith("\n"):
        pre += "\n"
    if not post.startswith("\n"):
        post = "\n" + post
    return pre + table + post


def main() -> None:
    parser = argparse.ArgumentParser(description="Update DSP-OSF evidence index with artifact links")
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        required=True,
        help="Path to the directory containing CI artifacts (e.g. SBOM, scan logs, k6 reports)",
    )
    args = parser.parse_args()

    artifacts_dir = args.artifacts_dir
    if not artifacts_dir.exists() or not artifacts_dir.is_dir():
        raise SystemExit(f"Artifacts directory '{artifacts_dir}' does not exist or is not a directory")

    content = EVIDENCE_FILE.read_text(encoding="utf-8")
    table_rows = build_table(artifacts_dir)
    updated = replace_table(content, table_rows)
    EVIDENCE_FILE.write_text(updated, encoding="utf-8")


if __name__ == "__main__":
    main()
