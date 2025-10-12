import type { FastifyPluginAsync } from "fastify";

declare module "@fastify/rate-limit" {
  const plugin: FastifyPluginAsync<{ max: number; timeWindow: string | number }>;
  export default plugin;
}
