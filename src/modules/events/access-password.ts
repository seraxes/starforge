/**
 * Event shared-password hash + unlock cookie (product:events visibility).
 */

import 'server-only'

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

import { shouldUseSecureCookies } from '@/core/security/secure-cookies'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32

/** Unlock lifetime after a correct password (7 days). */
export const EVENT_UNLOCK_TTL_SEC = 7 * 24 * 60 * 60

const UNLOCK_SECRET_MISSING =
  'BETTER_AUTH_SECRET is missing — cannot issue event unlock cookies.'

function unlockSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || !secret.trim()) return null
  return secret
}

export function eventUnlockCookieName(eventId: string): string {
  const safe = eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return `sf_event_unlock_${safe || 'x'}`
}

/** Hash a plaintext event password for storage. */
export function hashEventPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

/** Constant-time verify against a stored scrypt$… hash. */
export function verifyEventPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const saltB64 = parts[4]
  const hashB64 = parts[5]
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !saltB64 || !hashB64) {
    return false
  }
  try {
    const salt = Buffer.from(saltB64, 'base64url')
    const expected = Buffer.from(hashB64, 'base64url')
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p })
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function signUnlock(eventId: string, exp: number): string | null {
  const secret = unlockSecret()
  if (!secret) return null
  const body = `${eventId}.${exp}`
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${exp}.${sig}`
}

function verifyUnlockToken(eventId: string, token: string): boolean {
  const secret = unlockSecret()
  if (!secret) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expRaw, sig] = parts
  if (!expRaw || !sig) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false
  const body = `${eventId}.${expRaw}`
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  return true
}

export async function hasEventPasswordUnlock(eventId: string): Promise<boolean> {
  const id = eventId.trim()
  if (!id) return false
  const jar = await cookies()
  const raw = jar.get(eventUnlockCookieName(id))?.value
  if (!raw) return false
  return verifyUnlockToken(id, raw)
}

export async function setEventPasswordUnlockCookie(
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = eventId.trim()
  if (!id) return { ok: false, error: 'Missing event id.' }
  const exp = Date.now() + EVENT_UNLOCK_TTL_SEC * 1000
  const token = signUnlock(id, exp)
  if (!token) return { ok: false, error: UNLOCK_SECRET_MISSING }
  const jar = await cookies()
  jar.set(eventUnlockCookieName(id), token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: EVENT_UNLOCK_TTL_SEC,
  })
  return { ok: true }
}
