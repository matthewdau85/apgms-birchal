# OAIC NDB Response Runbook

1. **Triage incident**
   - Confirm scope and impacted personal data classes.
   - Engage privacy officer and product owner within 2 hours.
2. **Containment and eradication**
   - Disable affected integrations (PayTo gate to CLOSED).
   - Capture evidence artefacts (AuditBlob IDs, OTEL trace export).
3. **Assessment**
   - Use privacy export endpoint to assemble affected records.
   - Complete OAIC assessment template (Appendix A) within 24 hours.
4. **Notification preparation**
   - Draft customer notice using template in Appendix B.
   - Populate OAIC NDB form with incident ID, containment steps, contact details.
5. **Regulator submission**
   - Privacy officer submits to OAIC via portal within 30 days or sooner if high risk.
   - Record submission ID in compliance tracker.
6. **Post-incident actions**
   - Run redteam suite to verify controls.
   - Review SBOM and update allowlist if required.
   - Schedule lessons-learned with engineering and legal.

## Templates

- **Appendix A**: `../privacy/assessment-template.md`
- **Appendix B**: `../privacy/notification-template.md`
