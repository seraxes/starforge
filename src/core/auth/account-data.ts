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
    const { isProfilesModuleEnabled } = await import('@/modules/profiles/api.server')
    if (await isProfilesModuleEnabled()) {
      const { getProfileByUserId } = await import('@/modules/profiles/store')
      const record = await getProfileByUserId(id)
      if (record) {
        profile = {
          handle: record.handle,
          displayName: record.displayName,
          headline: record.headline,
          bio: record.bio,
          birthDate: record.birthDate || null,
          gender: record.gender || null,
          country: record.country || null,
          city: record.city || null,
          website: record.website || null,
          phone: record.phone || null,
          links: record.links,
          locale: record.locale || null,
          timezone: record.timezone || null,
          status: record.status,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        }
      }
    }
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
