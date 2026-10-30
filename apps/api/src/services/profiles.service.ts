import { eq } from "drizzle-orm";
import type { ProfilePublic, UpdateProfileRequest } from "@starforge/shared";
import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { toProfilePublic } from "../lib/mappers.js";

export class ProfilesError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 404,
  ) {
    super(message);
    this.name = "ProfilesError";
  }
}

export async function getProfile(userId: string): Promise<ProfilePublic> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
  if (!profile) {
    throw new ProfilesError("Profile not found", "NOT_FOUND");
  }
  return toProfilePublic(profile);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileRequest,
): Promise<ProfilePublic> {
  const [updated] = await db
    .update(profiles)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    throw new ProfilesError("Profile not found", "NOT_FOUND");
  }
  return toProfilePublic(updated);
}
