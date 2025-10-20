import { buildEnvelope, persistArtifacts, signEnvelope } from './as4.js';

console.log('[sbr] service bootstrapped with AS4 stubs');

// TODO: Wire AS4 client into message dispatcher
// TODO: Replace stubbed signing with hardware-backed implementation

export { buildEnvelope, signEnvelope, persistArtifacts };
