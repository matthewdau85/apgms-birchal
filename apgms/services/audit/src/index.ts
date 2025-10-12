import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import Fastify from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const SERVICE_NAME = "audit" as const;

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: SERVICE_NAME }));

type CommandEnvelope = {
  type?: string;
  payload?: unknown;
};

app.post("/commands", async (request, reply) => {
  const command = request.body as CommandEnvelope | undefined;

  request.log.info({ command }, "noop command handler");

  return reply.code(202).send({
    ok: true,
    service: SERVICE_NAME,
    handled: false,
  });
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
