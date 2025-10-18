import Fastify, { type FastifyInstance } from "fastify";
import {
  allocationRoutes,
  auditRoutes,
  bankLinesRoutes,
  dashboardRoutes,
  policiesRoutes,
  type RoutePluginOptions,
} from "./routes";
import { getDefaultPrisma, type PrismaService } from "./services";

export interface AppOptions {
  prisma?: PrismaService;
  fastifyInstance?: FastifyInstance;
}

export const buildApp = (options: AppOptions = {}): FastifyInstance => {
  const prismaClient = options.prisma ?? getDefaultPrisma();
  const app = options.fastifyInstance ?? Fastify({ logger: false });
  const routeOptions: RoutePluginOptions = { prisma: prismaClient };

  app.register(dashboardRoutes, routeOptions);
  app.register(bankLinesRoutes, routeOptions);
  app.register(policiesRoutes, routeOptions);
  app.register(auditRoutes, routeOptions);
  app.register(allocationRoutes, routeOptions);

  return app;
};
