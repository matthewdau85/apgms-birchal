import type { FastifyInstance } from "fastify";
import { verifySignature } from "../plugins/webhook-signing.js";

export default async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  app.removeContentTypeParser("application/json");
  app.removeContentTypeParser("application/*+json");

  const captureRawBody = (req: any, body: Buffer, done: (err: Error | null, value?: unknown) => void) => {
    req.rawBody = body;
    done(null, body);
  };

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, captureRawBody);
  app.addContentTypeParser("application/*+json", { parseAs: "buffer" }, captureRawBody);
  app.addContentTypeParser("*", { parseAs: "buffer" }, (req, body, done) => {
    (req as any).rawBody = body;
    done(null, body);
  });

  app.post("/webhooks/payto", async (req, rep) => {
    const verification = await verifySignature(req as any);
    if (!verification.ok) {
      return rep.code(verification.statusCode).send({ error: verification.error });
    }

    return rep.code(202).send({ status: "accepted" });
  });
}

