import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../plugins/auth.js";
import * as usersService from "../services/users.service.js";
import { UsersError } from "../services/users.service.js";

const roleBody = z.object({
  role: z.enum(["user", "admin"]),
});

const usersRoutes: FastifyPluginAsync = async (app) => {
  /** Admin list — stub for user management basics. */
  app.get("/users", async (request, reply) => {
    requireAdmin(request);
    const users = await usersService.listUsers();
    return reply.send({ users });
  });

  app.get("/users/:id", async (request, reply) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    try {
      const user = await usersService.getUserById(id);
      return reply.send({ user });
    } catch (err) {
      if (err instanceof UsersError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.patch("/users/:id/role", async (request, reply) => {
    requireAdmin(request);
    const { id } = request.params as { id: string };
    const body = roleBody.parse(request.body);
    try {
      const user = await usersService.setUserRole(id, body.role);
      return reply.send({ user });
    } catch (err) {
      if (err instanceof UsersError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
};

export default usersRoutes;
