import json
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "paygw_rules.json"
ALERTS_PATH = Path(__file__).resolve().parent.parent / "app" / "ops_alerts" / "paygw_alerts.json"


def _parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value)


def test_latest_paygw_ruleset_requires_ops_signoff():
    rules_payload = json.loads(DATA_PATH.read_text())
    alerts_payload = json.loads(ALERTS_PATH.read_text())

    rule_sets = rules_payload["rule_sets"]
    latest_ruleset = max(rule_sets, key=lambda item: _parse_date(item["effective_from"]))

    matching_alerts = [
        alert
        for alert in alerts_payload.get("alerts", [])
        if alert["ruleset_id"] == latest_ruleset["ruleset_id"]
    ]

    assert matching_alerts, "Latest PAYGW ruleset must have an ops alert"
    for alert in matching_alerts:
        assert alert["requires_sign_off"] is True
        assert alert["status"] in {"pending", "awaiting_signoff", "approved"}
