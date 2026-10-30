'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'

import { auth } from './index'
import { loginSchema, registerSchema } from './schemas'

export type AuthActionState = {
  error?: string
  ok?: boolean
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
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form' }
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
    return { error: toErrorMessage(error, 'Could not register') }
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
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form' }
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
    return { error: toErrorMessage(error, 'Invalid email or password') }
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
