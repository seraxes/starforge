/**
 * Lightweight user options for Events manager/helper checklists.
 */

import 'server-only'

import { asc } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

export type EventsUserOption = {
  id: string
  label: string
  name: string
  email: string
}

/** Up to `limit` users ordered by email — for admin multi-selects / pickers. */
export async function listEventsUserOptions(
  limit = 200,
): Promise<EventsUserOption[]> {
  const capped = Math.min(Math.max(limit, 1), 500)
  try {
    const rows = await db
      .select({
        id: sfUsers.id,
        name: sfUsers.name,
        email: sfUsers.email,
      })
      .from(sfUsers)
      .orderBy(asc(sfUsers.email))
      .limit(capped)
    return rows.map((row) => {
      const email = (row.email || '').trim()
      const name = (row.name || '').trim()
      const label = name && email ? `${name} <${email}>` : name || email || row.id
      return { id: row.id, label, name, email }
    })
  } catch {
    return []
  }
}
