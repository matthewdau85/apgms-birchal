# Data handling and retention

- Personal information classified per the APGMS data matrix and stored in encrypted PostgreSQL with TDE.
- GST and PAYGW records retain for 7 years in compliance with ATO requirements.
- TFN data encrypted in transit and at rest with access limited to the compliance group.
- Right-to-be-forgotten requests processed within 30 days via automation in `scripts/privacy/scrub.py`.
