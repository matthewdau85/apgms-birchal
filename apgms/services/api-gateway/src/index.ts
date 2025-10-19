import { buildApp } from "./app";

const app = await buildApp();

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api-gateway started");
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
