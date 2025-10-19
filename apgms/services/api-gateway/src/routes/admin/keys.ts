import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ensureAdmin } from "../../auth/ensure-admin";
import { getSigner, rotateKey } from "../../services/keys";

const rotateBodySchema = z.object({
  alias: z.string().min(1, "alias is required"),
});
type RotateBody = z.infer<typeof rotateBodySchema>;

const aliasParamsSchema = z.object({
  alias: z.string().min(1, "alias is required"),
});
type AliasParams = z.infer<typeof aliasParamsSchema>;

const adminKeyRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: RotateBody }>(
    "/keys/rotate",
    {
      preHandler: ensureAdmin,
    },
    async (request, reply) => {
      const { alias } = rotateBodySchema.parse(request.body);
      const signer = await rotateKey(alias);

      return reply.code(201).send({
        alias: signer.alias,
        version: signer.version,
        publicKey: signer.publicKey,
      });
    },
  );

  app.get<{ Params: AliasParams }>(
    "/keys/:alias",
    {
      preHandler: ensureAdmin,
    },
    async (request, reply) => {
      const { alias } = aliasParamsSchema.parse(request.params);
      const signer = await getSigner(alias);

      if (!signer) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send({
        alias: signer.alias,
        version: signer.version,
        publicKey: signer.publicKey,
      });
    },
  );
};

export default adminKeyRoutes;
