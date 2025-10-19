import { FastifyPluginAsync } from "fastify";

const helmet: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-dns-prefetch-control", "off");
    reply.header("x-frame-options", "SAMEORIGIN");
    reply.header("x-download-options", "noopen");
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-xss-protection", "0");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cross-origin-opener-policy", "same-origin");
    reply.header("cross-origin-resource-policy", "same-origin");
    reply.header("origin-agent-cluster", "?1");
    return payload;
  });
};

export default helmet;
