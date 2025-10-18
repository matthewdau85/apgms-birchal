import type { FastifyPluginAsync } from "fastify";

const MINUTE_WINDOW_MS = 60_000;
const MINUTE_LIMIT = 100;
const SHORT_WINDOW_MS = 10_000;
const SHORT_LIMIT = 10;
const ONE_MIB = 1024 * 1024;

type RateWindow = {
  minute: number[];
  short: number[];
};

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const hits = new Map<string, RateWindow>();

  fastify.addHook("onRequest", async (request, reply) => {
    const contentLengthHeader = request.headers["content-length"];
    if (typeof contentLengthHeader === "string") {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > ONE_MIB) {
        reply.code(413).send({ error: "payload_too_large" });
        return;
      }
    }

    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const window = hits.get(ip) ?? { minute: [], short: [] };

    window.minute = window.minute.filter((timestamp) => now - timestamp < MINUTE_WINDOW_MS);
    if (window.minute.length >= MINUTE_LIMIT) {
      hits.set(ip, window);
      reply.code(429).send({ error: "rate_limit_exceeded" });
      return;
    }

    window.short = window.short.filter((timestamp) => now - timestamp < SHORT_WINDOW_MS);
    if (window.short.length >= SHORT_LIMIT) {
      hits.set(ip, window);
      reply.code(429).send({ error: "rate_limit_exceeded" });
      return;
    }

    window.minute.push(now);
    window.short.push(now);
    hits.set(ip, window);
  });
};

export default rateLimitPlugin;
