/**
 * Sync Core user-group membership from subscription period groupIds.
 * Core ACL owns groups/matrix; this pack only add/remove members for plan groups.
 */

import 'server-only'

import { addUserToGroup, removeUserFromGroup } from '@/core/acl'

import type { SubscriptionPeriodRecord } from './types'

/** Add user to every group on the period snapshot. Soft-fail. */
export async function syncGroupsOnActivate(
  period: Pick<SubscriptionPeriodRecord, 'userId' | 'groupIds'>,
): Promise<void> {
  const userId = period.userId.trim()
  if (!userId) return
  for (const groupId of period.groupIds) {
    const g = groupId.trim()
    if (!g) continue
    try {
      await addUserToGroup(g, userId)
    } catch (error) {
      console.error('[subscriptions] addUserToGroup failed', g, userId, error)
    }
  }
}

/**
 * After a period ends: remove groups that period granted unless another
 * active period still lists them. Does not touch unrelated manual memberships.
 */
export async function syncGroupsOnPeriodEnd(
  ended: Pick<SubscriptionPeriodRecord, 'userId' | 'groupIds'>,
  now = new Date(),
): Promise<void> {
  const userId = ended.userId.trim()
  if (!userId) return
  const endedGroups = [
    ...new Set(ended.groupIds.map((g: string) => g.trim()).filter(Boolean)),
  ]
  if (endedGroups.length === 0) return

  let desired = new Set<string>()
  try {
    const { listActivePeriodsForUser } = await import('./store')
    const active = await listActivePeriodsForUser(userId, now)
    for (const p of active) {
      for (const g of p.groupIds) {
        const id = g.trim()
        if (id) desired.add(id)
      }
    }
  } catch (error) {
    console.error('[subscriptions] listActivePeriodsForUser failed during group sync', error)
    return
  }

  for (const groupId of endedGroups) {
    if (desired.has(groupId)) continue
    try {
      await removeUserFromGroup(groupId, userId)
    } catch (error) {
      console.error('[subscriptions] removeUserFromGroup failed', groupId, userId, error)
    }
  }
}

/** Re-add groups from all active periods (e.g. after exclusive-subject shuffle). */
export async function resyncUserSubscriptionGroups(
  userId: string,
  now = new Date(),
): Promise<void> {
  const uid = userId.trim()
  if (!uid) return
  try {
    const { listActivePeriodsForUser } = await import('./store')
    const active = await listActivePeriodsForUser(uid, now)
    for (const p of active) {
      await syncGroupsOnActivate(p)
    }
  } catch (error) {
    console.error('[subscriptions] resyncUserSubscriptionGroups failed', error)
  }
}
