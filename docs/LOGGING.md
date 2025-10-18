# Logging

## Security events

Security-sensitive decisions are recorded through `logSecurity(event, details)` in `services/api-gateway`. Each record is a single line of JSON with the following shape:

```
{
  "ts": "2024-03-22T10:15:30.123Z",
  "event": "auth_failure",
  "decision": "deny",
  "route": "/bank-lines",
  "principal": "user-123",   // optional
  "orgId": "org-456",        // optional
  "ip": "203.0.113.42",      // optional
  "reason": "invalid_rpt"     // optional
}
```

### Destinations

* If `SECURITY_LOG_PATH` is set, entries are appended to the file at that path. The directory will be created when the logger is first used.
* When the environment variable is absent, entries fall back to `stdout` so that container runtimes can capture the data.

### Event catalogue

| Event | Trigger | Decision semantics |
| --- | --- | --- |
| `auth_failure` | Authentication challenge failed (missing or invalid bearer token). | `deny` |
| `replay_rejected` | Replay protection detected a reused nonce on `/bank-lines`. | `deny` |
| `rpt_verification_failed` | Resource protection token failed verification. | `deny` |

Additional security decisions should reuse these event names (or extend the set) so that downstream tooling can rely on a stable taxonomy.

### Levels and fan-out

Security log entries are emitted at the `info` level for Fastify, but they are isolated into their own sink so downstream collectors can index them separately from request logs. The normalized structure allows shipping the same payload to SIEM tooling without re-shaping.

### Retention

Security logs must be retained for at least 400 days. For local development this simply means keeping the file that `SECURITY_LOG_PATH` points to. In shared environments, configure log shipping so that the retention policy is enforced centrally.
