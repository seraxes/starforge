/**
 * Procedure cards, notes, follow-up, calls, mail log, workers list.
 * Outcome updates never touch identity statusId.
 */

import 'server-only'

import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'
import { sfUsers } from '@/core/db/schema'

import {
  isOnboardingEventKind,
  isOnboardingMailChannel,
  isOnboardingMeetingMode,
  isOutcomeAllowedForKind,
  statusIdAfterEventOutcome,
  validateEventFields,
  type EventFieldInput,
  type OnboardingEventKind,
  type OnboardingMailChannel,
  type OnboardingMeetingMode,
} from './procedure-rules'
import {
  sfOnboardingCalls,
  sfOnboardingEvents,
  sfOnboardingFollowUps,
  sfOnboardingIdentityFacts,
  sfOnboardingMailLogs,
  sfOnboardingNotes,
  sfOnboardingStatuses,
} from './schema'
import { ensureSeededStatuses, getIdentityFacts, writeIdentityFacts } from './store'
import { validateFollowUpTagIds } from './tag-catalog-rules'
import { ensureSeededTags, listTags } from './tag-store'
import type {
  OnboardingCallRecord,
  OnboardingDocumentSlotRecord,
  OnboardingEventRecord,
  OnboardingFollowUpRecord,
  OnboardingMailLogRecord,
  OnboardingNoteRecord,
  OnboardingWorkerRow,
} from './types'
import { listDocumentSlotsForUser } from './valid-until-store'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function mapEvent(row: typeof sfOnboardingEvents.$inferSelect): OnboardingEventRecord {
  const kind = isOnboardingEventKind(row.kind) ? row.kind : 'ridealong'
  const meetingMode: OnboardingMeetingMode = isOnboardingMeetingMode(row.meetingMode)
    ? row.meetingMode
    : 'onsite'
  return {
    id: row.id,
    userId: row.userId,
    kind,
    location: (row.location ?? '').trim(),
    address: (row.address ?? '').trim(),
    eventDate: (row.eventDate ?? '').trim(),
    eventTime: (row.eventTime ?? '').trim(),
    courierName: (row.courierName ?? '').trim(),
    courierPhone: (row.courierPhone ?? '').trim(),
    meetingMode,
    examUrl: (row.examUrl ?? '').trim(),
    applicantResponse: (row.applicantResponse ?? '').trim(),
    outcome: (row.outcome ?? '').trim(),
    outcomeActorUserId: (row.outcomeActorUserId ?? '').trim(),
    outcomeAt: row.outcomeAt ?? null,
    alsoTrial: row.alsoTrial === true,
    requestedDates: asStringList(row.requestedDates),
    requestedSubmissionId: (row.requestedSubmissionId ?? '').trim(),
    dueNotice: row.dueNotice === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapNote(row: typeof sfOnboardingNotes.$inferSelect): OnboardingNoteRecord {
  return {
    id: row.id,
    userId: row.userId,
    body: (row.body ?? '').trim(),
    authorUserId: (row.authorUserId ?? '').trim(),
    createdAt: row.createdAt,
  }
}

function mapFollowUp(row: typeof sfOnboardingFollowUps.$inferSelect): OnboardingFollowUpRecord {
  return {
    id: row.id,
    userId: row.userId,
    tags: asStringList(row.tags),
    note: (row.note ?? '').trim(),
    reminderStatus: (row.reminderStatus ?? 'open').trim() || 'open',
    reminderSentAt: row.reminderSentAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCall(row: typeof sfOnboardingCalls.$inferSelect): OnboardingCallRecord {
  return {
    id: row.id,
    userId: row.userId,
    callAt: row.callAt ?? null,
    done: row.done === true,
    dueNotice: row.dueNotice === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMailLog(row: typeof sfOnboardingMailLogs.$inferSelect): OnboardingMailLogRecord {
  const channel: OnboardingMailChannel = isOnboardingMailChannel(row.channel)
    ? row.channel
    : 'account_invite'
  return {
    id: row.id,
    userId: row.userId,
    channel,
    subject: (row.subject ?? '').trim(),
    body: row.body ?? '',
    toEmail: (row.toEmail ?? '').trim(),
    sentAt: row.sentAt,
    senderUserId: (row.senderUserId ?? '').trim(),
    createdAt: row.createdAt,
  }
}

export async function listEventsForUser(userId: string): Promise<OnboardingEventRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingEvents)
    .where(eq(sfOnboardingEvents.userId, id))
    .orderBy(desc(sfOnboardingEvents.createdAt))
  return rows.map(mapEvent)
}

export async function getEventById(eventId: string): Promise<OnboardingEventRecord | null> {
  const id = eventId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingEvents)
    .where(eq(sfOnboardingEvents.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapEvent(row) : null
}

export type EventMutationResult =
  | { ok: true; event: OnboardingEventRecord }
  | { ok: false; error: string }

export async function createEvent(
  userId: string,
  input: EventFieldInput,
): Promise<EventMutationResult> {
  const uid = userId.trim()
  if (!uid) return { ok: false, error: 'User id is required.' }
  const parsed = validateEventFields(input)
  if (!parsed.ok) return parsed

  const id = newId('onb_event')
  await db.insert(sfOnboardingEvents).values({
    id,
    userId: uid,
    kind: parsed.values.kind,
    location: parsed.values.location,
    address: parsed.values.address,
    eventDate: parsed.values.eventDate,
    eventTime: parsed.values.eventTime,
    courierName: parsed.values.courierName,
    courierPhone: parsed.values.courierPhone,
    meetingMode: parsed.values.meetingMode,
    examUrl: parsed.values.examUrl,
    applicantResponse: parsed.values.applicantResponse,
    alsoTrial: parsed.values.alsoTrial,
    requestedDates: parsed.values.requestedDates,
    requestedSubmissionId: parsed.values.requestedSubmissionId,
    dueNotice: parsed.values.dueNotice,
  })
  const saved = await getEventById(id)
  if (!saved) return { ok: false, error: 'Failed to create event.' }
  return { ok: true, event: saved }
}

export async function updateEvent(
  eventId: string,
  input: EventFieldInput,
): Promise<EventMutationResult> {
  const id = eventId.trim()
  if (!id) return { ok: false, error: 'Missing event id.' }
  const existing = await getEventById(id)
  if (!existing) return { ok: false, error: 'Event not found.' }

  const parsed = validateEventFields(input, existing)
  if (!parsed.ok) return parsed

  await db
    .update(sfOnboardingEvents)
    .set({
      kind: parsed.values.kind,
      location: parsed.values.location,
      address: parsed.values.address,
      eventDate: parsed.values.eventDate,
      eventTime: parsed.values.eventTime,
      courierName: parsed.values.courierName,
      courierPhone: parsed.values.courierPhone,
      meetingMode: parsed.values.meetingMode,
      examUrl: parsed.values.examUrl,
      applicantResponse: parsed.values.applicantResponse,
      alsoTrial: parsed.values.alsoTrial,
      requestedDates: parsed.values.requestedDates,
      requestedSubmissionId: parsed.values.requestedSubmissionId,
      dueNotice: parsed.values.dueNotice,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingEvents.id, id))

  const saved = await getEventById(id)
  if (!saved) return { ok: false, error: 'Failed to update event.' }
  return { ok: true, event: saved }
}

export type SetOutcomeResult =
  | {
      ok: true
      event: OnboardingEventRecord
      /** Status id before and after — always equal; outcome never advances main status. */
      statusIdBefore: string
      statusIdAfter: string
    }
  | { ok: false; error: string }

/**
 * Set the event’s own outcome. Does not change the person’s main status.
 */
/**
 * When a person moves onto a completed status for an event type, set that person’s
 * open events of that type to `passed`. Never sets failed or no_show.
 * Does not change the person’s status id.
 */
export async function applyCompletedStatusPassedOutcomes(
  userId: string,
  newStatusId: string,
  now: Date = new Date(),
): Promise<{ eventIds: string[]; outcome: 'passed' }> {
  const id = userId.trim()
  const statusId = newStatusId.trim()
  if (!id || !statusId) return { eventIds: [], outcome: 'passed' }

  const { loadOnboardingModuleSettings } = await import('./settings')
  const { planPassedOutcomesForCompletedStatus } = await import('./event-type-settings-rules')

  const loaded = await loadOnboardingModuleSettings()
  const events = await listEventsForUser(id)
  const plan = planPassedOutcomesForCompletedStatus({
    newStatusId: statusId,
    eventTypeSettings: loaded.settings.eventTypeSettings,
    openEvents: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      outcome: event.outcome,
    })),
  })

  if (plan.eventIds.length === 0) return { eventIds: [], outcome: 'passed' }

  await db
    .update(sfOnboardingEvents)
    .set({
      outcome: 'passed',
      outcomeActorUserId: '',
      outcomeAt: now,
      updatedAt: now,
    })
    .where(inArray(sfOnboardingEvents.id, plan.eventIds))

  return { eventIds: plan.eventIds, outcome: 'passed' }
}

export async function setEventOutcome(
  eventId: string,
  outcome: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<SetOutcomeResult> {
  const id = eventId.trim()
  if (!id) return { ok: false, error: 'Missing event id.' }
  const existing = await getEventById(id)
  if (!existing) return { ok: false, error: 'Event not found.' }

  const trimmedOutcome = outcome.trim()
  if (!isOutcomeAllowedForKind(existing.kind, trimmedOutcome)) {
    return {
      ok: false,
      error: `Outcome “${trimmedOutcome || '(blank)'}” is not allowed for ${existing.kind}.`,
    }
  }

  const factsBefore = await getIdentityFacts(existing.userId)
  const statusIdBefore = (factsBefore?.statusId ?? '').trim()

  await db
    .update(sfOnboardingEvents)
    .set({
      outcome: trimmedOutcome,
      outcomeActorUserId: actorUserId.trim(),
      outcomeAt: now,
      updatedAt: now,
    })
    .where(eq(sfOnboardingEvents.id, id))

  const factsAfter = await getIdentityFacts(existing.userId)
  const statusIdAfter = statusIdAfterEventOutcome(
    (factsAfter?.statusId ?? '').trim(),
    trimmedOutcome,
  )

  // Guard: never write identity from an outcome path.
  if (statusIdAfter !== statusIdBefore && statusIdBefore) {
    await writeIdentityFacts(existing.userId, { statusId: statusIdBefore })
  }

  const saved = await getEventById(id)
  if (!saved) return { ok: false, error: 'Failed to save outcome.' }
  return {
    ok: true,
    event: saved,
    statusIdBefore,
    statusIdAfter: (await getIdentityFacts(existing.userId))?.statusId?.trim() ?? statusIdBefore,
  }
}

export async function listNotesForUser(userId: string): Promise<OnboardingNoteRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingNotes)
    .where(eq(sfOnboardingNotes.userId, id))
    .orderBy(desc(sfOnboardingNotes.createdAt))
  return rows.map(mapNote)
}

export async function createNote(input: {
  userId: string
  body: string
  authorUserId: string
}): Promise<{ ok: true; note: OnboardingNoteRecord } | { ok: false; error: string }> {
  const userId = input.userId.trim()
  const body = input.body.trim()
  if (!userId) return { ok: false, error: 'User id is required.' }
  if (!body) return { ok: false, error: 'Note body is required.' }
  const id = newId('onb_note')
  await db.insert(sfOnboardingNotes).values({
    id,
    userId,
    body,
    authorUserId: input.authorUserId.trim(),
  })
  const rows = await db
    .select()
    .from(sfOnboardingNotes)
    .where(eq(sfOnboardingNotes.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, error: 'Failed to create note.' }
  return { ok: true, note: mapNote(row) }
}

export async function listFollowUpsForUser(userId: string): Promise<OnboardingFollowUpRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingFollowUps)
    .where(eq(sfOnboardingFollowUps.userId, id))
    .orderBy(desc(sfOnboardingFollowUps.updatedAt))
  return rows.map(mapFollowUp)
}

