import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { nextCookies } from 'better-auth/next-js'
import {
  admin as adminPlugin,
  emailOTP,
  magicLink,
  twoFactor,
} from 'better-auth/plugins'
import { eq } from 'drizzle-orm'

import {
  db,
  sfAccounts,
  sfSessions,
  sfTwoFactors,
  sfUsers,
  sfVerifications,
} from '@/core/db'
import { shouldUseSecureCookies } from '@/core/security/secure-cookies'
import { appTrustedOrigins } from '@/core/security/trusted-origins'
import { siteChromeCookieAttributes } from '@/core/site-chrome/cookie-attrs'
import { emailIsBootstrapAdmin } from './bootstrap-admins'
import { emailAndPasswordOptions } from './email-verification-policy'
import { readGoogleOAuthCredentials } from './google-sign-in'
import {
  sendEmailOtpMail,
  sendEmailVerificationMail,
  sendMagicLinkMail,
  sendPasswordResetMail,
  sendTwoFactorOtpMail,
} from './mail'
import { ac, appRoles, DEFAULT_APP_ROLE } from './permissions'

const appUrl =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const googleOAuth = readGoogleOAuthCredentials()

function redisUrlConfigured(): boolean {
  // Inline env read so the no-Redis path stays free of ioredis / server-only.
  return Boolean((process.env.REDIS_URL ?? '').trim())
}

/**
 * When `REDIS_URL` is set: Better Auth secondaryStorage + rateLimit on Redis
 * (`{prefix}:ba:*`). Sessions stay durable in Postgres (`storeSessionInDatabase`)
 * and are mirrored to Redis for multi-instance lookups.
 */
function redisAuthOptions() {
  if (!redisUrlConfigured()) return {}
  const { createRedisSecondaryStorage } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Redis load
    require('./redis-secondary-storage') as typeof import('./redis-secondary-storage')
  return {
    secondaryStorage: createRedisSecondaryStorage(),
    rateLimit: {
      storage: 'secondary-storage' as const,
    },
  }
}

/**
 * Starforge product auth (app users).
 * Completely separate from Payload CMS editor accounts at `/cms/admin`.
 *
 * Physical tables stay `sf_*` in `public`; Better Auth model keys stay the
 * defaults (`user` / `session` / `account` / `verification` / `twoFactor`) so
 * adapter joins and credential lookups stay reliable.
 *
 * Roles live on `sf_users.role` via the Better Auth admin plugin (`admin` | `member`).
 * CMS access (`sf_users.cms_access`) opens Payload `/cms/admin` via the Better Auth
 * session strategy — one login only (no second Payload password).
 *
 * Recovery / passwordless / 2FA (SF-17): password reset + magic link + email OTP
 * + TOTP/backup codes, all through the platform Mailer port.
 */
export const auth = betterAuth({
  appName: 'Starforge',
  // Accept both localhost and 127.0.0.1 during local Windows/macOS dev.
  baseURL: {
    allowedHosts: ['localhost:*', '127.0.0.1:*'],
    fallback: appUrl,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  // Env-driven: BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL / STARFORGE_TRUSTED_ORIGINS
  // (Environment catalog). Loopback twins only when the app URL is loopback.
  trustedOrigins: appTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: sfUsers,
      session: sfSessions,
      account: sfAccounts,
      verification: sfVerifications,
      twoFactor: sfTwoFactors,
    },
  }),
  // Shared-by-ref with Site Chrome — do not spread; flag flips live on save.
  emailAndPassword: Object.assign(emailAndPasswordOptions, {
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      // Do not await — Better Auth docs recommend avoiding timing leaks.
      void sendPasswordResetMail({
        to: user.email,
        name: user.name,
        url,
      })
    },
  }),
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }: { user: { email: string; name: string }; url: string }) {
      void sendEmailVerificationMail({
        to: user.email,
        name: user.name,
        url,
      })
    },
  },
  user: {
    // Member self-service on /account/security — password required; no email confirm step.
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    // Default ~7d; rememberMe=false shortens via Better Auth's dontRememberMe path.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Keep Postgres as durable session store when Redis secondaryStorage is on.
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  ...redisAuthOptions(),
  // Optional Google OAuth — only when both GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set.
  ...(googleOAuth
    ? {
        socialProviders: {
          google: {
            clientId: googleOAuth.clientId,
            clientSecret: googleOAuth.clientSecret,
          },
        },
      }
    : {}),

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
    // Secure + `__Secure-` prefix when HTTPS / STARFORGE_SECURE_COOKIES — not local HTTP.
    useSecureCookies: shouldUseSecureCookies(),
    // Shared by ref with Site Chrome — domain/path/secure update on save without restart.
    defaultCookieAttributes: siteChromeCookieAttributes,
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
    twoFactor({
      issuer: 'Starforge',
      otpOptions: {
        async sendOTP({ user, otp }) {
          void sendTwoFactorOtpMail({
            to: user.email,
            name: user.name,
            otp,
          })
        },
      },
    }),
    magicLink({
      disableSignUp: true,
      expiresIn: 60 * 10,
      async sendMagicLink({ email, url }) {
        void sendMagicLinkMail({ to: email, url })
      },
    }),
    emailOTP({
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 60 * 10,
      async sendVerificationOTP({ email, otp, type }) {
        void sendEmailOtpMail({ to: email, otp, type })
      },
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
