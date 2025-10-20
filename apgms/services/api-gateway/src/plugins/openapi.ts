import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync, RouteOptions } from "fastify";

import reportsRoutes from "../routes/v1/reports";

type JsonSchema = Record<string, any>;

type OpenAPIDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    description: string;
    version: string;
  };
  tags: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
};

type OpenAPIOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: "query";
    description?: string;
    required: boolean;
    schema: JsonSchema;
  }>;
  responses?: Record<string, {
    description: string;
    content: {
      "application/json": {
        schema: JsonSchema;
      };
    };
  }>;
};

declare module "fastify" {
  interface FastifyInstance {
    swagger(): OpenAPIDocument;
  }
}

function buildDocument(): OpenAPIDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "APGMS API",
      description: "API surface for APGMS",
      version: "1.0.0",
    },
    tags: [
      {
        name: "Reports",
        description: "Generated analytics and business reports",
      },
    ],
    paths: {},
    components: {
      schemas: {},
    },
  };
}

function convertQuerystringToParameters(schema: JsonSchema): OpenAPIOperation["parameters"] {
  if (!schema || schema.type !== "object") {
    return [];
  }

  const properties = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);

  return Object.entries<JsonSchema>(properties).map(([name, definition]) => ({
    name,
    in: "query" as const,
    description: definition.description,
    required: required.has(name),
    schema: definition,
  }));
}

function convertResponses(responses: Record<string, JsonSchema>): OpenAPIOperation["responses"] {
  return Object.entries(responses).reduce<NonNullable<OpenAPIOperation["responses"]>>(
    (acc, [status, schema]) => {
      acc[status] = {
        description: schema.description ?? "Response",
        content: {
          "application/json": {
            schema,
          },
        },
      };
      return acc;
    },
    {},
  );
}

function registerFallbackSwagger(app: FastifyInstance, document: OpenAPIDocument) {
  app.decorate("swagger", () => document);

  app.addHook("onRoute", (route: RouteOptions) => {
    if (!route.schema) {
      return;
    }

    const methods = Array.isArray(route.method) ? route.method : [route.method];

    for (const method of methods) {
      const lowerMethod = method.toLowerCase();
      const pathItem = (document.paths[route.url] ??= {});
      const operation: OpenAPIOperation = (pathItem[lowerMethod] ??= {});

      if (route.schema.summary && !operation.summary) {
        operation.summary = route.schema.summary;
      }
      if (route.schema.description && !operation.description) {
        operation.description = route.schema.description;
      }
      if (route.schema.tags) {
        operation.tags = route.schema.tags as string[];
      }

      if (route.schema.querystring) {
        operation.parameters = convertQuerystringToParameters(
          route.schema.querystring as JsonSchema,
        );
      }

      if (route.schema.response) {
        operation.responses = convertResponses(route.schema.response as Record<string, JsonSchema>);
      }
    }
  });

  app.get("/docs", async (_, reply) => {
    return reply.type("text/html").send(
      "<html><body><h1>APGMS API</h1><p>OpenAPI document available at <a href=\"/openapi.json\">/openapi.json</a>.</p></body></html>",
    );
  });
}

const openapiPlugin: FastifyPluginAsync = async (app) => {
  const document = buildDocument();

  let swaggerPlugin: any;
  let swaggerUiPlugin: any;

  try {
    swaggerPlugin = (await import("@fastify/swagger")).default;
    swaggerUiPlugin = (await import("@fastify/swagger-ui")).default;
  } catch (error) {
    app.log.warn({ err: error }, "@fastify/swagger not available, using fallback OpenAPI generator");
  }

  if (swaggerPlugin) {
    await app.register(swaggerPlugin, {
      openapi: document,
    });

    if (swaggerUiPlugin) {
      await app.register(swaggerUiPlugin, {
        routePrefix: "/docs",
        uiConfig: {
          docExpansion: "list",
          deepLinking: false,
        },
        staticCSP: true,
      });
    }

    await app.register(reportsRoutes);

    app.get("/openapi.json", async () => app.swagger());
    return;
  }

  registerFallbackSwagger(app, document);

  await app.register(reportsRoutes);

  app.get("/openapi.json", async () => document);
};

export default fp(openapiPlugin, {
  name: "apgms-openapi-plugin",
});
