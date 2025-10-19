import type { FastifyReply, FastifyRequest } from "fastify";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "local-admin";

export function ensureAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    reply.code(403);
    throw new Error("admin_required");
  }
}

export function isAdmin(token: unknown) {
  return token === ADMIN_TOKEN;
}
