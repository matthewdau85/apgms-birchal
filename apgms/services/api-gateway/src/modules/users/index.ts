import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { userService } from "../../services/user.service";

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string(),
});

const usersResponseSchema = z.object({
  users: z.array(userSchema),
});

export async function registerUserModule(app: FastifyInstance): Promise<void> {
  app.get(
    "/users",
    {
      preHandler: app.authenticate,
    },
    async () => {
      const users = await userService.listUsers();
      return usersResponseSchema.parse({ users });
    },
  );
}
