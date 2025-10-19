import type { FastifyInstance } from "fastify";
import { createAgreementSchema, remitSchema } from "../schemas/payto";
import { createAgreement } from "@apgms/payments/adapters/payto.mock";
import { getGateState, getGateId } from "@apgms/shared/gates";
import { recordAuditBlob } from "@apgms/shared/audit-blob";
import { getRedisClient } from "@apgms/services-shared/redis";
import { generateId } from "@apgms/shared/id";

const redis = getRedisClient();

type Role = "admin" | "payments" | string;

function requireRole(role: Role | undefined, allowed: Role[]): void {
  if (!role || !allowed.includes(role)) {
    const error = new Error("forbidden");
    (error as any).statusCode = 403;
    throw error;
  }
}

function requireOrgId(orgId: string | undefined): string {
  if (!orgId) {
    const error = new Error("missing_org_id");
    (error as any).statusCode = 400;
    throw error;
  }
  return orgId;
}

export async function registerPayToRoutes(app: FastifyInstance): Promise<void> {
  app.post("/payto/agreements", async (req, rep) => {
    try {
      const role = req.headers["x-role"] as Role | undefined;
      requireRole(role, ["admin"]);
      const body = createAgreementSchema.parse(req.body);
      const agreement = await createAgreement(body);
      return rep.code(201).send(agreement);
    } catch (err) {
      const status = (err as any).statusCode ?? 400;
      if (status >= 500) {
        req.log.error(err);
      }
      return rep.code(status).send({ error: (err as Error).message ?? "bad_request" });
    }
  });

  app.post("/payto/remit", async (req, rep) => {
    try {
      const role = req.headers["x-role"] as Role | undefined;
      requireRole(role, ["admin", "payments"]);
      const orgId = requireOrgId(req.headers["x-org-id"] as string | undefined);
      const body = remitSchema.parse(req.body);

      const gateState = getGateState(orgId);
      if (gateState !== "OPEN") {
        return rep.code(409).send({ error: "gate_closed" });
      }

      const jobId = generateId("job");
      const jobPayload = {
        jobId,
        orgId,
        agreementId: body.agreementId,
        amountCents: body.amountCents,
        currency: body.currency,
        queuedAt: new Date().toISOString(),
      };

      await redis.rpush(`remit:${orgId}`, JSON.stringify(jobPayload));

      await recordAuditBlob({
        kind: "payto.remit.queued",
        payloadJson: jobPayload,
        orgId,
        gateId: getGateId(orgId),
      });

      return rep.code(202).send({ status: "QUEUED", jobId });
    } catch (err) {
      const status = (err as any).statusCode ?? 400;
      if (status >= 500) {
        req.log.error(err);
      }
      return rep.code(status).send({ error: (err as Error).message ?? "bad_request" });
    }
  });
}
