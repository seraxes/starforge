'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'
import { and, eq } from 'drizzle-orm'

import { db, sfAccounts, sfUsers } from '@/core/db'
import { enforceCaptchaFromFormData } from '@/core/security/captcha'
import { isRegistrationEnabled } from '@/core/settings'
import {
  isAuthEmailVerificationRequired,
  syncAuthEmailVerificationPolicy,
} from './email-verification-policy'
import { sendAccountReminderMail } from './mail'
import { auth } from './index'
import {
  resolvePostLoginUrl,
  resolvePostLogoutUrl,
  resolvePostRegisterUrl,
} from './success-urls'
import {
  emailOtpRequestSchema,
  emailOtpVerifySchema,
  forgotPasswordSchema,
  forgotUsernameSchema,
  loginSchema,
  magicLinkSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
} from './schemas'

export type AuthActionState = {
  error?: string
  success?: string
  email?: string
  name?: string
  next?: string
  /** When password sign-in needs a second factor. */
  twoFactorRequired?: boolean
  /** OTP step after requesting an email code. */
  otpSent?: boolean
}

/** Generic copy — never reveal whether an email exists (rate-limit friendly). */
const GENERIC_RESET_SENT =
  'If an account exists for that email, we sent reset instructions. Check your inbox (and spam). You can request again in a minute if nothing arrives.'

const GENERIC_REMINDER_SENT =
  'If an account exists for that email, we sent a sign-in reminder. Check your inbox (and spam).'

const GENERIC_MAGIC_SENT =
  'If an account exists for that email, we sent a magic sign-in link. Check your inbox (and spam). Links expire quickly.'

