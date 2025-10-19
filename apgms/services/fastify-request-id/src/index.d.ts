import type { FastifyPluginAsync } from "fastify";

declare const requestId: FastifyPluginAsync<{
  header?: string;
  generator?: () => string;
}>;

export default requestId;
