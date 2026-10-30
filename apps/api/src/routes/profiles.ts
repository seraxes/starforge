import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import * as profilesService from "../services/profiles.service.js";
import { ProfilesError } from "../services/profiles.service.js";

const updateBody = z.object({
  displayName: z.string().min(1).max(80).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const profilesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profiles/me", async (request, reply) => {
    const auth = requireAuth(request);
    try {
      const profile = await profilesService.getProfile(auth.sub);
      return reply.send({ profile });
    } catch (err) {
      if (err instanceof ProfilesError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.patch("/profiles/me", async (request, reply) => {
    const auth = requireAuth(request);
    const body = updateBody.parse(request.body);
    try {
      const profile = await profilesService.updateProfile(auth.sub, body);
      return reply.send({ profile });
    } catch (err) {
      if (err instanceof ProfilesError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.get("/profiles/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const profile = await profilesService.getProfile(userId);
      return reply.send({ profile });
    } catch (err) {
      if (err instanceof ProfilesError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
};

export default profilesRoutes;
