import 'server-only'

import { randomBytes, randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { eq } from 'drizzle-orm'

import { db, sfSessions, sfUsers } from '@/core/db'
import { shouldUseSecureCookies } from '@/core/security/secure-cookies'
import { siteChromeCookieAttributes } from '@/core/site-chrome/cookie-attrs'

import { auth } from './index'
import { safeNextPath } from './safe-next-path'

/** Cookie holding the staff backend session (separate from public Better Auth). */
export const ADMIN_SESSION_COOKIE = 'sf-admin.session_token'

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7

export function adminSessionCookieName(): string {
  return shouldUseSecureCookies()
    ? `__Secure-${ADMIN_SESSION_COOKIE}`
    : ADMIN_SESSION_COOKIE
}

export function publicSessionCookieNames(): string[] {
  return ['better-auth.session_token', '__Secure-better-auth.session_token']
}

export function adminSessionCookieNames(): string[] {
  return [ADMIN_SESSION_COOKIE, `__Secure-${ADMIN_SESSION_COOKIE}`]
}

/** True when the request carries the staff admin session cookie. */
export function hasAdminSessionCookie(
  cookieHeader: string | null | undefined,
  cookieStore?: { has: (name: string) => boolean },
): boolean {
  if (cookieStore) {
    return adminSessionCookieNames().some((name) => cookieStore.has(name))
  }
  const raw = cookieHeader ?? ''
  return adminSessionCookieNames().some(
    (name) => raw.includes(`${name}=`) || raw.includes(`${encodeURIComponent(name)}=`),
  )
}

/** True when the request carries the public Better Auth session cookie. */
export function hasPublicSessionCookie(
  cookieHeader: string | null | undefined,
  cookieStore?: { has: (name: string) => boolean },
): boolean {
  if (cookieStore) {
    return publicSessionCookieNames().some((name) => cookieStore.has(name))
  }
  const raw = cookieHeader ?? ''
  return publicSessionCookieNames().some((name) => raw.includes(`${name}=`))
}

async function signSessionToken(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(token),
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `${token}.${sigB64}`
}

function parseCookieHeader(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of raw.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx < 1) continue
    const key = part.slice(0, eqIdx).trim()
    let val = part.slice(eqIdx + 1).trim()
    if (!key) continue
    try {
      val = decodeURIComponent(val)
    } catch {
      /* keep raw */
    }
    if (!map.has(key)) map.set(key, val)
  }
  return map
}

/**
 * Rewrite Cookie so Better Auth `getSession` reads the admin token under the
 * normal session cookie name. Drops the public token and session_data cache.
 */
export function headersWithAdminSession(
  source: Headers | { get: (name: string) => string | null },
): Headers {
  const out = new Headers()
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      out.set(key, value)
    })
  } else {
    const cookie = source.get('cookie')
    if (cookie) out.set('cookie', cookie)
    const origin = source.get('origin')
    if (origin) out.set('origin', origin)
    const host = source.get('host')
    if (host) out.set('host', host)
  }

  const raw = out.get('cookie') || ''
  const parsed = parseCookieHeader(raw)
  const adminName = adminSessionCookieNames().find((name) => parsed.has(name))
  const signed = adminName ? parsed.get(adminName) : undefined
  if (!signed) {
    out.delete('cookie')
    return out
  }

  const baName = shouldUseSecureCookies()
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token'

  const kept: string[] = []
  for (const [key, value] of parsed) {
    if (publicSessionCookieNames().includes(key)) continue
    if (adminSessionCookieNames().includes(key)) continue
    if (key === 'better-auth.session_data' || key === '__Secure-better-auth.session_data') {
      continue
    }
    if (key.startsWith('better-auth.session_data.') || key.startsWith('__Secure-better-auth.session_data.')) {
      continue
    }
    kept.push(`${key}=${encodeURIComponent(value)}`)
  }
  kept.push(`${baName}=${encodeURIComponent(signed)}`)
  out.set('cookie', kept.join('; '))
  return out
}

/** Server-side session from the staff admin cookie only. */
export async function getAdminSession() {
  const headerList = await headers()
  const raw = headerList.get('cookie') || ''
  if (!hasAdminSessionCookie(raw)) return null

  return auth.api.getSession({
    headers: headersWithAdminSession(headerList),
    query: { disableRefresh: true },
  })
}

export type MintAdminSessionResult =
  | { ok: true; next: string }
  | { ok: false; error: 'unauthenticated' | 'forbidden' | 'config' }

/**
 * Create a second Better Auth session row and set `sf-admin.session_token`.
 * Caller must already have verified the public session may enter the admin shell.
 */
export async function mintAdminSessionCookie(input: {
  userId: string
  next?: string | null
}): Promise<MintAdminSessionResult> {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (!secret) return { ok: false, error: 'config' }

  const next = safeNextPath(input.next, '/admin')
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_SECONDS * 1000)
  const token = randomBytes(32).toString('hex')
  const id = randomUUID()

  const headerList = await headers()
  await db.insert(sfSessions).values({
    id,
    token,
    userId: input.userId,
    expiresAt,
    ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: headerList.get('user-agent') || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const signed = await signSessionToken(token, secret)
  const cookieStore = await cookies()
  const attrs = siteChromeCookieAttributes
  cookieStore.set(adminSessionCookieName(), signed, {
    httpOnly: true,
    path: attrs.path || '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    maxAge: SESSION_EXPIRES_IN_SECONDS,
    ...(attrs.domain ? { domain: attrs.domain } : {}),
  })

  return { ok: true, next }
}

/** Revoke the admin session row and clear the cookie. */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  const name = adminSessionCookieNames().find((n) => cookieStore.has(n))
  const signed = name ? cookieStore.get(name)?.value : undefined
  if (signed) {
    const token = signed.includes('.') ? signed.slice(0, signed.lastIndexOf('.')) : signed
    if (token) {
      await db.delete(sfSessions).where(eq(sfSessions.token, token)).catch(() => undefined)
    }
  }

  for (const cookieName of adminSessionCookieNames()) {
    try {
      cookieStore.delete(cookieName)
    } catch {
      cookieStore.set(cookieName, '', {
        httpOnly: true,
        path: siteChromeCookieAttributes.path || '/',
        sameSite: 'lax',
        secure: shouldUseSecureCookies(),
        maxAge: 0,
        ...(siteChromeCookieAttributes.domain
          ? { domain: siteChromeCookieAttributes.domain }
          : {}),
      })
    }
  }
}

/** Load public Better Auth session (never the admin cookie). */
export async function getPublicSessionForMint() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
}

export async function loadUserRowForAdminGate(userId: string) {
  const [row] = await db
    .select({
      id: sfUsers.id,
      email: sfUsers.email,
      name: sfUsers.name,
      role: sfUsers.role,
      banned: sfUsers.banned,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  return row ?? null
}
