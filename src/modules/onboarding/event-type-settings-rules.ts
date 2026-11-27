/**
 * Pure event-type settings + depot rules, and completed-status → passed outcome planning.
 * Store / settings call these; unit tests hit this module without DB.
 */

import {
  ONBOARDING_EMAIL_EVENT_TYPES,
  type OnboardingEmailEventType,
} from './email-binding-rules'

export type OnboardingEventTypeSettings = {
  /** Forms definition id (plain text). Empty = unbound. */
  formDefinitionId: string
  /**
   * Date field name(s) on that form.
   * Testday is typically one; trialday may be several.
   */
  dateFieldNames: string[]
  /** Status ids where the event card stays editable. */
  activeStatusIds: string[]
  /** Moving a person onto one of these sets open events of this type to passed. */
  completedStatusIds: string[]
}

export const DEFAULT_EVENT_TYPE_SETTINGS: OnboardingEventTypeSettings = {
  formDefinitionId: '',
  dateFieldNames: [],
  activeStatusIds: [],
  completedStatusIds: [],
}

/** Outcomes that mean the event is no longer open. */
const TERMINAL_OUTCOMES = new Set(['passed', 'failed', 'no_show', 'completed'])

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export function isEventOutcomeOpen(outcome: string): boolean {
  const trimmed = outcome.trim()
  if (!trimmed) return true
  return !TERMINAL_OUTCOMES.has(trimmed)
}

export function normalizeEventTypeSettings(raw: unknown): OnboardingEventTypeSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    formDefinitionId: asTrimmed(obj.formDefinitionId),
    dateFieldNames: asStringList(obj.dateFieldNames),
    activeStatusIds: asStringList(obj.activeStatusIds),
    completedStatusIds: asStringList(obj.completedStatusIds),
  }
}

export function normalizeAllEventTypeSettings(
  raw: unknown,
): Record<OnboardingEmailEventType, OnboardingEventTypeSettings> {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = {} as Record<OnboardingEmailEventType, OnboardingEventTypeSettings>
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    out[key] = normalizeEventTypeSettings(obj[key])
  }
  return out
}

export type DepotFieldInput = {
  name?: unknown
  address?: unknown
  sortOrder?: unknown
}

export type DepotFieldValues = {
  name: string
  address: string
  sortOrder: number
}

/**
 * Depot short name + address. Empty name is refused.
 */
export function validateDepotFields(
  input: DepotFieldInput,
  existing?: Partial<DepotFieldValues>,
): { ok: true; values: DepotFieldValues } | { ok: false; error: string } {
  const name = asTrimmed(input.name !== undefined ? input.name : existing?.name)
  if (!name) return { ok: false, error: 'Depot name is required.' }

  const address = asTrimmed(
    input.address !== undefined ? input.address : (existing?.address ?? ''),
  )

  let sortOrder = existing?.sortOrder ?? 0
  if (input.sortOrder !== undefined && input.sortOrder !== null && input.sortOrder !== '') {
    const n =
      typeof input.sortOrder === 'number'
        ? input.sortOrder
        : Number(String(input.sortOrder).trim())
    if (!Number.isFinite(n)) return { ok: false, error: 'Sort order must be a number.' }
    sortOrder = Math.floor(n)
  }

  return { ok: true, values: { name, address, sortOrder } }
}

export type OpenEventForOutcome = {
  id: string
  kind: string
  outcome: string
}

export type CompletedStatusEventType = {
  key: string
  completedStatusIds: readonly string[]
}

/**
 * When the person moves onto `newStatusId`, which open events should become `passed`.
 * Walks every catalog type, not a fixed list of three.
 * Never plans failed or no_show. Does not change the person’s status.
 */
export function planPassedOutcomesForCompletedStatus(input: {
  newStatusId: string
  eventTypes: readonly CompletedStatusEventType[]
  openEvents: OpenEventForOutcome[]
}): {
  eventIds: string[]
  /** Always passed — never failed or no_show. */
  outcome: 'passed'
  kinds: string[]
} {
  const statusId = asTrimmed(input.newStatusId)
  const kinds: string[] = []
  if (!statusId) {
    return { eventIds: [], outcome: 'passed', kinds }
  }

  for (const row of input.eventTypes) {
    const key = asTrimmed(row.key)
    if (!key) continue
    const completed = row.completedStatusIds ?? []
    if (completed.some((id) => asTrimmed(id) === statusId)) {
      kinds.push(key)
    }
  }

  if (kinds.length === 0) {
    return { eventIds: [], outcome: 'passed', kinds }
  }

  const kindSet = new Set<string>(kinds)
  const eventIds = input.openEvents
    .filter((event) => kindSet.has(event.kind) && isEventOutcomeOpen(event.outcome))
    .map((event) => event.id)

  return { eventIds, outcome: 'passed', kinds }
}

/** Map depot rows to the station picker shape used while Fleet is absent. */
export function depotsAsStationCatalog(
  depots: Array<{ id: string; name: string }>,
): Array<{ id: string; label: string }> {
  return depots.map((depot) => ({
    id: depot.id,
    label: depot.name.trim() || depot.id,
  }))
}
