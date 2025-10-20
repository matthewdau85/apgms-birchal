"""Command line interface for interacting with the SBR stub."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable

from .stub import SBRStubClient


def _load_json_from_file(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _write_json(data: Dict[str, Any]) -> None:
    print(json.dumps(data, indent=2, sort_keys=True))


def _list_interactions(interactions: Iterable[str]) -> None:
    for interaction in sorted(interactions):
        print(interaction)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Interact with the SBR stub")
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate_parser = subparsers.add_parser(
        "generate", help="Generate an AS4 payload and receipt"
    )
    generate_parser.add_argument("payload", type=Path, help="Path to a JSON payload file")

    parse_parser = subparsers.add_parser("parse", help="Parse a receipt file")
    parse_parser.add_argument("receipt", type=Path, help="Path to a stored receipt")

    subparsers.add_parser("list", help="List stored interaction identifiers")

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    client = SBRStubClient()

    if args.command == "generate":
        payload = _load_json_from_file(args.payload)
        receipt = client.submit_payload(payload)
        _write_json(receipt.to_dict())
    elif args.command == "parse":
        raw = args.receipt.read_text(encoding="utf-8")
        receipt = client.parse_receipt(raw)
        _write_json(receipt.to_dict())
    elif args.command == "list":
        _list_interactions(client.list_interactions())
    else:  # pragma: no cover - defensive
        parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()

