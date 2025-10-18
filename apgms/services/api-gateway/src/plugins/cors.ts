import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  const isProduction = nodeEnv === "production";

  let origins: string[] = [];
  if (isProduction) {
    const configured = process.env.ALLOWED_ORIGINS ?? "";
    origins = configured
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    if (origins.length === 0) {
      fastify.log.warn("ALLOWED_ORIGINS is empty; CORS will deny all browser origins");
    }
  } else {
    origins = ["http://localhost:5173"];
  }

  const allowed = new Set(origins);

  await fastify.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
};

export default corsPlugin;
