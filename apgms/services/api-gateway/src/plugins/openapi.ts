import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";

declare module "fastify" {
  interface FastifyInstance {
    jsonSchemaFromZod<T extends ZodTypeAny>(
      schema: T,
      name?: string,
    ): Record<string, unknown>;
  }
}

type RouteSchema = {
  summary?: string;
  description?: string;
  tags?: string[];
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  response?: Record<string, any>;
};

const jsonSchemaFromZodInternal = (
  schema: ZodTypeAny,
  name?: string,
): Record<string, unknown> => {
  const buildSchema = (current: ZodTypeAny): Record<string, unknown> => {
    const def = (current as any)?.def;
    if (!def) {
      return {};
    }

    if (def.type === "optional") {
      return buildSchema(def.innerType);
    }

    switch (def.type) {
      case "object": {
        const rawShape = typeof def.shape === "function" ? def.shape() : def.shape;
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        for (const key of Object.keys(rawShape)) {
          const child = rawShape[key];
          const unwrapped = unwrap(child);
          properties[key] = buildSchema(unwrapped.schema);
          if (!unwrapped.optional) {
            required.push(key);
          }
        }
        const objectSchema: Record<string, unknown> = {
          type: "object",
          properties,
        };
        if (required.length > 0) {
          objectSchema.required = required;
        }
        return objectSchema;
      }
      case "string": {
        const json: Record<string, unknown> = { type: "string" };
        const checks = def.checks ?? [];
        for (const check of checks) {
          const pattern = check?._zod?.def?.pattern;
          if (pattern instanceof RegExp) {
            json.pattern = pattern.source;
          }
        }
        return json;
      }
      case "enum": {
        return {
          type: "string",
          enum: def.values,
        };
      }
      default:
        return {};
    }
  };

  const unwrap = (
    current: ZodTypeAny,
  ): { schema: ZodTypeAny; optional: boolean } => {
    let node = current;
    let optional = false;
    while (true) {
      const def = (node as any)?.def;
      if (!def) {
        break;
      }
      if (def.type === "optional") {
        optional = true;
        node = def.innerType;
        continue;
      }
      break;
    }
    return { schema: node, optional };
  };

  const schemaJson = buildSchema(schema);
  if (name) {
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: name,
      ...schemaJson,
    };
  }
  return schemaJson;
};

const swaggerPlugin = async (
  app: FastifyInstance,
  opts: { info?: Record<string, any> },
) => {
  const collectedRoutes: Array<{
    url: string;
    method: string;
    schema?: RouteSchema;
  }> = [];

  app.addHook("onRoute", (routeOptions) => {
    const method = Array.isArray(routeOptions.method)
      ? routeOptions.method[0]
      : routeOptions.method;
    if (!method) return;
    collectedRoutes.push({
      url: routeOptions.url,
      method: method.toLowerCase(),
      schema: routeOptions.schema as RouteSchema | undefined,
    });
  });

  app.decorate("swagger", () => {
    const info = opts.info ?? {
      title: "API Gateway",
      version: "1.0.0",
    };
    const paths: Record<string, any> = {};

    for (const route of collectedRoutes) {
      const pathKey = route.url.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      if (!paths[pathKey]) {
        paths[pathKey] = {};
      }
      const schema = route.schema ?? {};
      const responses: Record<string, any> = {};
      if (schema.response) {
        for (const [status, responseSchema] of Object.entries(schema.response)) {
          if (responseSchema && typeof responseSchema === "object") {
            if ((responseSchema as any).content) {
              responses[status] = {
                description: (responseSchema as any).description ?? "",
                content: (responseSchema as any).content,
              };
            } else {
              responses[status] = {
                description: "",
                content: {
                  "application/json": {
                    schema: responseSchema,
                  },
                },
              };
            }
          }
        }
      } else {
        responses["200"] = { description: "" };
      }

      const parameters = buildParameters(schema.params as any);
      const requestBody = schema.body
        ? {
            required: true,
            content: {
              "application/json": { schema: schema.body },
            },
          }
        : undefined;

      paths[pathKey][route.method] = {
        summary: schema.summary,
        description: schema.description,
        tags: schema.tags,
        parameters: parameters.length > 0 ? parameters : undefined,
        requestBody,
        responses,
      };
    }

    return {
      openapi: "3.0.3",
      info,
      paths,
    };
  });
};

const swaggerUiPlugin = async (
  app: FastifyInstance,
  opts: { routePrefix?: string },
) => {
  const routePrefix = opts.routePrefix ?? "/docs";
  const specUrl = `/openapi.json`;

  app.get(routePrefix, { schema: { hide: true } }, async (_req, reply) => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>API Gateway Docs</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      pre { background: #f6f8fa; padding: 1rem; border-radius: 8px; overflow: auto; }
    </style>
  </head>
  <body>
    <h1>API Gateway OpenAPI</h1>
    <p>The canonical OpenAPI document is available at <a href="${specUrl}">${specUrl}</a>.</p>
    <pre id="spec">Loading OpenAPI document…</pre>
    <script>
      fetch('${specUrl}').then(function(res){ return res.json(); }).then(function(spec){
        document.getElementById('spec').textContent = JSON.stringify(spec, null, 2);
      }).catch(function(err){
        document.getElementById('spec').textContent = 'Failed to load OpenAPI document: ' + err;
      });
    </script>
  </body>
</html>`;
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(html);
  });
};

const openApiPlugin = async (app: FastifyInstance) => {
  app.decorate("jsonSchemaFromZod", (schema: ZodTypeAny, name?: string) =>
    jsonSchemaFromZodInternal(schema, name),
  );

  await swaggerPlugin(app, {
    info: {
      title: "APGMS API Gateway",
      version: "1.0.0",
      description: "API Gateway OpenAPI specification",
    },
  });

  await swaggerUiPlugin(app, {
    routePrefix: "/docs",
  });

  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
};

function buildParameters(schema?: Record<string, unknown>) {
  if (!schema || schema.type !== "object") {
    return [];
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = schema.properties ?? {};
  return Object.keys(properties).map((key) => ({
    name: key,
    in: "path",
    required: required.includes(key),
    schema: properties[key],
  }));
}

export default openApiPlugin;
export { jsonSchemaFromZodInternal };
