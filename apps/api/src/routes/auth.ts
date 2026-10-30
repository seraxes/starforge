import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { AuthError } from "../services/auth.service.js";
import { requireAuth } from "../plugins/auth.js";
import * as usersService from "../services/users.service.js";

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (request, reply) => {
    const body = registerBody.parse(request.body);
    try {
      const session = await authService.register(body);
      return reply.code(201).send(session);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginBody.parse(request.body);
    try {
      const session = await authService.login(body);
      return reply.send(session);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshBody.parse(request.body);
    try {
      const session = await authService.refresh(body.refreshToken);
      return reply.send(session);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = refreshBody.parse(request.body);
    await authService.logout(body.refreshToken);
    return reply.code(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const auth = requireAuth(request);
    const user = await usersService.getUserById(auth.sub);
    return reply.send({ user });
  });
};

export default authRoutes;
