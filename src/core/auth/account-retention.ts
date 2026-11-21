/**
 * Core account retention clock.
 *
 * Member "delete" hides the account (`hiddenAt` + `purgeEligibleAt`) and keeps
 * rows. Restore clears the clock. Final delete is a separate approval after the
 * wait, with no legal hold, then pack purge doors + `deleteUser`.
 *
 * The five staff role names (DEV / SU / ADM / MNG / MOD) are not built yet.
 * Until then: refuse when the target is a staff account unless the actor is an
 * app admin who is not that user.
 */

import { normalizeAppRole } from './permissions'
import {
  ACCOUNT_RETENTION_DAYS_MAX,
  ACCOUNT_RETENTION_DAYS_MIN,
  DEFAULT_ACCOUNT_RETENTION_DAYS,
  clampAccountRetentionDays,
} from './account-retention-days'

export {
  ACCOUNT_RETENTION_DAYS_MAX,
  ACCOUNT_RETENTION_DAYS_MIN,
  DEFAULT_ACCOUNT_RETENTION_DAYS,
  clampAccountRetentionDays,
}

export type AccountRetentionState = {
  userId: string
  /** Better Auth / Core role (`admin` | `member`). */
  role: string | null | undefined
  hiddenAt: Date | null
  purgeEligibleAt: Date | null
  legalHold: boolean
}

/**
 * Related rows owned by the account (profiles, social, …). Hide must keep them.
 * Final delete may clear this bag after purge doors run.
 */
export type AccountRetentionBag = {
  account: AccountRetentionState
  /** Opaque related rows — hide never removes them. */
  relatedRows: Map<string, unknown>
  /** Set only after a successful final-delete approval. */
  finallyDeleted: boolean
}

export type RetentionActor = {
  userId: string
  /**
   * App admin (Better Auth `admin` / bootstrap). Until the five role names
   * exist, this stands in for SU/DEV restore and staff-target approvals.
   */
  isAppAdmin: boolean
  /**
   * Staff restore grant. Until five roles exist, same as `isAppAdmin`.
   */
  canRestore?: boolean
}

export type RetentionRefuseReason =
  | 'invalid'
  | 'not_found'
  | 'staff_account'
  | 'not_hidden'
  | 'too_early'
  | 'legal_hold'
  | 'forbidden'

export type HideAccountResult =
  | {
      ok: true
      account: AccountRetentionState
      /** Always false — hide never purges. */
      purged: false
    }
  | { ok: false; reason: RetentionRefuseReason }

export type RestoreAccountResult =
  | { ok: true; account: AccountRetentionState }
  | { ok: false; reason: RetentionRefuseReason }

export type SetLegalHoldResult =
  | { ok: true; account: AccountRetentionState }
  | { ok: false; reason: RetentionRefuseReason }

export type FinalDeleteResult =
  | {
      ok: true
      /** Caller must run pack purge doors then `deleteUser`. */
      shouldPurgeAndDeleteUser: true
    }
  | { ok: false; reason: RetentionRefuseReason }

/** Staff = app admin role until the five named roles exist. */
export function isStaffAccount(role: string | null | undefined): boolean {
  return normalizeAppRole(role) === 'admin'
}

/** Public pages treat a retention-hidden account as absent. */
export function isAccountPubliclyAbsent(
  account: Pick<AccountRetentionState, 'hiddenAt'> | null | undefined,
): boolean {
  return account?.hiddenAt != null
}

export function computePurgeEligibleAt(
  hiddenAt: Date,
  retentionDays: number = DEFAULT_ACCOUNT_RETENTION_DAYS,
): Date {
  const days = clampAccountRetentionDays(retentionDays)
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(hiddenAt.getTime() + ms)
}

/**
 * May the actor hide or finally delete this target?
 * Non-staff targets: member self-service or any app-admin actor.
 * Staff targets: only a different app admin (SU/DEV stand-in).
 */
export function canActOnAccountRetention(
  actor: RetentionActor,
  target: Pick<AccountRetentionState, 'userId' | 'role'>,
): boolean {
  const actorId = actor.userId.trim()
  const targetId = target.userId.trim()
  if (!actorId || !targetId) return false

  if (!isStaffAccount(target.role)) {
    // Member self-hide / self-restore, or staff acting on a member.
    if (actorId === targetId) return true
    return actor.isAppAdmin
  }

  // Staff target: never self; never non-admin (member / MOD / ADM stand-ins).
  if (actorId === targetId) return false
  return actor.isAppAdmin
}

function actorMayRestore(actor: RetentionActor): boolean {
  if (actor.canRestore != null) return actor.canRestore
  return actor.isAppAdmin
}

export function emptyRetentionBag(
  account: AccountRetentionState,
): AccountRetentionBag {
  return {
    account: { ...account },
    relatedRows: new Map(),
    finallyDeleted: false,
  }
}

/**
 * Hide the account and start the retention clock. Keeps related rows.
 * Never purges and never sets `finallyDeleted`.
 */
