import type { FastifyPluginAsync } from "fastify";

const kSkipOverride = Symbol.for("skip-override");
const kPluginMeta = Symbol.for("fastify.plugin-meta");

export const fastifyPlugin = <Options>(plugin: FastifyPluginAsync<Options>): FastifyPluginAsync<Options> => {
  const wrapped: FastifyPluginAsync<Options> = async (fastify, opts) => {
    await plugin(fastify, opts);
  };
  (wrapped as any)[kSkipOverride] = true;
  (wrapped as any)[kPluginMeta] = { name: plugin.name };
  return wrapped;
};
