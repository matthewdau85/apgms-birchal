import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const app = await buildApp();

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
