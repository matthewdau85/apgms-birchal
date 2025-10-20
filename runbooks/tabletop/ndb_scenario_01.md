# NDB Tabletop Scenario 01: Webhook Secret Leak and Replay Attacks

## Quick-Start Checklist
- [ ] Send calendar invite and circulate this scenario 48 hours in advance.
- [ ] Assign facilitator, scribe, and decision lead.
- [ ] Prepare copies of the [Incident Communications Templates](../../apgms/docs/comms_templates.md) and regulatory contact list.
- [ ] Confirm access to webhook delivery dashboards and key logs.
- [ ] Set a visible timer for a 30-minute exercise.

## Scenario Overview
An attacker exfiltrated the production webhook signing secret during a supply-chain compromise of a third-party deploy runner. Within the last 24 hours they replayed previously captured webhook payloads to partner endpoints, causing fraudulent account state changes. The objective of this tabletop is to walk through notification obligations under the Notifiable Data Breach (NDB) scheme while containing continued replay activity.

## Participants
- Facilitator: Oversees timeline prompts and keeps the group on schedule.
- Scribe: Records decisions in the shared decision log.
- Incident Commander: Coordinates technical response and approves actions.
- Comms Lead: Coordinates customer, partner, and regulator messaging.
- Legal/Privacy Lead: Advises on NDB notification thresholds and timing.

## Timeline Prompts
**T0 (00:00)** – PagerDuty alert for anomalous webhook traffic triggered. Security analyst joins and notes signature mismatches across multiple partners.

**T+5 (00:05)** – Vendor support notifies us that their artifact server was breached last week. Initial containment efforts begin; webhook secret rotation will take ~45 minutes.

**T+10 (00:10)** – Partners report seeing legitimate-looking payloads toggling feature flags for high-value customers. Need to decide whether to pause webhook deliveries.

**T+15 (00:15)** – Customer Support escalates three tickets from affected customers asking why account state changed. Media inquiry received referencing social media chatter about "compromised automations".

**T+20 (00:20)** – Engineering confirms replay came from attacker IPs across multiple regions. Replacement secret deployed but propagation to all services will take additional 20 minutes. Risk that attackers continue replaying cached payloads.

**T+25 (00:25)** – Legal notes potential NDB trigger because webhook payloads contain personal information. Must decide on notification timeline and evidence collection to support regulator briefing.

**T+30 (00:30)** – Exercise debrief: capture lessons learned, next steps, and update incident response plans.

## Decision Log Template
| Time | Decision | Owner | Rationale | Follow-up |
| ---- | -------- | ----- | --------- | --------- |
|      |          |       |           |           |

## Communications References
- Customer + partner emails: see [Customer Impact Comms Template](../../apgms/docs/comms_templates.md#customer-impact-notice).
- Regulatory notification letter: see [Regulator Brief Template](../../apgms/docs/comms_templates.md#regulator-brief).
- Internal updates: use Slack template in [Internal Comms Guide](../../apgms/docs/comms_templates.md#internal-slack-update).

## Facilitator Notes
- Keep emphasis on when the NDB scheme requires notifying the OAIC and affected individuals.
- Encourage team to identify additional data sources (e.g., CDN logs) to validate scope.
- Capture ownership for post-incident hardening tasks, especially eliminating shared secrets and adopting per-partner signing keys.
