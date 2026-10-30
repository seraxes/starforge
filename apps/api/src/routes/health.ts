import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@starforge/shared";
import { sql } from "drizzle-orm";
import { APP_VERSION } from "../config.js";
import { db } from "../db/client.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (_request, reply) => {
    let database: HealthResponse["checks"]["database"] = "ok";
    try {
      await db.execute(sql`select 1`);
    } catch {
      database = "error";
    }

    const body: HealthResponse = {
      status: database === "ok" ? "ok" : "degraded",
      service: "starforge-api",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: { database },
    };

    return reply.code(database === "ok" ? 200 : 503).send(body);
  });
};

export default healthRoutes;
