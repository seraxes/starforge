import 'server-only'

import { count, eq } from 'drizzle-orm'

import { db, sfSessions, sfUsers } from '@/core/db'

/**
 * Build a GDPR-style account export for the signed-in member.
 * Omits password hashes, 2FA secrets, session tokens, and merchant payment keys.
 */
export async function buildAccountDataExport(userId: string): Promise<{
  ok: true
  payload: Record<string, unknown>
} | { ok: false; error: string }> {
  const id = userId.trim()
  if (!id) return { ok: false, error: 'Not signed in.' }

  const rows = await db
    .select({
      id: sfUsers.id,
      name: sfUsers.name,
      email: sfUsers.email,
      emailVerified: sfUsers.emailVerified,
      createdAt: sfUsers.createdAt,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, id))
    .limit(1)

  const user = rows[0]
  if (!user) return { ok: false, error: 'Account not found.' }

  const [sessionRow] = await db
    .select({ n: count() })
    .from(sfSessions)
    .where(eq(sfSessions.userId, id))

  const sessionCount = sessionRow?.n ?? 0

  let profile: Record<string, unknown> | null = null
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('profiles-api-server')
    const exportOwnProfileRecord = door?.exportOwnProfileRecord as
      | ((userId: string) => Promise<Record<string, unknown> | null>)
      | undefined
    profile = exportOwnProfileRecord ? await exportOwnProfileRecord(id) : null
  } catch {
    // Profiles pack not on disk / import failed — omit profile block.
    profile = null
  }

  return {
    ok: true,
    payload: {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      hasSessions: sessionCount > 0,
      sessionCount,
      profile,
    },
  }
}
