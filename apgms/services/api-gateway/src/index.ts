import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const app = await buildApp();

app.ready(() => {
  app.log.info(app.printRoutes());
});

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
