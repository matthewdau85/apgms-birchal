import { buildApp } from "./app";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api-gateway listening");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
