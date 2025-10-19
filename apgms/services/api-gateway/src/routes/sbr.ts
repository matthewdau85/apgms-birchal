import type { FastifyInstance } from "fastify";
import { ensureAdmin } from "../lib/admin";
import { send, receive } from "@apgms/sbr/as4.stub";

export default async function registerSbrRoutes(app: FastifyInstance) {
  app.post("/send", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const body = req.body as { payload?: Record<string, unknown> };
    if (!body || typeof body.payload !== "object" || body.payload === null) {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    const result = await send(body.payload);
    return reply.code(202).send(result);
  });

  app.get("/received", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const result = await receive();
    return reply.send(result);
  });
}
