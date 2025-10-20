import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";
import {
  AuditBlobMutationError,
  AuditBlobScope,
  InMemoryAuditBlobRepository,
} from "../src/audit-blob.js";
import { As4Client, As4Envelope, DetachedSignature } from "../src/as4.js";
import { SbrService } from "../src/service.js";

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDk3LPBVRPAEFve
e10R0JGqTZR8zRRKVtwSrc6X4o/8tuZewtmur4/Y/vlRadlF03UGsbSG+M1GF8tF
VntP2MAxHqLGufEy1ZEPWoLyr9dBq1Dd161ls8NURm0CSYolYWtwyaqN5dD72Hte
J21BmEFGkhAOwTHDMoJq4yv8BI71LqpRf3NCNWvwVe3f36GkEFIeNDSMZfQpaxGL
Rf8hbQ9v9eL+Cabq9iMKLW7XXjRna6+JmsTJyC+qgw3pVsjARe7RjkYehxMqjlMY
AUxj4iCONHUGgu7D7pTnmhKdeZoZ0Org++I/hlay0Gd5d3PpcFDIl1a+x/y8SMmc
9NsH4qknAgMBAAECggEAAM1Ti4PM5CZcvgeWCKMCv24ushFVnd6d/0nWhhzKL0Dm
Ak6bvRdHCMdy/hwYgFQRZrG6TsZ6Yc/H0Az2+Cj1nHR9E6xigNP7Hf59CphKlKGs
twvLJYsg+0zjswilIPkdpRPGvrurd8d3aY330XQ3aDGFxgW9rRLxRcm7WRljDVUw
k3E/idOkIiGzOgpwJx1KMDQ1ix3qz5Exk/8AW1JXQE5/+7o7NZdJVRHVgKu5oweb
oPRn1nfaCPn2luVkZEJWSWty4QKLTlKiAkbFZt1OhfsguPfRsp6vzg/J8SO4h9JS
BKsygLrmMDJU/ODkUPYFIdbsPuSal32WnzlMe7iDQQKBgQD1ErwZtoQ2klaeAWtU
24t8kTsRvrQ+0fcxHIzNIOSxtEH5JgJXGliqaMDoRIVLjnE6XnXhM2KPMDiS1k8u
D4J7TfLM1J8KAj+to7hg4ZaEd0589j7cVM9v9Svq3sqndlRaHSzfQbHACOhLcQ17
termAlLl7S2kxibtv2LxSM9iBwKBgQDvEO8vFwHDFw3DOED70Az+WAGhoCaIC71u
7N5bFpz9r84ilvzae1XGoi6EBZY4wV4J4cO4eziIdN/GB65jo+V21mZ62jJhMDqo
1KBjuiCzxpbjSyXjGMy0Rk6q9ETcnc4pdhgyLXcAPTFL8wtwfF4Ymq9QW4CCn3R4
wSz/rII34QKBgQDKlOgEYUk9Sw5qokW06Z6OJAcuDfQ1EZ9Ca5VAY3ZoJtd6Op8o
nVC53MnJtgpxgJe8ZiUPOUi5kGTTjG/7ZTq47qBMDV5CCcXVpUZeX1vquCybQ3qG
61xl8caR6gSfFUN5EjDrhASI91P+OL+qiaBY7YbVJY/bayj20oPZbBRxtQKBgEwA
gzniQ5IlKx/sK2Si0O6vRd1/T6CisteoAEzPFJvmH0+J1tsSqMNcXhNkv0xN1Tqp
BpMIwYFIPrfzSzKsMVAlezEFW0zgi1WPO2pZCvp8YQ3jnyjignmxfGMHAzlsBdXS
kICrSZDO43Q00Wcycqu5yZBvdpyQWvPk3gxuaHuhAoGAKEI0J7iIQZQ+2SUAGYug
gIinqGQox3vR4DIh09tHgv4eYi2TBDYrYST80jvieJobtjA408fb6jn5Gv+HLyqj
uYvnwObAAg7HZskFz6JvfqOx3Mr9sNLU6i9GJGmZ1VZ1paRXeSYwr0V9v4mov+S0
ERiDf/iqoZMxq+zI0PfLpN8=
-----END PRIVATE KEY-----`;

class EchoAs4Client implements As4Client {
  async send(envelope: As4Envelope, signature: DetachedSignature) {
    return {
      messageId: envelope.messageId,
      receivedAt: "2024-01-01T00:00:00.000Z",
      raw: {
        acknowledged: true,
        signature: signature.value,
      },
    };
  }
}

test("persists request and receipt as immutable audit blobs", async () => {
  const auditRepo = new InMemoryAuditBlobRepository();
  const service = new SbrService({
    auditRepo,
    signingKeyPem: PRIVATE_KEY,
    as4Client: new EchoAs4Client(),
  });

  const submission = await service.submitBAS({ orgId: "org-123", period: "2024-09" });
  assert.ok(submission.requestBlobId);
  assert.ok(submission.receiptBlobId);

  const detail = await service.getSubmissionDetail(submission.id);
  assert.ok(detail);
  assert.equal(detail!.artifacts.request.integrity.ok, true);
  assert.equal(detail!.artifacts.receipt.integrity.ok, true);
  assert.match(detail!.artifacts.request.sha256, /^[a-f0-9]{64}$/);
});

test("denies updates to an existing audit blob", async () => {
  const auditRepo = new InMemoryAuditBlobRepository();
  await auditRepo.create({
    scope: "sbr.bas" satisfies AuditBlobScope,
    referenceId: "submission-1",
    kind: "request",
    payload: "initial",
  });

  await assert.rejects(
    auditRepo.create({
      scope: "sbr.bas",
      referenceId: "submission-1",
      kind: "request",
      payload: "second",
    }),
    AuditBlobMutationError
  );
});

test("serves audit artifacts with integrity status", async () => {
  const auditRepo = new InMemoryAuditBlobRepository();
  const service = new SbrService({
    auditRepo,
    signingKeyPem: PRIVATE_KEY,
    as4Client: new EchoAs4Client(),
  });
  const submission = await service.submitBAS({ orgId: "org-456", period: "2024-10" });
  const app = buildServer({ service });

  const response = await app.inject({
    method: "GET",
    url: `/sbr/bas/${submission.id}`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    submission: {
      artifacts: {
        request: { integrity: { ok: boolean } };
        receipt: { integrity: { ok: boolean } };
      };
    };
  };
  assert.equal(body.submission.artifacts.request.integrity.ok, true);
  assert.equal(body.submission.artifacts.receipt.integrity.ok, true);
});

test("reports hash mismatches", async () => {
  const auditRepo = new InMemoryAuditBlobRepository();
  const service = new SbrService({
    auditRepo,
    signingKeyPem: PRIVATE_KEY,
    as4Client: new EchoAs4Client(),
  });
  const submission = await service.submitBAS({ orgId: "org-789", period: "2024-11" });

  const tampered = auditRepo.unsafeRecords.get(submission.requestBlobId);
  if (!tampered) {
    throw new Error("expected audit blob");
  }
  tampered.payload = `${tampered.payload} corrupted`;

  const app = buildServer({ service });
  const response = await app.inject({ method: "GET", url: `/sbr/bas/${submission.id}` });
  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    submission: {
      artifacts: {
        request: { integrity: { ok: boolean; expectedSha256: string; actualSha256: string } };
      };
    };
  };
  assert.equal(body.submission.artifacts.request.integrity.ok, false);
  assert.notEqual(
    body.submission.artifacts.request.integrity.actualSha256,
    body.submission.artifacts.request.integrity.expectedSha256
  );
});
