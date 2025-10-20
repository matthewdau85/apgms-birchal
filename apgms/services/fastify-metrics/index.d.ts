import type { FastifyPluginAsync } from "fastify";

declare const metricsPlugin: FastifyPluginAsync<{
  endpoint?: string;
}>;

export default metricsPlugin;
