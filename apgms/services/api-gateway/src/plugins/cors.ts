import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredOrigins = isProduction
    ? (process.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ["http://localhost:5173"];

  await fastify.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.length === 0) {
        callback(null, false);
        return;
      }

      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("origin_not_allowed"), false);
    },
  });
};

export default corsPlugin;
