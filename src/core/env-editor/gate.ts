import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'

import { auth } from '@/core/auth'
import { requireDeveloperAdmin } from '@/core/auth/admin'
import { shouldUseSecureCookies } from '@/core/security/secure-cookies'

export const ENV_EDITOR_GATE_COOKIE = 'sf_env_gate'

/** Gate lifetime after successful password confirm (15 minutes). */
export const ENV_EDITOR_GATE_TTL_SEC = 15 * 60

/** Shown on unlock when the server cannot sign the gate cookie. */
export const ENV_EDITOR_GATE_SECRET_MISSING =
  'BETTER_AUTH_SECRET is missing from the server environment. Add it to `.env` (same secret Better Auth already needs), then restart next dev / the Node process.'

type GatePayload = {
  userId: string
  exp: number
}

function gateSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || !secret.trim()) return null
  return secret
}

function signPayload(payload: GatePayload): string | null {
  const secret = gateSecret()
  if (!secret) return null
  const body = `${payload.userId}.${payload.exp}`
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifySigned(token: string): GatePayload | null {
  const secret = gateSecret()
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expRaw, sig] = parts
  if (!userId || !expRaw || !sig) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Date.now()) return null

  const body = `${userId}.${expRaw}`
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return { userId, exp }
}

export async function readEnvEditorGate(): Promise<{
  unlocked: boolean
  expiresAt: number | null
  userId: string | null
}> {
  const session = await requireDeveloperAdmin()
  if (!session?.user?.id) {
    return { unlocked: false, expiresAt: null, userId: null }
  }

  const jar = await cookies()
  const raw = jar.get(ENV_EDITOR_GATE_COOKIE)?.value
  if (!raw) {
    return { unlocked: false, expiresAt: null, userId: session.user.id }
  }

  const payload = verifySigned(raw)
  if (!payload || payload.userId !== session.user.id) {
    return { unlocked: false, expiresAt: null, userId: session.user.id }
  }

  return { unlocked: true, expiresAt: payload.exp, userId: session.user.id }
}

export async function setEnvEditorGateCookie(
  userId: string,
): Promise<{ ok: true; expiresAt: number } | { ok: false; error: string }> {
  const exp = Date.now() + ENV_EDITOR_GATE_TTL_SEC * 1000
  const token = signPayload({ userId, exp })
  if (!token) {
    return { ok: false, error: ENV_EDITOR_GATE_SECRET_MISSING }
  }
  const jar = await cookies()
  jar.set(ENV_EDITOR_GATE_COOKIE, token, {
    httpOnly: true,
    // Broad enough for Server Actions under /admin; still admin-only routes.
    path: '/admin',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: ENV_EDITOR_GATE_TTL_SEC,
  })
  return { ok: true, expiresAt: exp }
}

export async function clearEnvEditorGateCookie(): Promise<void> {
  const jar = await cookies()
  // Must match path used in setEnvEditorGateCookie or the browser keeps the token.
  jar.set(ENV_EDITOR_GATE_COOKIE, '', {
    httpOnly: true,
    path: '/admin',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: 0,
  })
}

/**
 * Confirm the signed-in developer-admin’s password (session user only — no email spoofing).
 * Uses Better Auth `verifyPassword` (server scope) against the current session.
 */
export async function verifyDeveloperAdminPassword(
  password: string,
): Promise<{ ok: true; userId: string; email: string } | { ok: false; error: string }> {
  const session = await requireDeveloperAdmin()
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      error:
        'Developer-admin only. Add your email to STARFORGE_DEVELOPER_ADMIN_EMAILS (empty list grants nobody in production).',
    }
  }

  const trimmed = password.trim()
  if (trimmed.length < 8) {
    return { ok: false, error: 'Enter your current account password to unlock.' }
  }

  try {
    await auth.api.verifyPassword({
      body: { password: trimmed },
      headers: await headers(),
    })
  } catch {
    return { ok: false, error: 'Password incorrect.' }
  }

  return { ok: true, userId: session.user.id, email: session.user.email }
}

/** Gate must be valid for the current developer-admin. */
export async function requireEnvEditorGate(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await requireDeveloperAdmin()
  if (!session?.user?.id) {
    return {
      ok: false,
      error: 'Developer-admin only. Environment editing is gated like script-capable Page Settings.',
    }
  }
  const gate = await readEnvEditorGate()
  if (!gate.unlocked) {
    return { ok: false, error: 'Confirm your password to unlock the Environment panel.' }
  }
  return { ok: true, userId: session.user.id }
}
