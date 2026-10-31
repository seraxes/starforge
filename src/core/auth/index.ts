import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { nextCookies } from 'better-auth/next-js'
import { admin as adminPlugin } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'

import { db, sfAccounts, sfSessions, sfUsers, sfVerifications } from '@/core/db'
import { emailIsBootstrapAdmin } from './bootstrap-admins'
import { ac, appRoles, DEFAULT_APP_ROLE } from './permissions'

const appUrl =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Starforge product auth (app users).
 * Completely separate from Payload CMS editor accounts at `/admin`.
 *
 * Physical tables stay `sf_*` in `public`; Better Auth model keys stay the
 * defaults (`user` / `session` / `account` / `verification`) so adapter joins
 * and credential lookups (email + password on `account`) stay reliable.
 *
 * Roles live on `sf_users.role` via the Better Auth admin plugin (`admin` | `member`).
 * CMS access (`sf_users.cms_access`) opens Payload `/admin` via the Better Auth
 * session strategy — one login only (no second Payload password).
 */
export const auth = betterAuth({
  appName: 'Starforge',
  // Accept both localhost and 127.0.0.1 during local Windows/macOS dev.
  baseURL: {
    allowedHosts: ['localhost:*', '127.0.0.1:*'],
    fallback: appUrl,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:*',
    'http://127.0.0.1:*',
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: sfUsers,
      session: sfSessions,
      account: sfAccounts,
      verification: sfVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Keep explicit so register creates a session cookie immediately.
    autoSignIn: true,
    // Password reset needs outbound email — deferred until that lands.
    // requireEmailVerification stays false for local-first P0.
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // `npm run seed` sets STARFORGE_SEEDING=1 so bootstrap users can still be created
          // even if an existing site-settings global has registration off.
          if (process.env.STARFORGE_SEEDING === '1') {
            return { data: user }
          }
          const { isRegistrationEnabled } = await import('@/core/settings')
          if (!(await isRegistrationEnabled())) {
            throw new APIError('BAD_REQUEST', {
              message: 'Registration is turned off in site settings.',
            })
          }
          return { data: user }
        },
        after: async (user) => {
          // Bootstrap admins: STARFORGE_ADMIN_EMAILS get role=admin + cms_access on signup.
          if (emailIsBootstrapAdmin(user.email)) {
            await db
              .update(sfUsers)
              .set({ role: 'admin', cmsAccess: true, updatedAt: new Date() })
              .where(eq(sfUsers.id, user.id))
            try {
              const { setCoreUserCmsAccess } = await import('@/core/cms-bridge')
              await setCoreUserCmsAccess(user.id, true)
            } catch {
              // Payload may be unavailable during early bootstrap; seed will retry.
            }
          }
        },
      },
    },
  },
  advanced: {
    // Local http:// — never force Secure cookies (breaks Windows localhost).
    useSecureCookies: false,
    defaultCookieAttributes: {
      sameSite: 'lax',
      httpOnly: true,
      path: '/',
      secure: false,
    },
  },
  // nextCookies must be last so Set-Cookie from server actions reaches the browser.
  plugins: [
    adminPlugin({
      ac,
      roles: appRoles,
      defaultRole: DEFAULT_APP_ROLE,
      adminRoles: ['admin'],
      defaultBanReason: 'Disabled by admin',
      bannedUserMessage:
        'This Starforge app account is disabled. Contact a platform admin if you believe that is a mistake.',
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
