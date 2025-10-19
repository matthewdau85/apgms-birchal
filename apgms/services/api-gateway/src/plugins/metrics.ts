import { FastifyPluginAsync } from "fastify";

let counters: Record<string, number> = {};

export const metricsPlugin: FastifyPluginAsync = async (app) => {
  app.get("/metrics", async (_req, reply) => {
    // Minimal Prometheus exposition
    const lines = Object.entries(counters).map(([name, value]) => `${name} ${value}`);
    reply.type("text/plain").send(lines.join("\n"));
  });

  app.decorate("metrics", {
    inc: (name: string, by = 1) => {
      counters[name] = (counters[name] ?? 0) + by;
    },
  });
};

declare module "fastify" {
  interface FastifyInstance {
    metrics: {
      inc: (name: string, by?: number) => void;
    };
  }
}
