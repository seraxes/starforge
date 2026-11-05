export {
  CORE_ADMIN_BASE,
  CORE_ADMIN_ROOT,
  PAYLOAD_ADMIN_BASE,
  PAYLOAD_ADMIN_ROOT,
  coreAdminPath,
  isCoreDashboardPath,
} from '@/core/admin-paths'
export {
  dashboardAreaToAclKey,
  resolveDashboardWidgets,
  resolveEnabledDashboardModuleIds,
} from './resolve'
export type { ResolveDashboardWidgetsOptions } from './resolve'
export { DashboardWidgetCard, DashboardWidgetGrid } from './host'
export type {
  DashboardStatsResult,
  DashboardWidgetSize,
  LatestUserRow,
  LatestUsersStats,
  ResolvedDashboardWidget,
  UsersStripStats,
} from './types'
export {
  countOnlineUsers,
  loadLatestUsersStats,
  loadUsersStripStats,
} from './widgets/users-stats'
export { LATEST_USERS_LIMIT, NEW_USER_WINDOW_DAYS } from './widgets/users-metric-windows'
