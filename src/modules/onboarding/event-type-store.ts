/**
 * Onboarding event-type catalog.
 * Person cards store the key on sf_onboarding_events.kind (plain text, no FK).
 * Deleting a card does not delete the type. Deleting a type is refused while a card uses the key.
 */

import 'server-only'

import { asc, count, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'
import { loadModuleSettingsDocument } from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import { validateEmailTemplateBinding } from './email-binding-rules'
import {
  SEEDED_ONBOARDING_EVENT_TYPES,
  planDeleteEventType,
  validateEventTypeFields,
  type EventTypeFieldInput,
} from './event-type-catalog-rules'
import { sfOnboardingEventTypes, sfOnboardingEvents } from './schema'
import { readLegacyEventTypeSeed } from './settings'
import type { OnboardingEventTypeRecord } from './types'

function newId(): string {
  return `etype_${randomUUID().replace(/-/g, '')}`
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function mapEventType(row: typeof sfOnboardingEventTypes.$inferSelect): OnboardingEventTypeRecord {
  return {
    id: row.id,
    key: (row.key ?? '').trim(),
    label: (row.label ?? '').trim(),
    enabled: row.enabled !== false,
    templateId: (row.templateId ?? '').trim(),
    formDefinitionId: (row.formDefinitionId ?? '').trim(),
    dateFieldNames: asStringList(row.dateFieldNames),
    activeStatusIds: asStringList(row.activeStatusIds),
    completedStatusIds: asStringList(row.completedStatusIds),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function templateExists(templateId: string): Promise<boolean> {
  const id = templateId.trim()
  if (!id) return false
  try {
    const { findEmailTemplateById } = await import('@/modules/email-manager/api.server')
    return Boolean(await findEmailTemplateById(id))
  } catch {
    return false
  }
}

export async function listEventTypes(): Promise<OnboardingEventTypeRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingEventTypes)
    .orderBy(asc(sfOnboardingEventTypes.sortOrder), asc(sfOnboardingEventTypes.label))
  return rows.map(mapEventType)
}

export async function getEventTypeById(
  eventTypeId: string,
): Promise<OnboardingEventTypeRecord | null> {
  const id = eventTypeId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingEventTypes)
    .where(eq(sfOnboardingEventTypes.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapEventType(row) : null
}

export async function getEventTypeByKey(key: string): Promise<OnboardingEventTypeRecord | null> {
  const normalized = key.trim()
  if (!normalized) return null
  const rows = await db
    .select()
    .from(sfOnboardingEventTypes)
    .where(eq(sfOnboardingEventTypes.key, normalized))
    .limit(1)
  const row = rows[0]
  return row ? mapEventType(row) : null
}

async function countCardsForKey(key: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(sfOnboardingEvents)
    .where(eq(sfOnboardingEvents.kind, key))
  return Number(rows[0]?.n ?? 0)
}

/**
 * Ensure ridealong / testday / trialday / trainingday exist. Idempotent by key.
 * First insert copies legacy module-settings values for the three types that had them.
 */
export async function ensureSeededEventTypes(): Promise<OnboardingEventTypeRecord[]> {
  const existing = await listEventTypes()
  const byKey = new Map(existing.map((row) => [row.key, row]))

  const loaded = await loadModuleSettingsDocument(MODULE_IDS.onboarding, () => ({}))
  const legacy = readLegacyEventTypeSeed(loaded.document)

  for (const seed of SEEDED_ONBOARDING_EVENT_TYPES) {
    if (byKey.has(seed.key)) continue
    const prior = legacy[seed.key]
    await db.insert(sfOnboardingEventTypes).values({
      id: seed.id,
      key: seed.key,
      label: seed.label,
      enabled: true,
      templateId: prior?.templateId ?? '',
      formDefinitionId: prior?.formDefinitionId ?? '',
      dateFieldNames: prior?.dateFieldNames ?? [],
      activeStatusIds: prior?.activeStatusIds ?? [],
      completedStatusIds: prior?.completedStatusIds ?? [],
      sortOrder: seed.sortOrder,
    })
    const saved = await getEventTypeById(seed.id)
    if (saved) byKey.set(saved.key, saved)
  }

  return [...byKey.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  )
}

export type EventTypeMutationResult =
  | { ok: true; eventType: OnboardingEventTypeRecord }
  | { ok: false; error: string }

async function assertTemplateId(
  templateId: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  if (!templateId) return { ok: true, value: '' }
  const exists = await templateExists(templateId)
  return validateEmailTemplateBinding(templateId, () => exists, 'Event template')
}

export async function createEventType(
  input: EventTypeFieldInput,
): Promise<EventTypeMutationResult> {
  const existing = await listEventTypes()
  const nextSort = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  const parsed = validateEventTypeFields(
    {
      ...input,
      sortOrder:
        input.sortOrder !== undefined && input.sortOrder !== '' ? input.sortOrder : nextSort,
    },
    undefined,
    existing.map((row) => row.key),
  )
  if (!parsed.ok) return parsed

  const template = await assertTemplateId(parsed.values.templateId)
  if (!template.ok) return template

  const clash = await getEventTypeByKey(parsed.values.key)
  if (clash) {
    return { ok: false, error: `Event type key “${parsed.values.key}” is already in use.` }
  }

  const id = newId()
  await db.insert(sfOnboardingEventTypes).values({
    id,
    key: parsed.values.key,
    label: parsed.values.label,
    enabled: parsed.values.enabled,
    templateId: template.value,
    formDefinitionId: parsed.values.formDefinitionId,
    dateFieldNames: parsed.values.dateFieldNames,
    activeStatusIds: parsed.values.activeStatusIds,
    completedStatusIds: parsed.values.completedStatusIds,
    sortOrder: parsed.values.sortOrder,
  })

  const saved = await getEventTypeById(id)
  if (!saved) return { ok: false, error: 'Failed to create event type.' }
  return { ok: true, eventType: saved }
}

export async function updateEventType(
  eventTypeId: string,
  input: EventTypeFieldInput,
): Promise<EventTypeMutationResult> {
  const id = eventTypeId.trim()
  if (!id) return { ok: false, error: 'Missing event type id.' }
  const existing = await getEventTypeById(id)
  if (!existing) return { ok: false, error: 'Event type not found.' }

  const parsed = validateEventTypeFields({ ...input, key: existing.key }, existing, [])
  if (!parsed.ok) return parsed

  const template = await assertTemplateId(parsed.values.templateId)
  if (!template.ok) return template

  await db
    .update(sfOnboardingEventTypes)
    .set({
      label: parsed.values.label,
      enabled: parsed.values.enabled,
      templateId: template.value,
      formDefinitionId: parsed.values.formDefinitionId,
      dateFieldNames: parsed.values.dateFieldNames,
      activeStatusIds: parsed.values.activeStatusIds,
      completedStatusIds: parsed.values.completedStatusIds,
      sortOrder: parsed.values.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingEventTypes.id, id))

  const saved = await getEventTypeById(id)
  if (!saved) return { ok: false, error: 'Failed to save event type.' }
  return { ok: true, eventType: saved }
}

export async function setEventTypeEnabled(
  eventTypeId: string,
  enabled: boolean,
): Promise<EventTypeMutationResult> {
  const id = eventTypeId.trim()
  if (!id) return { ok: false, error: 'Missing event type id.' }
  const existing = await getEventTypeById(id)
  if (!existing) return { ok: false, error: 'Event type not found.' }

  await db
    .update(sfOnboardingEventTypes)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(sfOnboardingEventTypes.id, id))

  const saved = await getEventTypeById(id)
  if (!saved) return { ok: false, error: 'Failed to update event type.' }
  return { ok: true, eventType: saved }
}

export async function deleteEventType(
  eventTypeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = eventTypeId.trim()
  if (!id) return { ok: false, error: 'Missing event type id.' }
  const existing = await getEventTypeById(id)
  if (!existing) return { ok: false, error: 'Event type not found.' }

  const cardCount = await countCardsForKey(existing.key)
  const planned = planDeleteEventType({ cardCount })
  if (!planned.ok) return { ok: false, error: planned.error }

  await db.delete(sfOnboardingEventTypes).where(eq(sfOnboardingEventTypes.id, id))
  return { ok: true }
}
