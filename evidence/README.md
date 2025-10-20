# Evidence Attachment Guidelines

Follow these steps when adding supporting evidence:

1. **Screenshots**
   - Save images as PNG or JPG.
   - Include a brief caption in the filename (e.g., `auth-mfa-dashboard.png`).
   - Reference the screenshot from relevant documentation using Markdown image syntax: `![Caption](../evidence/auth-mfa-dashboard.png)`.
2. **System Exports**
   - Export reports in open formats (CSV, JSON, PDF).
   - Store the raw export inside `/evidence/exports/` and note the generation date in accompanying docs.
3. **Log Configurations**
   - Store log collector or SIEM configuration files under `/evidence/log-configs/`.
   - Include a README in each subfolder describing the source system and retention schedule.
4. **Versioning & Integrity**
   - Commit evidence files to version control when permissible.
   - For sensitive data, store a hash in `hashes.txt` and reference the secured location instead of committing the raw file.

Always cross-link evidence from the related security artefacts and update reviewers when new evidence is added.