export async function upsertFollowUp(input: {
  id?: string
  userId: string
  /** Catalog tag ids (sf_onboarding_tags). Unknown ids refused. */
  tags: string[] | string
  note: string
  reminderStatus?: string
}): Promise<{ ok: true; followUp: OnboardingFollowUpRecord } | { ok: false; error: string }> {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, error: 'User id is required.' }

  const catalog = await ensureSeededTags().catch(() => listTags())
  const validated = validateFollowUpTagIds(
    input.tags,
    catalog.map((tag) => tag.id),
  )
  if (!validated.ok) return validated
  const tags = validated.tagIds

  const note = String(input.note ?? '').trim()
  const reminderStatus = (input.reminderStatus ?? 'open').trim() || 'open'
  const existingId = (input.id ?? '').trim()

  if (existingId) {
    await db
      .update(sfOnboardingFollowUps)
      .set({ tags, note, reminderStatus, updatedAt: new Date() })
      .where(
        and(eq(sfOnboardingFollowUps.id, existingId), eq(sfOnboardingFollowUps.userId, userId)),
      )
    const rows = await db
      .select()
      .from(sfOnboardingFollowUps)
      .where(eq(sfOnboardingFollowUps.id, existingId))
      .limit(1)
    const row = rows[0]
    if (!row) return { ok: false, error: 'Follow-up not found.' }
    return { ok: true, followUp: mapFollowUp(row) }
  }

  const id = newId('onb_follow')
  await db.insert(sfOnboardingFollowUps).values({
    id,
    userId,
    tags,
    note,
    reminderStatus,
  })
  const rows = await db
    .select()
    .from(sfOnboardingFollowUps)
    .where(eq(sfOnboardingFollowUps.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, error: 'Failed to create follow-up.' }
  return { ok: true, followUp: mapFollowUp(row) }
}

