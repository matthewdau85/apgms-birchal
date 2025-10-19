import { FastifyPluginAsync } from "fastify";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "interest-cohort=()",
} as const;

const CSP_VALUE =
  "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3000";

const headersPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(header, value);
    }

    const contentType = reply.getHeader("content-type");
    if (typeof contentType === "string" && contentType.includes("text/html")) {
      reply.header("Content-Security-Policy", CSP_VALUE);
    }

    return payload;
  });
};

export default headersPlugin;
