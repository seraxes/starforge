import type { AuthStrategy, AuthStrategyFunctionArgs, Payload } from 'payload'

/**
 * Authenticate Payload `/admin` from the Starforge Better Auth cookie.
 * No Payload email/password — core session is the only login.
 *
 * Important:
 * - Use the `payload` arg (do not re-enter getPayload during auth).
 * - Call getSession with `disableRefresh: true` so nextCookies cannot try to
 *   Set-Cookie during RSC/admin init (that path threw and was previously
 *   swallowed, which made Payload fall through to its login UI).
 */
function toWebHeaders(headers: AuthStrategyFunctionArgs['headers']): Headers {
  if (headers instanceof Headers) return headers
  const out = new Headers()
  if (headers && typeof headers === 'object') {
    const maybeEntries = (headers as { entries?: () => IterableIterator<[string, string]> }).entries
    if (typeof maybeEntries === 'function') {
      for (const [key, value] of maybeEntries.call(headers)) {
        out.set(key, value)
      }
      return out
    }
    for (const [key, value] of Object.entries(headers as Record<string, string | string[] | undefined>)) {
      if (value == null) continue
      if (Array.isArray(value)) out.set(key, value.join(', '))
      else out.set(key, String(value))
    }
  }
  return out
}

async function findLinkedCmsUser(
  payload: Payload,
  input: { coreUserId: string; email: string },
) {
  const byCore = await payload.find({
    collection: 'users',
    where: { coreUserId: { equals: input.coreUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byCore.docs[0]) return byCore.docs[0]

  const byEmail = await payload.find({
    collection: 'users',
    where: { email: { equals: input.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return byEmail.docs[0] ?? null
}

export const starforgeCoreSessionStrategy: AuthStrategy = {
  name: 'starforge-core-session',
  authenticate: async ({ headers, payload }) => {
    try {
      const webHeaders = toWebHeaders(headers)
      const cookie = webHeaders.get('cookie') || ''
      // Soft presence check only — still call getSession if unsure (cookie names vary).
      const maybeSessionCookie =
        cookie.includes('better-auth.session_token') ||
        cookie.includes('__Secure-better-auth.session_token') ||
        cookie.includes('better-auth.session_data') ||
        cookie.includes('session_token')

      if (!cookie || !maybeSessionCookie) {
        return { user: null }
      }

      const { auth } = await import('@/core/auth')
      // disableRefresh: avoid Set-Cookie during Payload RSC auth (nextCookies + infinite loops).
      const session = await auth.api.getSession({
        headers: webHeaders,
        query: {
          disableRefresh: true,
        },
      })
      if (!session?.user?.id || !session.user.email) {
        return { user: null }
      }

      const { loadCoreUserCmsAccess } = await import('./index')
      const access = await loadCoreUserCmsAccess(session.user.id)
      if (!access?.cmsAccess || access.banned) {
        return { user: null }
      }

      const email = session.user.email.trim().toLowerCase()
      let user = await findLinkedCmsUser(payload, {
        coreUserId: session.user.id,
        email,
      })

      // Provision lazily if the page gate did not run (API routes, etc.).
      if (!user) {
        const { ensurePayloadCmsUser } = await import('./index')
        const ensured = await ensurePayloadCmsUser({
          coreUserId: session.user.id,
          email,
          name: session.user.name,
        })
        if (!ensured.ok) {
          console.error('[starforge-core-session] ensure Payload user failed:', ensured.error)
          return { user: null }
        }
        user = await payload.findByID({
          collection: 'users',
          id: ensured.id,
          depth: 0,
          overrideAccess: true,
        })
      } else if (!user.coreUserId) {
        user = await payload.update({
          collection: 'users',
          id: user.id,
          data: { coreUserId: session.user.id },
          overrideAccess: true,
        })
      }

      if (!user) {
        return { user: null }
      }

      return {
        user: {
          ...user,
          collection: 'users',
          _strategy: 'starforge-core-session',
        },
      }
    } catch (error) {
      console.error('[starforge-core-session] authenticate failed:', error)
      return { user: null }
    }
  },
}
