import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { FastifyPluginAsync } from 'fastify';

export const openapiPlugin: FastifyPluginAsync = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'APGMS Gateway',
        description: 'API Gateway OpenAPI specification',
        version: '1.0.0',
      },
      servers: [{ url: '/' }],
      components: { securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }},
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    staticCSP: true,
  });

  // Expose raw spec at /openapi.json
  app.get('/openapi.json', async (_req, reply) => {
    const spec = await app.swagger();
    reply.type('application/json').send(spec);
  });
});

export default openapiPlugin;
