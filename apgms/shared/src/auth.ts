import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

export interface ApiKeyAuthPluginOptions {
  apiKey?: string;
  headerName?: string;
  exemptRoutes?: string[];
  exemptMethods?: string[];
}

const timingSafeEqual = (expected: string, actual: string): boolean => {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

export const apiKeyAuthPlugin: FastifyPluginAsync<ApiKeyAuthPluginOptions> = async (
  fastify,
  options,
) => {
  const {
    apiKey = process.env.API_GATEWAY_API_KEY ?? process.env.API_KEY,
    headerName = "x-api-key",
    exemptRoutes = ["/health"],
    exemptMethods = ["OPTIONS"],
  } = options;

  if (!apiKey) {
    throw new Error(
      "API key authentication requires an apiKey option or API_GATEWAY_API_KEY / API_KEY environment variable.",
    );
  }

  const normalizedHeader = headerName.toLowerCase();
  const routes = new Set(exemptRoutes);
  const methods = new Set(exemptMethods.map((method) => method.toUpperCase()));

  fastify.addHook("preHandler", async (request, reply) => {
    const routeUrl = request.routeOptions?.url;

    if ((routeUrl && routes.has(routeUrl)) || methods.has(request.method.toUpperCase())) {
      return;
    }

    const providedHeader = request.headers[normalizedHeader];
    const providedValue = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;

    if (typeof providedValue !== "string" || providedValue.length === 0) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing API key" });
    }

    if (!timingSafeEqual(apiKey, providedValue)) {
      return reply.code(403).send({ error: "forbidden", message: "Invalid API key" });
    }
  });
};
