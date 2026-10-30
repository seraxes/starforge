import { asc, eq } from "drizzle-orm";
import type { UserPublic } from "@starforge/shared";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { toUserPublic } from "../lib/mappers.js";

export class UsersError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 404,
  ) {
    super(message);
    this.name = "UsersError";
  }
}

export async function listUsers(): Promise<UserPublic[]> {
  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  return rows.map(toUserPublic);
}

export async function getUserById(id: string): Promise<UserPublic> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) {
    throw new UsersError("User not found", "NOT_FOUND");
  }
  return toUserPublic(user);
}

export async function setUserRole(id: string, role: "user" | "admin"): Promise<UserPublic> {
  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!updated) {
    throw new UsersError("User not found", "NOT_FOUND");
  }
  return toUserPublic(updated);
}
