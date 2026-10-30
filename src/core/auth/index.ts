import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { nextCookies } from 'better-auth/next-js'

import { db, sfAccounts, sfSessions, sfUsers, sfVerifications } from '@/core/db'

/**
 * Starforge product auth (app users).
 * Completely separate from Payload CMS editor accounts at `/admin`.
 */
export const auth = betterAuth({
  appName: 'Starforge',
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    // Keys must match Better Auth modelName values used below (schema validation).
    schema: {
      user: sfUsers,
      session: sfSessions,
      account: sfAccounts,
      verification: sfVerifications,
      sf_users: sfUsers,
      sf_sessions: sfSessions,
      sf_accounts: sfAccounts,
      sf_verifications: sfVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    modelName: 'sf_users',
  },
  session: {
    modelName: 'sf_sessions',
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: 'sf_accounts',
  },
  verification: {
    modelName: 'sf_verifications',
  },
  // nextCookies must be last so Set-Cookie from server actions reaches the browser.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
