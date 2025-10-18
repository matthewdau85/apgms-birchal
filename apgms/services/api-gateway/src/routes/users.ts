import { FastifyInstance } from "fastify";
import { Services } from "../services";
import { AppConfig } from "../config/env";
import { userListResponseJsonSchema, userListResponseSchema } from "../schemas/user";

export const registerUserRoutes = (app: FastifyInstance, services: Services, config: AppConfig) => {
  app.get(
    "/users",
    {
      preHandler: app.authorize(config.requiredRoles.userRead),
      schema: {
        response: {
          200: userListResponseJsonSchema,
        },
      },
    },
    async () => {
      const users = await services.userService.listUsers();
      return userListResponseSchema.parse({
        users: users.map((user) => ({
          email: user.email,
          orgId: user.orgId,
          createdAt: user.createdAt.toISOString(),
        })),
      });
    },
  );
};
