const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export default async function swaggerPlugin(fastify, opts = {}) {
  const openapi = opts.openapi ?? {};
  const spec = opts.sharedSpec ?? {
    openapi: openapi.openapi ?? "3.1.0",
    info: openapi.info ?? { title: "Fastify API", version: "1.0.0" },
    servers: openapi.servers ?? [],
    components: openapi.components ?? {},
    paths: openapi.paths ?? {},
  };

  fastify.decorate("swagger", () => clone(spec));

  const routePath = opts.route ?? "/openapi.json";

  fastify.get(routePath, async () => spec);
}

const skipOverride = Symbol.for("skip-override");
const fastifyPluginSymbol = Symbol.for("fastify.plugin");

swaggerPlugin[skipOverride] = true;
swaggerPlugin[fastifyPluginSymbol] = true;