const GENERIC_OTP_SENT =
  'If an account exists for that email, we sent a one-time code. Enter it below. Codes expire in a few minutes.'

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    return error.message || fallback
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function formBool(value: FormDataEntryValue | null, defaultValue = false): boolean {
  if (value == null || value === '') return defaultValue
  const raw = String(value).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

async function findAppCredential(email: string) {
  const [row] = await db
    .select({
      userId: sfUsers.id,
      email: sfUsers.email,
      accountId: sfAccounts.id,
      password: sfAccounts.password,
      providerId: sfAccounts.providerId,
    })
    .from(sfUsers)
    .leftJoin(sfAccounts, eq(sfAccounts.userId, sfUsers.id))
    .where(and(eq(sfUsers.email, email), eq(sfAccounts.providerId, 'credential')))
    .limit(1)

  if (!row) {
    const [userOnly] = await db
      .select({ id: sfUsers.id, email: sfUsers.email })
      .from(sfUsers)
      .where(eq(sfUsers.email, email))
      .limit(1)
    return userOnly
      ? { userId: userOnly.id, email: userOnly.email, hasCredential: false as const }
      : null
  }

  return {
    userId: row.userId,
    email: row.email,
    hasCredential: Boolean(row.password),
  }
}

async function mintPayloadSessionIfNeeded(): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (session?.user?.id) {
      const { loadCoreUserCmsAccess } = await import('@/core/cms-bridge')
      const access = await loadCoreUserCmsAccess(session.user.id)
      if (access?.cmsAccess && !access.banned) {
        const { setPayloadAdminSessionCookie } = await import('@/core/cms-bridge/payload-session')
        await setPayloadAdminSessionCookie({
          coreUserId: session.user.id,
          email: session.user.email,
          name: session.user.name,
        })
      }
    }
  } catch (error) {
    console.error('[login] Payload JWT exchange skipped:', error)
  }
}

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await syncAuthEmailVerificationPolicy()
  const registrationOn = await isRegistrationEnabled()
  if (!registrationOn) {
    return {
      error: 'Registration is turned off in site settings. Ask a core admin to enable it.',
      email: String(formData.get('email') ?? ''),
      name: String(formData.get('name') ?? ''),
    }
  }

  const captchaGate = await enforceCaptchaFromFormData(
    'register',
    formData,
    await headers(),
  )
  if (!captchaGate.ok) {
    return {
      error: captchaGate.error,
      email: String(formData.get('email') ?? ''),
      name: String(formData.get('name') ?? ''),
    }
  }

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
      name: String(formData.get('name') ?? ''),
    }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Could not register'),
      email: parsed.data.email,
      name: parsed.data.name,
    }
  }

  // When verification is required, Better Auth skips the session — tell the user to open mail.
  if (isAuthEmailVerificationRequired()) {
    return {
      success:
        'Account created. Check your email for a verification link before signing in.',
      email: parsed.data.email,
      name: parsed.data.name,
    }
  }

  // If auto sign-in did not attach a cookie (proxy/host quirks), sign in once.
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    try {
      await auth.api.signInEmail({
        body: {
          email: parsed.data.email,
          password: parsed.data.password,
        },
        headers: await headers(),
      })
    } catch (error) {
      return {
        error:
          toErrorMessage(error, 'Account created, but automatic sign-in failed.') +
          ' Open Sign in and use the same email + password.',
        email: parsed.data.email,
        name: parsed.data.name,
      }
    }
  }

  redirect(await resolvePostRegisterUrl())
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await syncAuthEmailVerificationPolicy()
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    // Unchecked checkbox is absent from FormData → false (do not default true here).
    rememberMe: formBool(formData.get('rememberMe'), false),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
    }
  }

  const existing = await findAppCredential(parsed.data.email)
  if (!existing) {
    return {
      error: 'No Starforge app account for that email. Use Register first, or try passwordless if you already have an account.',
      email: parsed.data.email,
    }
  }
  if (!existing.hasCredential) {
    return {
      error:
        'That email exists but has no usable password. Use magic link / email code on this page, or reset password after set.',
      email: parsed.data.email,
    }
  }

  const next = await resolvePostLoginUrl(formData.get('next'))

  try {
    const result = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.rememberMe,
      },
      headers: await headers(),
    })

    if (result && typeof result === 'object' && 'twoFactorRedirect' in result && result.twoFactorRedirect) {
      redirect(`/two-factor?next=${encodeURIComponent(next)}`)
    }
  } catch (error) {
    const message = toErrorMessage(error, 'Invalid email or password')
    // Better Auth may surface 2FA via thrown redirect-ish payloads in some paths.
    if (
      error &&
      typeof error === 'object' &&
      'twoFactorRedirect' in error &&
      (error as { twoFactorRedirect?: boolean }).twoFactorRedirect
    ) {
      redirect(`/two-factor?next=${encodeURIComponent(next)}`)
    }
    if (/email not verified/i.test(message)) {
      return {
        error:
          'That email is not verified yet. Open the link we sent (or sign in again to resend it).',
        email: parsed.data.email,
      }
    }
    return {
      error:
        message === 'Invalid email or password'
          ? 'Wrong password for that email. Try Forgot password, or use magic link / email code.'
          : message,
      email: parsed.data.email,
      next,
    }
  }

  await mintPayloadSessionIfNeeded()
  // Staff destinations need the admin session cookie minted (Set-Cookie via route).
  if (next.startsWith('/admin') || next.startsWith('/cms')) {
    redirect(`/api/auth/admin-session?next=${encodeURIComponent(next)}`)
  }
  redirect(next)
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const captchaGate = await enforceCaptchaFromFormData(
    'auth-recovery',
    formData,
    await headers(),
  )
  if (!captchaGate.ok) {
    return {
      error: captchaGate.error,
      email: String(formData.get('email') ?? ''),
    }
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
    }
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: `${appOrigin()}/reset-password`,
      },
      headers: await headers(),
    })
  } catch (error) {
    // Still return generic success unless the mailer/config is clearly broken.
    console.error('[forgot-password]', toErrorMessage(error, 'request failed'))
  }

  return {
    success: GENERIC_RESET_SENT,
    email: parsed.data.email,
  }
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
    }
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.password,
        token: parsed.data.token,
      },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error:
        toErrorMessage(error, 'Could not reset password') +
        ' Request a new reset link if this one expired.',
    }
  }

  redirect('/login?reset=1')
}

export async function forgotUsernameAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const captchaGate = await enforceCaptchaFromFormData(
    'auth-recovery',
    formData,
    await headers(),
  )
  if (!captchaGate.ok) {
    return {
      error: captchaGate.error,
      email: String(formData.get('email') ?? ''),
    }
  }

  const parsed = forgotUsernameSchema.safeParse({
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
    }
  }

  try {
    const [user] = await db
      .select({ email: sfUsers.email, name: sfUsers.name })
      .from(sfUsers)
      .where(eq(sfUsers.email, parsed.data.email))
      .limit(1)
    if (user) {
      void sendAccountReminderMail({ to: user.email, name: user.name })
    }
  } catch (error) {
    console.error('[forgot-username]', toErrorMessage(error, 'reminder failed'))
  }

  return {
    success: GENERIC_REMINDER_SENT,
    email: parsed.data.email,
  }
}

