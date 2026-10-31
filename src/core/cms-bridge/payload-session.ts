import { cookies } from 'next/headers'
import { getFieldsToSign, getPayload, jwtSign } from 'payload'

import config from '@payload-config'

import { ensurePayloadCmsUser } from './index'

export const PAYLOAD_TOKEN_COOKIE = 'payload-token'

/**
 * Mint Payload JWT for a core user. Prefer calling from a Route Handler or
 * Server Action (Next.js only allows Set-Cookie there). The /api/cms/exchange
 * route is the primary path for /admin.
 */
export async function establishPayloadAdminSession(input: {
  coreUserId: string
  email: string
  name?: string | null
}): Promise<{ ok: true; token: string; tokenExpiration: number; userId: number | string } | { ok: false; error: string }> {
  const ensured = await ensurePayloadCmsUser(input)
  if (!ensured.ok) {
    return { ok: false, error: ensured.error }
  }

  const payload = await getPayload({ config })
  const collection = payload.collections.users
  if (!collection?.config.auth) {
    return { ok: false, error: 'Payload users auth collection missing.' }
  }

  const user = await payload.findByID({
    collection: 'users',
    id: ensured.id,
    depth: 0,
    overrideAccess: true,
  })
  if (!user?.email) {
    return { ok: false, error: 'Payload CMS stub not found after ensure.' }
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection.config,
    email: user.email,
    user,
  })

  const tokenExpiration = collection.config.auth.tokenExpiration || 7200
  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration,
  })

  return { ok: true, token, tokenExpiration, userId: user.id }
}

/** Set payload-token from a Server Action (login). */
export async function setPayloadAdminSessionCookie(input: {
  coreUserId: string
  email: string
  name?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const established = await establishPayloadAdminSession(input)
  if (!established.ok) return established

  const cookieStore = await cookies()
  cookieStore.set(PAYLOAD_TOKEN_COOKIE, established.token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: established.tokenExpiration,
  })
  return { ok: true }
}

/** Clear Payload admin JWT (call on core logout from a Server Action). */
export async function clearPayloadAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  try {
    cookieStore.delete(PAYLOAD_TOKEN_COOKIE)
  } catch {
    cookieStore.set(PAYLOAD_TOKEN_COOKIE, '', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
      maxAge: 0,
    })
  }
}
