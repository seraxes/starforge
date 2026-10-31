import { betterAuth } from 'better-auth'
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
 * Payload `/admin` stays a separate CMS editor surface — global-admin→CMS bridge is follow-up.
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
        after: async (user) => {
          // Bootstrap admins: STARFORGE_ADMIN_EMAILS (comma-separated) get role=admin on signup.
          if (emailIsBootstrapAdmin(user.email)) {
            await db
              .update(sfUsers)
              .set({ role: 'admin', updatedAt: new Date() })
              .where(eq(sfUsers.id, user.id))
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
