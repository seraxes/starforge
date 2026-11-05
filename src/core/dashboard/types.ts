/** Resolved Dashboard widget contribution (after toggle + ACL filter). */
export type DashboardWidgetSize = 'sm' | 'md' | 'lg'

export type ResolvedDashboardWidget = {
  moduleId: string
  id: string
  title: string
  order: number
  size: DashboardWidgetSize
  area?: string
}

/** Soft-fail envelope for optional stats loaders. */
export type DashboardStatsResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: 'unavailable' | 'error' }

export type UsersStripStats = {
  totalUsers: number
  onlineNow: number
  newlyRegistered10d: number
  onlineWindowMin: number
  siteOffline?: boolean | null
}

export type LatestUserRow = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  groupLabels: string[]
}

export type LatestUsersStats = {
  users: LatestUserRow[]
}
