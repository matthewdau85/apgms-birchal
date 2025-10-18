import { createApp } from "./app.js";
import { config } from "./config.js";

const app = await createApp();

const host = "0.0.0.0";

try {
  await app.listen({ port: config.port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
