import { eq, and, isNull, gt } from "drizzle-orm";
import type { AuthSession, LoginRequest, RegisterRequest } from "@starforge/shared";
import { db } from "../db/client.js";
import { profiles, refreshTokens, users } from "../db/schema.js";
import { env } from "../config.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from "../lib/tokens.js";
import { toUserPublic } from "../lib/mappers.js";
import { sendTransactionalEmail } from "../email/index.js";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function issueSession(user: typeof users.$inferSelect): Promise<AuthSession> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiryDate(),
  });

  return {
    user: toUserPublic(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL,
    },
  };
}

export async function register(input: RegisterRequest): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters", "WEAK_PASSWORD");
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw new AuthError("Email already registered", "EMAIL_TAKEN", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();

  if (!user) {
    throw new AuthError("Failed to create user", "CREATE_FAILED", 500);
  }

  await db.insert(profiles).values({
    userId: user.id,
    displayName: input.displayName?.trim() || email.split("@")[0] || null,
  });

  await sendTransactionalEmail({
    to: { email: user.email, name: input.displayName },
    subject: "Welcome to Starforge",
    text: `Your account (${user.email}) is ready. You can sign in anytime.`,
  });

  return issueSession(user);
}

export async function login(input: LoginRequest): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS", 401);
  }
  return issueSession(user);
}

export async function refresh(refreshToken: string): Promise<AuthSession> {
  const tokenHash = hashRefreshToken(refreshToken);
  const row = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });
  if (!row) {
    throw new AuthError("Invalid or expired refresh token", "INVALID_REFRESH", 401);
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
  });
  if (!user) {
    throw new AuthError("User not found", "USER_MISSING", 401);
  }

  return issueSession(user);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}
