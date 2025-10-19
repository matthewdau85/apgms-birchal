import { FastifyInstance } from "fastify";
import { getSigner, rotateKey } from "../../lib/kms.js";

export async function adminKeyRoutes(app: FastifyInstance) {
  app.post("/admin/keys/rotate", async (request, reply) => {
    const alias = (request.body as { alias?: string })?.alias;
    if (!alias) {
      return reply.status(400).send({ error: "validation_error", message: "alias required" });
    }
    const signer = await rotateKey(alias);
    return reply.status(201).send({ alias: signer.alias, keyId: signer.keyId, publicKey: signer.publicKey });
  });

  app.get("/admin/keys/:alias/pub", async (request, reply) => {
    const { alias } = request.params as { alias: string };
    const signer = await getSigner(alias, { createIfMissing: false });
    if (!signer) {
      return reply.status(404).send({ error: "not_found" });
    }
    return reply.send({ alias: signer.alias, keyId: signer.keyId, publicKey: signer.publicKey });
  });
}
