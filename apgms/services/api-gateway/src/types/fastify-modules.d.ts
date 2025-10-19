declare module "@fastify/helmet" {
  import type { FastifyPluginAsync } from "fastify";
  const plugin: FastifyPluginAsync;
  export default plugin;
}

declare module "@fastify/rate-limit" {
  import type { FastifyPluginAsync } from "fastify";
  const plugin: FastifyPluginAsync;
  export default plugin;
}
