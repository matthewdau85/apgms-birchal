const defaultTemplate = ({ title, specUrl }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background-color: #fafafa; }
    #swagger-ui { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        docExpansion: 'list',
        deepLinking: true,
      });
    };
  </script>
</body>
</html>`;

export default async function swaggerUiPlugin(fastify, opts = {}) {
  const routePrefix = opts.routePrefix ?? "/docs";
  const specUrl = opts.specUrl ?? "/openapi.json";
  const title = opts.uiConfig?.title ?? "API documentation";

  fastify.get(routePrefix, async (_req, reply) => {
    reply.type("text/html");
    return defaultTemplate({ title, specUrl });
  });
}
