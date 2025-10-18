# AS4 Evidence Bundle (Dev Stub)

This directory contains development stub assets that simulate an AS4 evidence bundle. They are intended to unblock integration work until the real exchange implementation is available.

## Flow Overview

1. Generate an AS4 request payload representing the message sent to the gateway.
2. Capture the corresponding receipt returned by the gateway.
3. Record the detached XML signature that binds the request/receipt pair.
4. Persist the artifacts to `evidence/as4/` so they can be published as CI artifacts for traceability.

## Profiles Covered

- **Hello World / Connectivity Check** – minimal AS4 exchange used only for validating plumbing between systems.
- **Dev Stub** – placeholder payloads that document the expected structure without containing real data.

## Next Steps

- Replace the stub generator in `services/sbr/src/as4/dev-stub.ts` with the real integration logic once the gateway is available.
- Expand the payload structures to match the mandated AS4 profile (headers, payload parts, security tokens).
- Automate validation of receipts/signatures against production certificate chains.
- Remove the `SBR_AS4_DEV` guard when production-grade evidence is ready.
