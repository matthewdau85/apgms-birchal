import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";

import { send } from "./as4/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "sbr" }));

if (process.env.NODE_ENV !== "production") {
  app.post("/sbr/send", async (req, rep) => {
    try {
      const body = req.body as {
        payload?: string;
        action?: string;
        orgId?: string;
      };

      if (!body?.payload || !body?.action || !body?.orgId) {
        return rep.code(400).send({ error: "invalid_request" });
      }

      const result = await send(body.payload, {
        action: body.action,
        orgId: body.orgId,
      });

      return rep.code(202).send(result);
    } catch (error) {
      req.log.error(error);
      return rep.code(500).send({ error: "internal_error" });
    }
  });
}

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
