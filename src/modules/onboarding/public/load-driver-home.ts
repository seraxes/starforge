/**
 * Signed-in driver home for the account page and the driver-home particle.
 */

import 'server-only'

import { getAccessViewer, viewerMayAccessAdminResource } from '@/core/acl/access'

import { filterDashboardTilesForViewer } from '../dashboard-tile-rules'
import { listDashboardTiles } from '../dashboard-tile-store'
import { getIdentityFacts, getStatusById } from '../store'
import type { DriverHomeTile } from './driver-home-view'

export type DriverHomeModel = {
  label: string
  actionChip: string
  nextStep: string
  tiles: DriverHomeTile[]
}

/** Null when the person has no current status. */
export async function loadDriverHomeForUser(userId: string): Promise<DriverHomeModel | null> {
  const id = userId.trim()
  if (!id) return null

  const facts = await getIdentityFacts(id).catch(() => null)
  const statusId = facts?.statusId?.trim() ?? ''
  if (!statusId) return null

  const status = await getStatusById(statusId).catch(() => null)
  if (!status) return null

  const viewer = await getAccessViewer()
  const isStaff =
    Boolean(viewer.isAppAdmin) ||
    (await viewerMayAccessAdminResource(viewer, 'admin.onboarding', 'edit').catch(() => false))

  const tiles = await listDashboardTiles().catch(() => [])
  const visible = filterDashboardTilesForViewer(tiles, statusId, isStaff)

  return {
    label: status.displayLabel.trim() || status.name.trim(),
    actionChip: status.actionChip.trim(),
    nextStep: status.nextStepMessage.trim(),
    tiles: visible.map((tile) => ({
      id: tile.id,
      title: tile.title,
      icon: tile.icon,
      url: tile.url,
    })),
  }
}
