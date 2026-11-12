/**
 * Resolve subscriber email for Email Manager payloads.
 * Packs must put an address on the payload — Email Manager does not look up userId.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

export async function loadSubscriberEmail(userId: string): Promise<string> {
  const id = userId.trim()
  if (!id) return ''
  try {
    const rows = await db
      .select({ email: sfUsers.email })
      .from(sfUsers)
      .where(eq(sfUsers.id, id))
      .limit(1)
    return String(rows[0]?.email ?? '')
      .trim()
      .toLowerCase()
  } catch {
    return ''
  }
}
