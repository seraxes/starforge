/**
 * Core account identity writes (`sf_users`) — email + real name.
 * Profiles and other modules must not own these fields.
 */

import { and, eq, ne } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

export type AccountIdentityResult = { ok: true } | { ok: false; error: string }

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  return code === '23505'
}

export async function updateAccountEmail(
  userId: string,
  raw: unknown,
  options?: { required?: boolean },
): Promise<AccountIdentityResult> {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    if (options?.required) return { ok: false, error: 'Email is required.' }
    return { ok: true }
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email.' }
  }

  const [current] = await db
    .select({ id: sfUsers.id, email: sfUsers.email })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  if (!current) return { ok: false, error: 'Account not found.' }
  if (current.email.toLowerCase() === email) return { ok: true }

  const [taken] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(and(eq(sfUsers.email, email), ne(sfUsers.id, userId)))
    .limit(1)
  if (taken) return { ok: false, error: 'That email is already in use.' }

  try {
    await db
      .update(sfUsers)
      .set({
        email,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(sfUsers.id, userId))
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'That email is already in use.' }
    }
    throw error
  }
  return { ok: true }
}

export async function updateAccountName(
  userId: string,
  raw: unknown,
): Promise<AccountIdentityResult> {
  const name = String(raw ?? '').trim().slice(0, 100)
  if (!name) return { ok: false, error: 'Name is required.' }

  const [current] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  if (!current) return { ok: false, error: 'Account not found.' }

  await db
    .update(sfUsers)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(sfUsers.id, userId))
  return { ok: true }
}
