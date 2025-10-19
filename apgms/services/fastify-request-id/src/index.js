import { randomUUID } from "node:crypto";

const defaultGenerator = () => randomUUID();

const requestId = async (fastify, opts = {}) => {
  const headerName = (opts.header ?? "request-id").toLowerCase();
  const generator = typeof opts.generator === "function" ? opts.generator : defaultGenerator;

  fastify.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers[headerName];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const id = typeof candidate === "string" && candidate.length > 0 ? candidate : generator();
    request.id = id;
    reply.header(headerName, id);
  });
};

export default requestId;
