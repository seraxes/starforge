/**
 * Persist Core account retention clock + call pack hide/purge doors.
 * Pure rules live in `account-retention.ts`.
 */
import 'server-only'

import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { getSiteSettings } from '@/core/settings'
import { userIsAppAdmin } from './admin'
import {
  approveFinalDelete,
  clampAccountRetentionDays,
  DEFAULT_ACCOUNT_RETENTION_DAYS,
  emptyRetentionBag,
  hideAccount,
  restoreAccount,
  setLegalHold,
  type AccountRetentionState,
  type FinalDeleteResult,
  type HideAccountResult,
  type RestoreAccountResult,
  type RetentionActor,
  type SetLegalHoldResult,
} from './account-retention'

/** Pack doors Core calls on hide / final purge via `loadModuleDoor`. */
export const ACCOUNT_HIDE_DOORS = [
  { doorId: 'social-api-server', method: 'hideOwnedSocialContent' },
] as const

export const ACCOUNT_PURGE_DOORS = [
  { doorId: 'social-api-server', method: 'purgeOwnSocialRecord' },
] as const

export const ACCOUNT_RESTORE_DOORS = [
  { doorId: 'social-api-server', method: 'setMemberHiddenAt' },
] as const

export async function getAccountRetentionDays(): Promise<number> {
  try {
    const settings = await getSiteSettings()
    return clampAccountRetentionDays(settings.accountRetentionDays)
  } catch {
    return DEFAULT_ACCOUNT_RETENTION_DAYS
  }
}

function rowToState(row: {
  id: string
  role: string | null
  hiddenAt: Date | null
  purgeEligibleAt: Date | null
  legalHold: boolean | null
}): AccountRetentionState {
  return {
    userId: row.id,
    role: row.role,
    hiddenAt: row.hiddenAt,
    purgeEligibleAt: row.purgeEligibleAt,
    legalHold: Boolean(row.legalHold),
  }
}

export async function loadAccountRetentionState(
  userId: string,
): Promise<AccountRetentionState | null> {
  const id = userId.trim()
  if (!id) return null
  const [row] = await db
    .select({
      id: sfUsers.id,
      role: sfUsers.role,
      hiddenAt: sfUsers.hiddenAt,
      purgeEligibleAt: sfUsers.purgeEligibleAt,
      legalHold: sfUsers.legalHold,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, id))
    .limit(1)
  return row ? rowToState(row) : null
}

export function actorFromUser(user: {
  id: string
  role?: string | null
  email?: string | null
}): RetentionActor {
  return {
    userId: user.id,
    isAppAdmin: userIsAppAdmin(user),
    canRestore: userIsAppAdmin(user),
  }
}

async function persistRetentionState(state: AccountRetentionState): Promise<void> {
  await db
    .update(sfUsers)
    .set({
      hiddenAt: state.hiddenAt,
      purgeEligibleAt: state.purgeEligibleAt,
      legalHold: state.legalHold,
      updatedAt: new Date(),
    })
    .where(eq(sfUsers.id, state.userId))
}

/**
 * Pack hide after Core already authorized the retention hide.
 * Pass `isStaff: false` so Social content is hidden; Core owns the staff gate.
 */
async function callHideDoors(userId: string): Promise<void> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    for (const entry of ACCOUNT_HIDE_DOORS) {
      try {
        const door = await loadModuleDoor(entry.doorId)
        const fn = door?.[entry.method] as
          | ((input: { userId: string; isStaff?: boolean }) => Promise<unknown>)
          | undefined
        if (typeof fn === 'function') {
          await fn({ userId, isStaff: false })
        }
      } catch (error) {
        console.error(
          `[account-retention] hide door ${entry.doorId}.${entry.method} failed`,
          error,
        )
      }
    }
  } catch (error) {
    console.error('[account-retention] hide doors unavailable', error)
  }
}

async function callRestoreDoors(userId: string): Promise<void> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    for (const entry of ACCOUNT_RESTORE_DOORS) {
      try {
        const door = await loadModuleDoor(entry.doorId)
        const fn = door?.[entry.method] as
          | ((userId: string, hiddenAt: Date | null) => Promise<unknown>)
          | undefined
        if (typeof fn === 'function') {
          await fn(userId, null)
        }
      } catch (error) {
        console.error(
          `[account-retention] restore door ${entry.doorId}.${entry.method} failed`,
          error,
        )
      }
    }
  } catch (error) {
    console.error('[account-retention] restore doors unavailable', error)
  }
}

/** Call each pack purge door (including `purgeOwnSocialRecord`). Failures are logged. */
export async function callAccountPurgeDoors(userId: string): Promise<void> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    for (const entry of ACCOUNT_PURGE_DOORS) {
      try {
        const door = await loadModuleDoor(entry.doorId)
        const fn = door?.[entry.method] as
          | ((input: { userId: string }) => Promise<unknown>)
          | undefined
        if (typeof fn === 'function') {
          await fn({ userId })
        }
      } catch (error) {
        console.error(
          `[account-retention] purge door ${entry.doorId}.${entry.method} failed`,
          error,
        )
      }
    }
  } catch (error) {
    console.error('[account-retention] purge doors unavailable', error)
  }
}

export async function hideAccountInDb(
  userId: string,
  actor: RetentionActor,
  opts?: { now?: Date },
): Promise<HideAccountResult> {
  const state = await loadAccountRetentionState(userId)
  if (!state) return { ok: false, reason: 'not_found' }

  const retentionDays = await getAccountRetentionDays()
  const bag = emptyRetentionBag(state)
  const result = hideAccount(bag, actor, {
    now: opts?.now,
    retentionDays,
  })
  if (!result.ok) return result

  await persistRetentionState(result.account)
  await callHideDoors(result.account.userId)
  return result
}

export async function restoreAccountInDb(
  userId: string,
  actor: RetentionActor,
): Promise<RestoreAccountResult> {
  const state = await loadAccountRetentionState(userId)
  if (!state) return { ok: false, reason: 'not_found' }

  const bag = emptyRetentionBag(state)
  const result = restoreAccount(bag, actor)
  if (!result.ok) return result

  await persistRetentionState(result.account)
  await callRestoreDoors(result.account.userId)
  return result
}

export async function setLegalHoldInDb(
  userId: string,
  actor: RetentionActor,
  hold: boolean,
): Promise<SetLegalHoldResult> {
  const state = await loadAccountRetentionState(userId)
  if (!state) return { ok: false, reason: 'not_found' }

  const bag = emptyRetentionBag(state)
  const result = setLegalHold(bag, actor, hold)
  if (!result.ok) return result

  await persistRetentionState(result.account)
  return result
}

/**
 * Approve final delete. On success the caller must run
 * `callAccountPurgeDoors` then Better Auth `deleteUser`.
 */
export async function approveFinalDeleteInDb(
  userId: string,
  actor: RetentionActor,
  opts?: { now?: Date },
): Promise<FinalDeleteResult> {
  const state = await loadAccountRetentionState(userId)
  if (!state) return { ok: false, reason: 'not_found' }

  const bag = emptyRetentionBag(state)
  return approveFinalDelete(bag, actor, { now: opts?.now })
}
