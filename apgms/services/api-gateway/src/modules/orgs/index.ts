import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { orgService } from "../../services/org.service";
import { notFound } from "../../utils/errors";

const orgSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

const orgWithUsersSchema = orgSchema.extend({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().email(),
      createdAt: z.string(),
    }),
  ),
});

const listResponseSchema = z.object({
  orgs: z.array(orgSchema),
});

const getResponseSchema = z.object({
  org: orgWithUsersSchema,
});

const createOrgSchema = z.object({
  name: z.string().min(2),
});

const orgParamsSchema = z.object({
  orgId: z.string().min(1),
});

export async function registerOrgModule(app: FastifyInstance): Promise<void> {
  app.get(
    "/orgs",
    { preHandler: app.authenticate },
    async () => {
      const orgs = await orgService.listOrgs();
      return listResponseSchema.parse({ orgs });
    },
  );

  app.post(
    "/orgs",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = createOrgSchema.parse(request.body ?? {});
      const created = await orgService.createOrg(body.name);
      return reply.code(201).send(orgSchema.parse(created));
    },
  );

  app.get(
    "/orgs/:orgId",
    { preHandler: app.authenticate },
    async (request) => {
      const { orgId } = orgParamsSchema.parse(request.params ?? {});
      const org = await orgService.getOrgById(orgId);

      if (!org) {
        throw notFound("Organization not found");
      }

      return getResponseSchema.parse({ org });
    },
  );
}
