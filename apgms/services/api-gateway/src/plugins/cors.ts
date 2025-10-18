import cors from "@fastify/cors";
import type { FastifyCorsOptions } from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const isProduction = process.env.NODE_ENV === "production";

  let options: FastifyCorsOptions;
  if (!isProduction) {
    options = {
      origin: ["http://localhost:5173"],
      credentials: true,
    };
  } else {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    options = {
      credentials: true,
      origin: (origin, cb) => {
        if (!origin) {
          cb(new Error("CORS origin not allowed"), false);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error("CORS origin not allowed"), false);
      },
    };
  }

  await fastify.register(cors, options);
};

export default corsPlugin;
