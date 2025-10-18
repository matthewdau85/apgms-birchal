import Fastify from "fastify";
import { send } from "./as4/client";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "sbr" }));

app.post("/sbr/send", async (req, rep) => {
  if (process.env.NODE_ENV === "production") {
    return rep.code(404).send({ error: "not_found" });
  }

  const body = req.body as {
    payload?: string | Buffer;
    action?: string;
    orgId?: string;
  };

  if (
    !body ||
    typeof body.payload !== "string" ||
    typeof body.action !== "string" ||
    typeof body.orgId !== "string"
  ) {
    return rep.code(400).send({ error: "invalid_request" });
  }

  try {
    const result = await send(body.payload, {
      action: body.action,
      orgId: body.orgId,
    });

    return rep.code(202).send(result);
  } catch (error) {
    req.log.error(error);
    return rep.code(500).send({ error: "failed_to_send" });
  }
});

const port = Number(process.env.PORT ?? 3020);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`sbr dev server listening on http://${host}:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
