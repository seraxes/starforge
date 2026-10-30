/** Shared contracts between Starforge API and web clients. */

export type Role = "user" | "admin";

export interface UserPublic {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePublic {
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthSession {
  user: UserPublic;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  checks: {
    database: "ok" | "error";
  };
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
