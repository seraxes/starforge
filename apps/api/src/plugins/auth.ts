import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "./fp.js";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AccessTokenPayload | null;
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("authUser", null);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    request.authUser = null;
    const token = extractBearer(request.headers.authorization);
    if (!token) return;
    try {
      request.authUser = verifyAccessToken(token);
    } catch {
      request.authUser = null;
    }
  });
};

export default fp(authPlugin, { name: "starforge-auth" });

export function requireAuth(request: FastifyRequest): AccessTokenPayload {
  if (!request.authUser) {
    const err = new Error("Authentication required") as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  return request.authUser;
}

export function requireAdmin(request: FastifyRequest): AccessTokenPayload {
  const user = requireAuth(request);
  if (user.role !== "admin") {
    const err = new Error("Admin role required") as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
  return user;
}
