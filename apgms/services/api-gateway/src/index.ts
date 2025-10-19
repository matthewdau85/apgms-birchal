import { buildApp } from "./app";
import { setupGracefulShutdown } from "./shutdown";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const removeSignalHandlers = setupGracefulShutdown(app);

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  removeSignalHandlers();
  process.exit(1);
});
