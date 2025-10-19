import type { FastifyPluginAsync } from "fastify";

declare const helmet: FastifyPluginAsync<{
  global?: boolean;
}>;
export default helmet;
