import 'server-only'

import { and, count, desc, gte, gt, sql } from 'drizzle-orm'

import { db, sfSessions, sfUsers } from '@/core/db'
import { listGroupIdsByUserIds, listUserGroupOptions } from '@/core/acl'
import { normalizeAppRole } from '@/core/auth/permissions'
import {
  DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  clampDashboardOnlineWindowMin,
} from '@/core/settings/defaults'
import { getSiteChrome } from '@/core/site-chrome'

import type { LatestUsersStats, UsersStripStats } from '../types'
import { LATEST_USERS_LIMIT, NEW_USER_WINDOW_DAYS } from './users-metric-windows'

export { LATEST_USERS_LIMIT, NEW_USER_WINDOW_DAYS } from './users-metric-windows'

export type LoadUsersStripOptions = {
  /** Session activity window (minutes). Default from Site Settings / code fallback. */
  onlineWindowMin?: number
}

/** Distinct authenticated users with a session touched within the online window. */
export async function countOnlineUsers(onlineWindowMin?: number): Promise<number> {
  const windowMin = clampDashboardOnlineWindowMin(
    onlineWindowMin ?? DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  )
  const since = new Date(Date.now() - windowMin * 60_000)
  const now = new Date()

  const rows = await db
    .select({
      n: sql<number>`count(distinct ${sfSessions.userId})::int`,
    })
    .from(sfSessions)
    .where(and(gte(sfSessions.updatedAt, since), gt(sfSessions.expiresAt, now)))

  return Number(rows[0]?.n ?? 0)
}

export async function loadUsersStripStats(
  options: LoadUsersStripOptions = {},
): Promise<UsersStripStats> {
  const onlineWindowMin = clampDashboardOnlineWindowMin(
    options.onlineWindowMin ?? DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  )
  const since10d = new Date(Date.now() - NEW_USER_WINDOW_DAYS * 24 * 60 * 60_000)

  const [totalRow] = await db.select({ n: count() }).from(sfUsers)
  const [newRow] = await db
    .select({ n: count() })
    .from(sfUsers)
    .where(gte(sfUsers.createdAt, since10d))

  let siteOffline: boolean | null = null
  try {
    const chrome = await getSiteChrome()
    siteOffline = Boolean(chrome.offlineEnabled)
  } catch {
    siteOffline = null
  }

  const onlineNow = await countOnlineUsers(onlineWindowMin)

  return {
    totalUsers: Number(totalRow?.n ?? 0),
    onlineNow,
    newlyRegistered10d: Number(newRow?.n ?? 0),
    onlineWindowMin,
    siteOffline,
  }
}

export async function loadLatestUsersStats(): Promise<LatestUsersStats> {
  const rows = await db
    .select({
      id: sfUsers.id,
      name: sfUsers.name,
      email: sfUsers.email,
      role: sfUsers.role,
      createdAt: sfUsers.createdAt,
    })
    .from(sfUsers)
    .orderBy(desc(sfUsers.createdAt))
    .limit(LATEST_USERS_LIMIT)

  const groupMap = await listGroupIdsByUserIds(rows.map((r) => r.id))
  const groupOptions = await listUserGroupOptions()
  const labelById = new Map(groupOptions.map((g) => [g.id, g.label]))

  return {
    users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: normalizeAppRole(row.role),
      createdAt: row.createdAt.toISOString(),
      groupLabels: (groupMap.get(row.id) ?? [])
        .map((id) => labelById.get(id) ?? id)
        .filter(Boolean),
    })),
  }
}
