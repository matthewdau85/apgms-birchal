import type { FastifyPluginAsync, RouteOptions } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const API_TITLE = "APGMS API";
const API_VERSION = "1.0.0";

const normalizePath = (url: string) => url.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

const toArray = <T>(value: T | T[] | undefined, fallback: T) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined) {
    return [fallback];
  }
  return [value];
};

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const buildParameters = (schema: any, location: "path" | "query") => {
  if (!schema || typeof schema !== "object") {
    return [] as any[];
  }

  const required: string[] = Array.isArray(schema.required) ? schema.required : [];
  const properties = schema.properties ?? {};

  return Object.entries(properties).map(([name, definition]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.includes(name),
    schema: clone(definition),
  }));
};

const buildResponses = (responses: Record<string, unknown> | undefined) => {
  if (!responses) {
    return {
      200: {
        description: "Successful response",
      },
    };
  }

  const result: Record<string, unknown> = {};

  for (const [statusCode, schema] of Object.entries(responses)) {
    const status = String(statusCode);
    if (!schema || typeof schema !== "object") {
      result[status] = { description: "Response" };
      continue;
    }

    const responseSchema = clone(schema);
    const description = (responseSchema as any).description ?? "Response";
    delete (responseSchema as any).description;

    result[status] = {
      description,
      content: {
        "application/json": {
          schema: responseSchema,
        },
      },
    };
  }

  return result;
};

const buildRequestBody = (schema: unknown) => {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  return {
    required: true,
    content: {
      "application/json": {
        schema,
      },
    },
  };
};

const appendParameters = (target: any[], addition: any[]) => {
  for (const item of addition) {
    target.push(item);
  }
};

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  components: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

export const createOpenApiSpec = (): OpenApiSpec => ({
  openapi: "3.1.0",
  info: {
    title: API_TITLE,
    version: API_VERSION,
    description: "Programmatic contract for the APGMS platform",
  },
  servers: [{ url: "/" }],
  components: {},
  paths: {},
});

export const updateSpecFromRoute = (spec: OpenApiSpec, routeOptions: RouteOptions) => {
  const schema = routeOptions.schema ?? {};
  const methods = toArray(routeOptions.method as any, "GET");
  const rawPath =
    (routeOptions as any).url ??
    (routeOptions as any).path ??
    (routeOptions as any).routePath ??
    "";
  const openapiPath = normalizePath(rawPath);

  if (!openapiPath) {
    return;
  }

  spec.paths[openapiPath] ??= {};

  for (const method of methods) {
    const lower = String(method).toLowerCase();
    const operation: Record<string, unknown> = {
      summary: (schema as any).summary,
      description: (schema as any).description,
      tags: (schema as any).tags,
      responses: buildResponses((schema as any).response),
    };

    if ((schema as any).security) {
      operation.security = clone((schema as any).security);
    }

    const parameters: any[] = [];
    appendParameters(parameters, buildParameters((schema as any).params, "path"));
    appendParameters(parameters, buildParameters((schema as any).querystring, "query"));

    if (parameters.length) {
      operation.parameters = parameters;
    }

    const requestBody = buildRequestBody((schema as any).body);
    if (requestBody) {
      operation.requestBody = requestBody;
    }

    spec.paths[openapiPath][lower] = operation;
  }
};

interface OpenApiPluginOptions {
  spec?: OpenApiSpec;
}

const openapiPlugin: FastifyPluginAsync<OpenApiPluginOptions> = async (
  app,
  options,
) => {
  const spec = options?.spec ?? createOpenApiSpec();

  await app.register(swagger, {
    route: "/openapi.json",
    sharedSpec: spec,
    openapi: {
      info: spec.info,
      servers: spec.servers,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    specUrl: "/openapi.json",
    uiConfig: {
      title: `${API_TITLE} documentation`,
    },
  });
};

export default openapiPlugin;