export async function listCallsForUser(userId: string): Promise<OnboardingCallRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingCalls)
    .where(eq(sfOnboardingCalls.userId, id))
    .orderBy(desc(sfOnboardingCalls.callAt))
  return rows.map(mapCall)
}

export async function createCall(input: {
  userId: string
  callAt?: Date | string | null
  done?: boolean
  dueNotice?: boolean
}): Promise<{ ok: true; call: OnboardingCallRecord } | { ok: false; error: string }> {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, error: 'User id is required.' }
  let callAt: Date | null = null
  if (input.callAt instanceof Date) callAt = input.callAt
  else if (typeof input.callAt === 'string' && input.callAt.trim()) {
    const parsed = new Date(input.callAt)
    if (!Number.isNaN(parsed.getTime())) callAt = parsed
  }
  const id = newId('onb_call')
  await db.insert(sfOnboardingCalls).values({
    id,
    userId,
    callAt,
    done: input.done === true,
    dueNotice: input.dueNotice === true,
  })
  const rows = await db
    .select()
    .from(sfOnboardingCalls)
    .where(eq(sfOnboardingCalls.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, error: 'Failed to create call.' }
  return { ok: true, call: mapCall(row) }
}

export async function updateCall(
  callId: string,
  input: { done?: boolean; dueNotice?: boolean; callAt?: Date | string | null },
): Promise<{ ok: true; call: OnboardingCallRecord } | { ok: false; error: string }> {
  const id = callId.trim()
  if (!id) return { ok: false, error: 'Missing call id.' }
  const patch: Partial<typeof sfOnboardingCalls.$inferInsert> = { updatedAt: new Date() }
  if (typeof input.done === 'boolean') patch.done = input.done
  if (typeof input.dueNotice === 'boolean') patch.dueNotice = input.dueNotice
  if (input.callAt !== undefined) {
    if (input.callAt instanceof Date) patch.callAt = input.callAt
    else if (typeof input.callAt === 'string' && input.callAt.trim()) {
      const parsed = new Date(input.callAt)
      patch.callAt = Number.isNaN(parsed.getTime()) ? null : parsed
    } else patch.callAt = null
  }
  await db.update(sfOnboardingCalls).set(patch).where(eq(sfOnboardingCalls.id, id))
  const rows = await db
    .select()
    .from(sfOnboardingCalls)
    .where(eq(sfOnboardingCalls.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, error: 'Call not found.' }
  return { ok: true, call: mapCall(row) }
}

export async function listMailLogsForUser(userId: string): Promise<OnboardingMailLogRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingMailLogs)
    .where(eq(sfOnboardingMailLogs.userId, id))
    .orderBy(desc(sfOnboardingMailLogs.sentAt))
  return rows.map(mapMailLog)
}

