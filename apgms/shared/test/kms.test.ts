import { strict as assert } from "node:assert";
import test from "node:test";
import { MockKMS, serializeEnvelope, deserializeEnvelope } from "../crypto/kms";

test("Backward verification survives rotation", async () => {
  const kms = new MockKMS();
  const payload = "sensitive-payload";
  const envelope = await kms.encrypt(payload);
  const firstKey = kms.getActiveKey();
  await kms.rotate();
  const afterRotate = kms.getActiveKey();
  assert.notEqual(afterRotate.id, firstKey.id);
  const decrypted = await kms.decrypt(envelope);
  assert.equal(decrypted, payload);
  const serialized = serializeEnvelope(envelope);
  const roundTrip = deserializeEnvelope(serialized);
  assert.deepEqual(roundTrip, envelope);
});
