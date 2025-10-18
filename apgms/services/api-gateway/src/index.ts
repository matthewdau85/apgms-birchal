import { buildApp } from "./app";

const bootstrap = async () => {
  const { app, config } = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info({ port: config.port, host: config.host }, "API gateway listening");
  } catch (error) {
    app.log.error({ err: error }, "Failed to start API gateway");
    process.exit(1);
  }
};

await bootstrap();
