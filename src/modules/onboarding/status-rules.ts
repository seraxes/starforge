/**
 * Pure status / identity validation and bookable / station rules.
 * Store and door call these; unit tests hit this module without DB or Fleet.
 */

import type { OnboardingStationRecord } from './types'

/** Workflow phases. Active is bookable. Do not copy Joomla group ids. */
export const ONBOARDING_STATUS_PHASES = [
  'recruiting',
  'declined',
  'inactive',
  'active',
  'banned',
] as const

export type OnboardingStatusPhase = (typeof ONBOARDING_STATUS_PHASES)[number]

export type StatusFieldInput = {
  name?: unknown
  key?: unknown
  phase?: unknown
  displayLabel?: unknown
  actionChip?: unknown
  nextStepMessage?: unknown
  pageId?: unknown
  bookable?: unknown
  formDefinitionId?: unknown
  sortOrder?: unknown
}

export type StatusFieldValues = {
  name: string
  key: string
  phase: OnboardingStatusPhase
  displayLabel: string
  actionChip: string
  nextStepMessage: string
  /** Optional Pages page id (plain text). Empty = unbound. */
  pageId: string
  bookable: boolean
  formDefinitionId: string
  sortOrder: number
}

export type IdentityFieldInput = {
  statusId?: unknown
  driverCode?: unknown
  phone?: unknown
  stationId?: unknown
  homeRunAllow?: unknown
  homeRunFreeKm?: unknown
  trainer?: unknown
  clearquote?: unknown
}

export type IdentityFieldValues = {
  statusId: string
  /** Null when unset (blank). */
  driverCode: string | null
  phone: string
  stationId: string
  homeRunAllow: boolean
  homeRunFreeKm: number
  trainer: boolean
  clearquote: string
}

const DRIVER_CODE_MAX = 6

