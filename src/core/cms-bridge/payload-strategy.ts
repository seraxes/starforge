import type { AuthStrategy } from 'payload'

/**
 * Authenticate Payload `/admin` from the Starforge Better Auth cookie.
 * No Payload email/password — core session is the only login.
 */
export const starforgeCoreSessionStrategy: AuthStrategy = {
  name: 'starforge-core-session',
  authenticate: async ({ headers }) => {
    try {
      const cookie = headers.get('cookie') || ''
      // Fast path: skip DB work when no Better Auth cookie is present.
      if (!cookie.includes('better-auth.session_token') && !cookie.includes('__Secure-better-auth.session_token')) {
        return { user: null }
      }

      const { auth } = await import('@/core/auth')
      const session = await auth.api.getSession({ headers })
      if (!session?.user?.id || !session.user.email) {
        return { user: null }
      }

      const { loadCoreUserCmsAccess, ensurePayloadCmsUser } = await import('./index')
      const access = await loadCoreUserCmsAccess(session.user.id)
      if (!access?.cmsAccess || access.banned) {
        return { user: null }
      }

      const ensured = await ensurePayloadCmsUser({
        coreUserId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      })
      if (!ensured.ok) {
        return { user: null }
      }

      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const user = await payload.findByID({
        collection: 'users',
        id: ensured.id,
        depth: 0,
        overrideAccess: true,
      })
      if (!user) {
        return { user: null }
      }

      return {
        user: {
          ...user,
          collection: 'users',
        },
      }
    } catch {
      return { user: null }
    }
  },
}
