import dotenv from "dotenv";

import { createApp, repoRootEnvPath } from "./app";
import { prisma } from "../../../shared/src/db";

dotenv.config({ path: repoRootEnvPath });

const app = await createApp({ logger: true, dependencies: { prisma } });

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.ready(() => {
  app.log.info(app.printRoutes());
});

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
