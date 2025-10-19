import type { FastifyPluginAsync } from "fastify";
import { getSigner, rotateKey } from "../../lib/kms";

const adminKeysRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, rep) => {
    const roleHeader = req.headers["x-role"];
    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
    if (role !== "admin") {
      return rep.code(403).send({ error: "forbidden" });
    }
  });

  app.post("/admin/keys/rotate", async (req, rep) => {
    const body = req.body as { alias?: string } | undefined;
    const alias = body?.alias?.trim();
    if (!alias) {
      return rep.code(400).send({ error: "alias_required" });
    }

    const record = await rotateKey(alias);
    return rep
      .code(201)
      .send({ alias: record.alias, version: record.version, publicKey: record.publicKey });
  });

  app.get("/admin/keys/:alias/pub", async (req, rep) => {
    const params = req.params as { alias?: string } | undefined;
    const alias = params?.alias?.trim();
    if (!alias) {
      return rep.code(400).send({ error: "alias_required" });
    }

    const signer = await getSigner(alias);
    return { alias, version: signer.version, publicKey: signer.publicKey };
  });
};

export default adminKeysRoutes;