export async function recordMailLog(input: {
  userId: string
  channel: OnboardingMailChannel | string
  subject: string
  body: string
  toEmail: string
  senderUserId?: string
  sentAt?: Date
}): Promise<{ ok: true; log: OnboardingMailLogRecord } | { ok: false; error: string }> {
  const userId = input.userId.trim()
  const channelRaw = String(input.channel ?? '').trim()
  if (!userId) return { ok: false, error: 'User id is required.' }
  if (!isOnboardingMailChannel(channelRaw)) {
    return { ok: false, error: `Unknown mail channel “${channelRaw}”.` }
  }
  const id = newId('onb_mail')
  const sentAt = input.sentAt ?? new Date()
  await db.insert(sfOnboardingMailLogs).values({
    id,
    userId,
    channel: channelRaw,
    subject: String(input.subject ?? '').trim(),
    body: String(input.body ?? ''),
    toEmail: String(input.toEmail ?? '').trim().toLowerCase(),
    sentAt,
    senderUserId: (input.senderUserId ?? '').trim(),
  })
  const rows = await db
    .select()
    .from(sfOnboardingMailLogs)
    .where(eq(sfOnboardingMailLogs.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, error: 'Failed to record mail log.' }
  return { ok: true, log: mapMailLog(row) }
}

/** Workers with identity facts — Core name/email joined for the admin table. */
export async function listWorkers(filter?: {
  statusId?: string
}): Promise<OnboardingWorkerRow[]> {
  await ensureSeededStatuses()
  const statusFilter = (filter?.statusId ?? '').trim()

  const facts = statusFilter
    ? await db
        .select()
        .from(sfOnboardingIdentityFacts)
        .where(eq(sfOnboardingIdentityFacts.statusId, statusFilter))
    : await db.select().from(sfOnboardingIdentityFacts)

  if (!facts.length) return []

  const userIds = facts.map((f) => f.userId)
  const users = await db
    .select({ id: sfUsers.id, name: sfUsers.name, email: sfUsers.email })
    .from(sfUsers)
    .where(inArray(sfUsers.id, userIds))
  const userById = new Map(users.map((u) => [u.id, u]))

  const statuses = await db.select().from(sfOnboardingStatuses)
  const statusById = new Map(statuses.map((s) => [s.id, s]))

  const eventCounts = await db
    .select({ userId: sfOnboardingEvents.userId, n: count() })
    .from(sfOnboardingEvents)
    .where(inArray(sfOnboardingEvents.userId, userIds))
    .groupBy(sfOnboardingEvents.userId)
  const noteCounts = await db
    .select({ userId: sfOnboardingNotes.userId, n: count() })
    .from(sfOnboardingNotes)
    .where(inArray(sfOnboardingNotes.userId, userIds))
    .groupBy(sfOnboardingNotes.userId)
  const eventCountByUser = new Map(eventCounts.map((r) => [r.userId, Number(r.n) || 0]))
  const noteCountByUser = new Map(noteCounts.map((r) => [r.userId, Number(r.n) || 0]))

  const rows: OnboardingWorkerRow[] = []
  for (const fact of facts) {
    const user = userById.get(fact.userId)
    if (!user) continue
    const status = statusById.get(fact.statusId)
    rows.push({
      userId: fact.userId,
      name: user.name?.trim() || '',
      email: user.email?.trim() || '',
      statusId: fact.statusId,
      statusKey: status?.key?.trim() || '',
      statusName:
        (status?.displayLabel ?? '').trim() || status?.name?.trim() || '',
      phone: (fact.phone ?? '').trim(),
      driverCode: (fact.driverCode ?? '').trim(),
      eventCount: eventCountByUser.get(fact.userId) ?? 0,
      noteCount: noteCountByUser.get(fact.userId) ?? 0,
      updatedAt: fact.updatedAt ?? null,
    })
  }

  rows.sort((a, b) => {
    const aTime = a.updatedAt?.getTime() ?? 0
    const bTime = b.updatedAt?.getTime() ?? 0
    if (bTime !== aTime) return bTime - aTime
    return a.name.localeCompare(b.name)
  })
  return rows
}

export async function getPersonCard(userId: string): Promise<{
  worker: OnboardingWorkerRow | null
  events: OnboardingEventRecord[]
  notes: OnboardingNoteRecord[]
  followUps: OnboardingFollowUpRecord[]
  calls: OnboardingCallRecord[]
  mailLogs: OnboardingMailLogRecord[]
  documentSlots: OnboardingDocumentSlotRecord[]
}> {
  const id = userId.trim()
  const empty = {
    worker: null as OnboardingWorkerRow | null,
    events: [] as OnboardingEventRecord[],
    notes: [] as OnboardingNoteRecord[],
    followUps: [] as OnboardingFollowUpRecord[],
    calls: [] as OnboardingCallRecord[],
    mailLogs: [] as OnboardingMailLogRecord[],
    documentSlots: [] as OnboardingDocumentSlotRecord[],
  }
  if (!id) return empty

  const [facts, users, statuses, events, notes, followUps, calls, mailLogs, documentSlots] =
    await Promise.all([
      db
        .select()
        .from(sfOnboardingIdentityFacts)
        .where(eq(sfOnboardingIdentityFacts.userId, id))
        .limit(1),
      db
        .select({ id: sfUsers.id, name: sfUsers.name, email: sfUsers.email })
        .from(sfUsers)
        .where(eq(sfUsers.id, id))
        .limit(1),
      db.select().from(sfOnboardingStatuses).orderBy(asc(sfOnboardingStatuses.sortOrder)),
      listEventsForUser(id),
      listNotesForUser(id),
      listFollowUpsForUser(id),
      listCallsForUser(id),
      listMailLogsForUser(id),
      listDocumentSlotsForUser(id),
    ])

  const fact = facts[0]
  const user = users[0]
  if (!fact || !user) {
    return { ...empty, events, notes, followUps, calls, mailLogs, documentSlots }
  }
  const status = statuses.find((s) => s.id === fact.statusId)
  return {
    worker: {
      userId: id,
      name: user.name?.trim() || '',
      email: user.email?.trim() || '',
      statusId: fact.statusId,
      statusKey: status?.key?.trim() || '',
      statusName:
        (status?.displayLabel ?? '').trim() || status?.name?.trim() || '',
      phone: (fact.phone ?? '').trim(),
      driverCode: (fact.driverCode ?? '').trim(),
      eventCount: events.length,
      noteCount: notes.length,
      updatedAt: fact.updatedAt ?? null,
    },
    events,
    notes,
    followUps,
    calls,
    mailLogs,
    documentSlots,
  }
}

export type { OnboardingEventKind }
