import type { ProfilePublic, UserPublic } from "@starforge/shared";
import type { ProfileRow, UserRow } from "../db/schema.js";

export function toUserPublic(user: UserRow): UserPublic {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toProfilePublic(profile: ProfileRow): ProfilePublic {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    updatedAt: profile.updatedAt.toISOString(),
  };
}
