# SBR / AS4 Stub

The SBR integration in APGMS is under active development. To support local
testing without depending on the external ATO gateway, this repository
includes a lightweight stub that simulates the minimum message generation and
acknowledgement flows. The stub focuses on developer productivity rather than
protocol fidelity.

## Storage layout

Generated artefacts are written to `apgms/storage/artifacts/sbr` by default.
The base directory can be customised by setting the `APGMS_STORAGE_DIR`
environment variable. Each interaction creates a directory named after the
AS4 message identifier and contains the following files:

- `payload.json` – the submitted payload and envelope metadata.
- `receipt.json` – a mock SBR receipt acknowledging the payload.

These artefacts are ignored by git to keep the repository clean.

## Command line usage

The CLI is implemented in `apgms/integrations/sbr/cli.py` and can be executed
using the module runner. Example:

```bash
python -m apgms.integrations.sbr.cli generate example-payload.json
```

Commands:

- `generate <payload.json>` – create an AS4 message, persist the artefacts and
  print the receipt to stdout.
- `parse <receipt.json>` – parse a stored receipt and print the normalised
  representation.
- `list` – list the stored interaction/message identifiers.

## Programmatic usage

The `SBRStubClient` class offers a thin API for composing messages, persisting
them, and working with receipts. Example:

```python
from apgms.integrations.sbr import SBRStubClient

client = SBRStubClient()
receipt = client.submit_payload({"submission": "example"})
print(receipt.message_id)
```

The stub is intentionally deterministic and returns predictable receipts to
make assertions straightforward in unit tests.

