declare module "@fastify/swagger" {
  import { FastifyPluginAsync } from "fastify";

  interface SwaggerPluginOptions {
    route?: string;
    openapi?: Record<string, unknown>;
    sharedSpec?: unknown;
  }

  const plugin: FastifyPluginAsync<SwaggerPluginOptions>;
  export default plugin;
}

declare module "@fastify/swagger-ui" {
  import { FastifyPluginAsync } from "fastify";

  interface SwaggerUiPluginOptions {
    routePrefix?: string;
    specUrl?: string;
    uiConfig?: Record<string, unknown>;
  }

  const plugin: FastifyPluginAsync<SwaggerUiPluginOptions>;
  export default plugin;
}

declare module "@prisma/client" {
  class PrismaClient {
    constructor(...args: unknown[]);
    $disconnect(): Promise<void>;
    [key: string]: any;
  }

  export { PrismaClient };
}
