const bearerSecurityScheme = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "APGMS API Gateway",
    version: "0.1.0",
    description: "Minimal API gateway exposing auth and banking endpoints.",
  },
  components: {
    securitySchemes: {
      bearerAuth: bearerSecurityScheme,
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      TokenResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          tokenType: { type: "string" },
          expiresIn: { type: "integer", format: "int32" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string" },
        },
      },
      BankLine: {
        type: "object",
        properties: {
          id: { type: "string" },
          orgId: { type: "string" },
          date: { type: "string", format: "date-time" },
          amount: { type: "string" },
          payee: { type: "string" },
          desc: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateBankLineRequest: {
        type: "object",
        required: ["date", "amount", "payee", "desc"],
        properties: {
          orgId: { type: "string" },
          date: { type: "string", format: "date-time" },
          amount: { type: "number" },
          payee: { type: "string" },
          desc: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
          },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "JWT token pair",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TokenResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
          },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Refresh JWT tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Refreshed JWT token pair",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TokenResponse" },
              },
            },
          },
          "401": {
            description: "Refresh token invalid",
          },
        },
      },
    },
    "/users": {
      get: {
        summary: "List users in the organisation",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Users listed",
          },
          "403": {
            description: "Missing role",
          },
        },
      },
    },
    "/bank-lines": {
      get: {
        summary: "List bank lines",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Bank lines returned",
          },
        },
      },
      post: {
        summary: "Create a bank line",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBankLineRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Bank line created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BankLine" },
              },
            },
          },
        },
      },
    },
  },
};

export const swaggerUiHtml = (documentUrl: string) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>API Gateway Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin="anonymous"></script>
    <script>
      window.addEventListener('load', () => {
        SwaggerUIBundle({
          url: '${documentUrl}',
          dom_id: '#swagger-ui',
        });
      });
    </script>
  </body>
</html>`;
