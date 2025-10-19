import { FastifyInstance } from "fastify";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = (req.body || {}) as { refreshToken?: string };
    if (!refreshToken) {
      return reply.code(400).send({ code: "BAD_REQUEST" });
    }

    // TODO: validate refresh token (e.g., against DB/Redis/jwt verify)
    // Issue new tokens (stub)
    const accessToken = "stub.access.token." + Date.now();
    const newRefresh = "stub.refresh.token." + Date.now();
    return reply.send({ accessToken, refreshToken: newRefresh });
  });
}