export function hideAccount(
  bag: AccountRetentionBag,
  actor: RetentionActor,
  opts?: { now?: Date; retentionDays?: number },
): HideAccountResult {
  const targetId = bag.account.userId.trim()
  const actorId = actor.userId.trim()
  if (!targetId || !actorId) return { ok: false, reason: 'invalid' }
  if (bag.finallyDeleted) return { ok: false, reason: 'not_found' }

  if (!canActOnAccountRetention(actor, bag.account)) {
    return { ok: false, reason: 'staff_account' }
  }

  // Already hidden — idempotent keep of rows + clock (do not move purgeEligibleAt).
  if (bag.account.hiddenAt) {
    return { ok: true, account: { ...bag.account }, purged: false }
  }

  const now = opts?.now ?? new Date()
  const retentionDays = clampAccountRetentionDays(opts?.retentionDays)
  const next: AccountRetentionState = {
    ...bag.account,
    hiddenAt: now,
    purgeEligibleAt: computePurgeEligibleAt(now, retentionDays),
  }
  bag.account = next
  return { ok: true, account: { ...next }, purged: false }
}

/**
 * Clear the retention clock. Self during the wait, or a staff restore grant.
 */
export function restoreAccount(
  bag: AccountRetentionBag,
  actor: RetentionActor,
): RestoreAccountResult {
  const targetId = bag.account.userId.trim()
  const actorId = actor.userId.trim()
  if (!targetId || !actorId) return { ok: false, reason: 'invalid' }
  if (bag.finallyDeleted) return { ok: false, reason: 'not_found' }
  if (!bag.account.hiddenAt) return { ok: false, reason: 'not_hidden' }

  const isSelf = actorId === targetId
  if (!isSelf && !actorMayRestore(actor)) {
    return { ok: false, reason: 'forbidden' }
  }
  // Staff restoring another staff account still needs the staff-target rule.
  if (!isSelf && !canActOnAccountRetention(actor, bag.account)) {
    return { ok: false, reason: 'staff_account' }
  }

  const next: AccountRetentionState = {
    ...bag.account,
    hiddenAt: null,
    purgeEligibleAt: null,
  }
  bag.account = next
  return { ok: true, account: { ...next } }
}

/** Legal hold keeps rows past purgeEligibleAt until cleared. */
export function setLegalHold(
  bag: AccountRetentionBag,
  actor: RetentionActor,
  hold: boolean,
): SetLegalHoldResult {
  const targetId = bag.account.userId.trim()
  const actorId = actor.userId.trim()
  if (!targetId || !actorId) return { ok: false, reason: 'invalid' }
  if (bag.finallyDeleted) return { ok: false, reason: 'not_found' }
  if (!actor.isAppAdmin) return { ok: false, reason: 'forbidden' }
  if (!canActOnAccountRetention(actor, bag.account)) {
    return { ok: false, reason: 'staff_account' }
  }

  const next: AccountRetentionState = {
    ...bag.account,
    legalHold: hold,
  }
  bag.account = next
  return { ok: true, account: { ...next } }
}

/**
 * Approve final delete. Does not remove rows here — the caller runs pack purge
 * doors via `loadModuleDoor`, then `deleteUser`.
 */
export function approveFinalDelete(
  bag: AccountRetentionBag,
  actor: RetentionActor,
  opts?: { now?: Date },
): FinalDeleteResult {
  const targetId = bag.account.userId.trim()
  const actorId = actor.userId.trim()
  if (!targetId || !actorId) return { ok: false, reason: 'invalid' }
  if (bag.finallyDeleted) return { ok: false, reason: 'not_found' }
  if (!bag.account.hiddenAt || !bag.account.purgeEligibleAt) {
    return { ok: false, reason: 'not_hidden' }
  }
  if (!canActOnAccountRetention(actor, bag.account)) {
    return { ok: false, reason: 'staff_account' }
  }
  // Final delete is never member self-service.
  if (!actor.isAppAdmin) return { ok: false, reason: 'forbidden' }

  const now = opts?.now ?? new Date()
  if (now.getTime() < bag.account.purgeEligibleAt.getTime()) {
    return { ok: false, reason: 'too_early' }
  }
  if (bag.account.legalHold) {
    return { ok: false, reason: 'legal_hold' }
  }

  bag.finallyDeleted = true
  return { ok: true, shouldPurgeAndDeleteUser: true }
}

/** In-memory bag for unit tests. */
export function createAccountRetentionMemory(opts?: {
  account?: Partial<AccountRetentionState> & { userId: string }
  now?: () => Date
  retentionDays?: number
}): {
  bag: AccountRetentionBag
  hide: (actor: RetentionActor) => HideAccountResult
  restore: (actor: RetentionActor) => RestoreAccountResult
  setHold: (actor: RetentionActor, hold: boolean) => SetLegalHoldResult
  finalDelete: (actor: RetentionActor) => FinalDeleteResult
  seedRelated: (id: string, value: unknown) => void
  relatedCount: () => number
} {
  const now = opts?.now ?? (() => new Date())
  const retentionDays = opts?.retentionDays ?? DEFAULT_ACCOUNT_RETENTION_DAYS
  const bag = emptyRetentionBag({
    userId: opts?.account?.userId ?? 'user-1',
    role: opts?.account?.role ?? 'member',
    hiddenAt: opts?.account?.hiddenAt ?? null,
    purgeEligibleAt: opts?.account?.purgeEligibleAt ?? null,
    legalHold: opts?.account?.legalHold ?? false,
  })

  return {
    bag,
    hide: (actor) => hideAccount(bag, actor, { now: now(), retentionDays }),
    restore: (actor) => restoreAccount(bag, actor),
    setHold: (actor, hold) => setLegalHold(bag, actor, hold),
    finalDelete: (actor) => approveFinalDelete(bag, actor, { now: now() }),
    seedRelated: (id, value) => {
      bag.relatedRows.set(id, value)
    },
    relatedCount: () => bag.relatedRows.size,
  }
}
