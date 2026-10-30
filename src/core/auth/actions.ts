'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'
import { and, eq } from 'drizzle-orm'

import { db, sfAccounts, sfUsers } from '@/core/db'
import { auth } from './index'
import { loginSchema, registerSchema } from './schemas'

export type AuthActionState = {
  error?: string
  email?: string
  name?: string
}

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

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
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

  redirect('/')
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
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
      error:
        'No Starforge app account for that email. Use Register (Payload /admin users are separate).',
      email: parsed.data.email,
    }
  }
  if (!existing.hasCredential) {
    return {
      error:
        'That email exists but has no usable password (likely created before the auth fix). Register a new email, or reset the DB and register again.',
      email: parsed.data.email,
    }
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    })
  } catch (error) {
    const message = toErrorMessage(error, 'Invalid email or password')
    return {
      error:
        message === 'Invalid email or password'
          ? 'Wrong password for that email. After updating the auth branch, register a fresh account if this one was created earlier.'
          : message,
      email: parsed.data.email,
    }
  }

  redirect('/')
}

export async function logoutAction(): Promise<void> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    })
  } catch {
    // Still clear the UI even if the session was already gone.
  }
  redirect('/')
}
