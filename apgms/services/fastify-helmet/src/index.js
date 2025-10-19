const DEFAULT_HEADERS = {
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-Download-Options": "noopen",
  "X-XSS-Protection": "0",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const helmet = async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(DEFAULT_HEADERS)) {
      if (!reply.hasHeader(header)) {
        reply.header(header, value);
      }
    }
    return payload;
  });
};

export default helmet;
