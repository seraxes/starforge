import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./config.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import profilesRoutes from "./routes/profiles.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(profilesRoutes);

  app.setErrorHandler((err: unknown, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      });
    }

    const e = err as { statusCode?: number; code?: string; message?: string };
    const statusCode = typeof e.statusCode === "number" ? e.statusCode : 500;
    const code = e.code ?? "INTERNAL_ERROR";
    const message = typeof e.message === "string" ? e.message : "Unknown error";

    if (statusCode >= 500) {
      app.log.error(err);
    }

    return reply.code(statusCode).send({
      error: code,
      message: statusCode >= 500 ? "Internal server error" : message,
    });
  });

  return app;
}