const PHASE_SET = new Set<string>(ONBOARDING_STATUS_PHASES)

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function parseNonNegInt(
  raw: unknown,
  fallback: number,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: fallback }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` }
  if (n < 0) return { ok: false, error: `${label} cannot be negative.` }
  return { ok: true, value: Math.floor(n) }
}

function asBool(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw === 'boolean') return raw
  const s = String(raw).trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  return Boolean(raw)
}

/** Slugify a status name into a stable key when the caller leaves key blank. */
export function slugifyStatusKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function isOnboardingStatusPhase(raw: unknown): raw is OnboardingStatusPhase {
  return PHASE_SET.has(asTrimmed(raw))
}

/** Active phase is bookable. Other phases are not (vehicle access is separate). */
export function bookableFromPhase(phase: OnboardingStatusPhase): boolean {
  return phase === 'active'
}

/**
 * Label shown on the driver / people list.
 * Display label wins; empty → status name.
 */
export function statusListLabel(status: {
  displayLabel?: string | null
  name?: string | null
}): string {
  const label = (status.displayLabel ?? '').trim()
  if (label) return label
  return (status.name ?? '').trim()
}

/**
 * Catalog / picker list: every named status is returned.
 * Adding a status with a name is enough for later slices to list it.
 */
export function statusesForCatalog<T extends { name: string }>(
  statuses: ReadonlyArray<T>,
): T[] {
  return statuses.filter((row) => row.name.trim().length > 0)
}

/**
 * Drag-reorder payload must list every existing status id exactly once.
 * Store refuses a stale or partial order so sort_order stays consistent.
 */
export function validateStatusReorderIds(
  orderedIds: ReadonlyArray<string>,
  existingIds: ReadonlyArray<string>,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  const ids = orderedIds.map((id) => String(id ?? '').trim()).filter(Boolean)
  if (ids.length === 0) return { ok: false, error: 'Missing status order.' }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: 'Status order has duplicate ids.' }
  }
  const existing = existingIds.map((id) => String(id ?? '').trim()).filter(Boolean)
  const existingSet = new Set(existing)
  if (ids.length !== existing.length || ids.some((id) => !existingSet.has(id))) {
    return { ok: false, error: 'Status order is out of date — refresh and try again.' }
  }
  return { ok: true, ids }
}

/**
 * Bookable when the status flag is on, or the caller passes Fleet vehicle access.
 * Neither → deny. Does not invent a driver.
 */
export function isBookable(statusBookable: boolean, hasVehicleAccess: boolean): boolean {
  return Boolean(statusBookable) || Boolean(hasVehicleAccess)
}

/**
 * Fleet’s station contribution while Fleet is absent from the tree.
 * Always empty — do not invent Fleet stations or import a Fleet module.
 * The Onboarding depot catalog (slice 10) is loaded separately via `listStations`.
 */
export function listStationsWhileFleetAbsent(): OnboardingStationRecord[] {
  return []
}

/**
 * Validate a driver code. Blank → unset (null). Longer than 6 → refuse.
 */
export function validateDriverCode(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const code = asTrimmed(raw)
  if (!code) return { ok: true, value: null }
  if (code.length > DRIVER_CODE_MAX) {
    return { ok: false, error: `Driver code must be at most ${DRIVER_CODE_MAX} characters.` }
  }
  return { ok: true, value: code }
}

/** Normalize and validate status fields. Refuses an empty name. Active phase → bookable. */
export function validateStatusFields(
  input: StatusFieldInput,
  existing?: Partial<StatusFieldValues>,
): { ok: true; values: StatusFieldValues } | { ok: false; error: string } {
  const name = asTrimmed(input.name !== undefined ? input.name : existing?.name)
  if (!name) return { ok: false, error: 'Status name is required.' }

  const keyRaw = asTrimmed(input.key !== undefined ? input.key : existing?.key)
  const key = keyRaw || slugifyStatusKey(name)
  if (!key) return { ok: false, error: 'Status key is required.' }

  const phaseRaw = asTrimmed(
    input.phase !== undefined ? input.phase : (existing?.phase ?? 'recruiting'),
  )
  const phaseCandidate = phaseRaw || 'recruiting'
  if (!isOnboardingStatusPhase(phaseCandidate)) {
    return {
      ok: false,
      error: `Phase must be one of: ${ONBOARDING_STATUS_PHASES.join(', ')}.`,
    }
  }
  const phase = phaseCandidate

  const displayLabel = asTrimmed(
    input.displayLabel !== undefined ? input.displayLabel : (existing?.displayLabel ?? ''),
  )
  const actionChip = asTrimmed(
    input.actionChip !== undefined ? input.actionChip : (existing?.actionChip ?? ''),
  )
  const nextStepMessage = asTrimmed(
    input.nextStepMessage !== undefined
      ? input.nextStepMessage
      : (existing?.nextStepMessage ?? ''),
  )
  const pageId = asTrimmed(
    input.pageId !== undefined ? input.pageId : (existing?.pageId ?? ''),
  )

  // Phase owns bookable. Active → true.
  const bookable = bookableFromPhase(phase)

  const formDefinitionId = asTrimmed(
    input.formDefinitionId !== undefined
      ? input.formDefinitionId
      : (existing?.formDefinitionId ?? ''),
  )
  const sortParsed = parseNonNegInt(
    input.sortOrder !== undefined ? input.sortOrder : existing?.sortOrder,
    existing?.sortOrder ?? 0,
    'Sort order',
  )
  if (!sortParsed.ok) return sortParsed

  return {
    ok: true,
    values: {
      name,
      key,
      phase,
      displayLabel: displayLabel || name,
      actionChip,
      nextStepMessage,
      pageId,
      bookable,
      formDefinitionId,
      sortOrder: sortParsed.value,
    },
  }
}

/** Normalize identity fact fields. Driver code longer than 6 is refused. */
export function validateIdentityFields(
  input: IdentityFieldInput,
  existing?: Partial<IdentityFieldValues>,
): { ok: true; values: IdentityFieldValues } | { ok: false; error: string } {
  const statusId = asTrimmed(
    input.statusId !== undefined ? input.statusId : (existing?.statusId ?? ''),
  )

  const codeParsed = validateDriverCode(
    input.driverCode !== undefined ? input.driverCode : (existing?.driverCode ?? null),
  )
  if (!codeParsed.ok) return codeParsed

  const phone = asTrimmed(input.phone !== undefined ? input.phone : (existing?.phone ?? ''))
  const stationId = asTrimmed(
    input.stationId !== undefined ? input.stationId : (existing?.stationId ?? ''),
  )
  const homeRunAllow = asBool(
    input.homeRunAllow !== undefined ? input.homeRunAllow : existing?.homeRunAllow,
    existing?.homeRunAllow ?? false,
  )
  const kmParsed = parseNonNegInt(
    input.homeRunFreeKm !== undefined ? input.homeRunFreeKm : existing?.homeRunFreeKm,
    existing?.homeRunFreeKm ?? 0,
    'Home-run free km',
  )
  if (!kmParsed.ok) return kmParsed
  const trainer = asBool(
    input.trainer !== undefined ? input.trainer : existing?.trainer,
    existing?.trainer ?? false,
  )
  const clearquote = asTrimmed(
    input.clearquote !== undefined ? input.clearquote : (existing?.clearquote ?? ''),
  )

  return {
    ok: true,
    values: {
      statusId,
      driverCode: codeParsed.value,
      phone,
      stationId,
      homeRunAllow,
      homeRunFreeKm: kmParsed.value,
      trainer,
      clearquote,
    },
  }
}