export async function magicLinkAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const captchaGate = await enforceCaptchaFromFormData(
    'auth-recovery',
    formData,
    await headers(),
  )
  if (!captchaGate.ok) {
    return {
      error: captchaGate.error,
      email: String(formData.get('email') ?? ''),
    }
  }

  const parsed = magicLinkSchema.safeParse({
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
    }
  }

  const next = await resolvePostLoginUrl(formData.get('next'))

  try {
    await auth.api.signInMagicLink({
      body: {
        email: parsed.data.email,
        callbackURL: next,
        errorCallbackURL: `/login?error=magic_link&next=${encodeURIComponent(next)}`,
      },
      headers: await headers(),
    })
  } catch (error) {
    console.error('[magic-link]', toErrorMessage(error, 'send failed'))
  }

  return {
    success: GENERIC_MAGIC_SENT,
    email: parsed.data.email,
    next,
  }
}

export async function requestEmailOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const captchaGate = await enforceCaptchaFromFormData(
    'auth-recovery',
    formData,
    await headers(),
  )
  if (!captchaGate.ok) {
    return {
      error: captchaGate.error,
      email: String(formData.get('email') ?? ''),
    }
  }

  const parsed = emailOtpRequestSchema.safeParse({
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
    }
  }

  try {
    await auth.api.sendVerificationOTP({
      body: {
        email: parsed.data.email,
        type: 'sign-in',
      },
      headers: await headers(),
    })
  } catch (error) {
    console.error('[email-otp]', toErrorMessage(error, 'send failed'))
  }

  return {
    success: GENERIC_OTP_SENT,
    email: parsed.data.email,
    otpSent: true,
    next: await resolvePostLoginUrl(formData.get('next')),
  }
}

export async function verifyEmailOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailOtpVerifySchema.safeParse({
    email: formData.get('email'),
    otp: formData.get('otp'),
    rememberMe: formBool(formData.get('rememberMe'), false),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      email: String(formData.get('email') ?? ''),
      otpSent: true,
    }
  }

  const next = await resolvePostLoginUrl(formData.get('next'))

  try {
    await auth.api.signInEmailOTP({
      body: {
        email: parsed.data.email,
        otp: parsed.data.otp,
      },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Invalid or expired code. Request a new one.'),
      email: parsed.data.email,
      otpSent: true,
      next,
    }
  }

  await mintPayloadSessionIfNeeded()
  if (next.startsWith('/admin') || next.startsWith('/cms')) {
    redirect(`/api/auth/admin-session?next=${encodeURIComponent(next)}`)
  }
  redirect(next)
}

export async function verifyTwoFactorAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = twoFactorCodeSchema.safeParse({
    code: formData.get('code'),
    trustDevice: formBool(formData.get('trustDevice'), false),
    mode: formData.get('mode') === 'backup' ? 'backup' : 'totp',
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      twoFactorRequired: true,
    }
  }

  const next = await resolvePostLoginUrl(formData.get('next'))

  try {
    if (parsed.data.mode === 'backup') {
      await auth.api.verifyBackupCode({
        body: {
          code: parsed.data.code,
          trustDevice: parsed.data.trustDevice,
        },
        headers: await headers(),
      })
    } else {
      await auth.api.verifyTOTP({
        body: {
          code: parsed.data.code,
          trustDevice: parsed.data.trustDevice,
        },
        headers: await headers(),
      })
    }
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Invalid code. Try again or use a recovery code.'),
      twoFactorRequired: true,
      next,
    }
  }

  await mintPayloadSessionIfNeeded()
  if (next.startsWith('/admin') || next.startsWith('/cms')) {
    redirect(`/api/auth/admin-session?next=${encodeURIComponent(next)}`)
  }
  redirect(next)
}

export async function logoutAction(): Promise<void> {
  try {
    // Public Better Auth cookie only — leave staff admin session + payload-token.
    await auth.api.signOut({
      headers: await headers(),
    })
  } catch {
    // Still clear the UI even if the session was already gone.
  }
  redirect(await resolvePostLogoutUrl())
}

/** Sign out of the backend only — clears admin session + payload-token. */
export async function adminLogoutAction(): Promise<void> {
  try {
    const { clearAdminSession } = await import('./admin-session')
    await clearAdminSession()
  } catch {
    // ignore
  }
  try {
    const { clearPayloadAdminSession } = await import('@/core/cms-bridge/payload-session')
    await clearPayloadAdminSession()
  } catch {
    // ignore
  }
  redirect('/admin')
}
