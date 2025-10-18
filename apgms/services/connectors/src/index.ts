import { buildServer } from "./server.js";

async function start() {
  const server = await buildServer();
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);

  try {
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`Connectors service listening on port ${port}`);
  } catch (error) {
    server.log.error({ err: error }, "Failed to start connectors service");
    process.exit(1);
  }
}

void start();
