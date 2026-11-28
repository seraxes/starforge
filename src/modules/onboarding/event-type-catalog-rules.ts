/**
 * Pure event-type catalog rules.
 * Store / actions call these; unit tests hit this module without DB.
 *
 * Seeds are examples. Staff can add more. A deactivated type stays on existing
 * person cards and is hidden from the new-event kind list. Delete is refused
 * while a person card uses the key.
 */

import type { OnboardingEventTypeSettings } from './event-type-settings-rules'
import { normalizeEventTypeSettings } from './event-type-settings-rules'

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function asBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw == null || raw === '') return fallback
  const s = String(raw).trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  return fallback
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

/** Slugify a label or typed key into the value stored on person cards. */
export function slugifyEventTypeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export type EventTypeFieldInput = {
  key?: unknown
  label?: unknown
  enabled?: unknown
  templateId?: unknown
  formDefinitionId?: unknown
  dateFieldNames?: unknown
  activeStatusIds?: unknown
  completedStatusIds?: unknown
  sortOrder?: unknown
}

export type EventTypeFieldValues = {
  key: string
  label: string
  enabled: boolean
  templateId: string
  formDefinitionId: string
  dateFieldNames: string[]
  activeStatusIds: string[]
  completedStatusIds: string[]
  sortOrder: number
}

/** Seed rows — editable and not a fixed product set. All start enabled. */
export const SEEDED_ONBOARDING_EVENT_TYPES: ReadonlyArray<{
  id: string
  key: string
  label: string
  sortOrder: number
}> = [
  { id: 'etype_ridealong', key: 'ridealong', label: 'Ride-along', sortOrder: 10 },
  { id: 'etype_testday', key: 'testday', label: 'Test day', sortOrder: 20 },
  { id: 'etype_trialday', key: 'trialday', label: 'Trial day', sortOrder: 30 },
  { id: 'etype_trainingday', key: 'trainingday', label: 'Training day', sortOrder: 40 },
]

/**
 * Catalog fields. Empty label is refused. Duplicate key is refused.
 * Blank key is built from the label.
 */
export function validateEventTypeFields(
  input: EventTypeFieldInput,
  existing?: Partial<EventTypeFieldValues>,
  takenKeys: readonly string[] = [],
): { ok: true; values: EventTypeFieldValues } | { ok: false; error: string } {
  const label = asTrimmed(input.label !== undefined ? input.label : existing?.label)
  if (!label) return { ok: false, error: 'Event type label is required.' }

  const keySource =
    input.key !== undefined && asTrimmed(input.key)
      ? asTrimmed(input.key)
      : asTrimmed(existing?.key) || label
  const key = slugifyEventTypeKey(keySource)
  if (!key) return { ok: false, error: 'Event type key is required.' }

  const ownKey = slugifyEventTypeKey(asTrimmed(existing?.key))
  const taken = new Set(takenKeys.map((item) => slugifyEventTypeKey(item)).filter(Boolean))
  if (taken.has(key) && key !== ownKey) {
    return { ok: false, error: `Event type key “${key}” is already in use.` }
  }

  const enabled =
    input.enabled !== undefined ? asBool(input.enabled, true) : Boolean(existing?.enabled ?? true)

  const settings: OnboardingEventTypeSettings = normalizeEventTypeSettings({
    formDefinitionId:
      input.formDefinitionId !== undefined
        ? input.formDefinitionId
        : (existing?.formDefinitionId ?? ''),
    dateFieldNames:
      input.dateFieldNames !== undefined
        ? input.dateFieldNames
        : (existing?.dateFieldNames ?? []),
    activeStatusIds:
      input.activeStatusIds !== undefined
        ? input.activeStatusIds
        : (existing?.activeStatusIds ?? []),
    completedStatusIds:
      input.completedStatusIds !== undefined
        ? input.completedStatusIds
        : (existing?.completedStatusIds ?? []),
  })

  const templateId = asTrimmed(
    input.templateId !== undefined ? input.templateId : (existing?.templateId ?? ''),
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

  return {
    ok: true,
    values: {
      key,
      label,
      enabled,
      templateId,
      formDefinitionId: settings.formDefinitionId,
      dateFieldNames: settings.dateFieldNames,
      activeStatusIds: settings.activeStatusIds,
      completedStatusIds: settings.completedStatusIds,
      sortOrder,
    },
  }
}

/**
 * Delete removes the type only when no person card uses the key.
 * A refused delete leaves the type in place.
 */
export function planDeleteEventType(input: {
  cardCount: number
}): { ok: true } | { ok: false; error: string; kept: true } {
  const count = Number.isFinite(input.cardCount) ? Math.max(0, Math.floor(input.cardCount)) : 0
  if (count > 0) {
    return {
      ok: false,
      kept: true,
      error: 'This event type is used on a person card. Deactivate it instead of deleting.',
    }
  }
  return { ok: true }
}

/** New-event kind list: enabled types only. */
export function eventTypesForNewCard<T extends { enabled: boolean }>(types: readonly T[]): T[] {
  return types.filter((row) => row.enabled)
}

/**
 * Existing card: enabled types, plus the card’s current key when that type is deactivated.
 */
export function eventTypesForExistingCard<T extends { key: string; enabled: boolean }>(
  types: readonly T[],
  currentKey: string,
): T[] {
  const enabled = eventTypesForNewCard(types)
  const key = currentKey.trim()
  if (!key || enabled.some((row) => row.key === key)) return enabled
  const current = types.find((row) => row.key === key)
  return current ? [...enabled, current] : enabled
}

export function asEventTypeStringList(raw: unknown): string[] {
  return asStringList(raw)
}
