/**
 * Training reports, save log, qualifications, quiz attempts, trainers, slots.
 * Checklist / quiz pass never touches identity statusId.
 */

import 'server-only'

import { and, asc, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'
import { ingestImageUpload } from '@/core/media/ingest'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  sfOnboardingIdentityFacts,
  sfOnboardingQualifications,
  sfOnboardingQuizAttempts,
  sfOnboardingTrainerSlots,
  sfOnboardingTrainers,
  sfOnboardingTrainingReports,
  sfOnboardingTrainingSaveLogs,
} from './schema'
import { getIdentityFacts } from './store'
import {
  resolveTrainingReportMediaId,
  type TrainingDocumentsRenderDoorResult,
  type TrainingDocumentsRenderInput,
} from './training-documents-bridge'
import { renderTrainingReportPdf } from './training-pdf'
import {
  emptyTrainingChecklist,
  isTrainerSlotKind,
  isTrainerSlotStatus,
  isTrainingPassedValue,
  isTrainingQualificationSource,
  isTrainingReportStatus,
  planQualificationOnChecklistPass,
  planQualificationOnQuizResult,
  validateQuizAttemptFields,
  validateTrainerPersonFields,
  validateTrainerSlotFields,
  validateTrainingChecklist,
  validateTrainingReportFields,
  type QuizAttemptFieldInput,
  type TrainerPersonFieldInput,
  type TrainerSlotFieldInput,
  type TrainerSlotKind,
  type TrainerSlotStatus,
  type TrainingChecklistSection,
  type TrainingPassedValue,
  type TrainingQualificationSource,
  type TrainingReportFieldInput,
  type TrainingReportStatus,
} from './training-rules'
import type {
  OnboardingQualificationRecord,
  OnboardingQuizAttemptRecord,
  OnboardingTrainerRecord,
  OnboardingTrainerSlotRecord,
  OnboardingTrainingReportRecord,
  OnboardingTrainingSaveLogRecord,
} from './types'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function mapChecklist(raw: unknown): TrainingChecklistSection[] {
  const parsed = validateTrainingChecklist(raw)
  if (parsed.ok) return parsed.sections
  return emptyTrainingChecklist()
}

function mapReport(
  row: typeof sfOnboardingTrainingReports.$inferSelect,
): OnboardingTrainingReportRecord {
  const status: TrainingReportStatus = isTrainingReportStatus(row.status) ? row.status : 'open'
  const passed: TrainingPassedValue = isTrainingPassedValue(row.passed)
    ? ((row.passed ?? '') as TrainingPassedValue)
    : ''
  return {
    id: row.id,
    traineeUserId: (row.traineeUserId ?? '').trim(),
    instructorUserId: (row.instructorUserId ?? '').trim(),
    reportDate: (row.reportDate ?? '').trim(),
    depotKey: (row.depotKey ?? '').trim(),
    depotLabel: (row.depotLabel ?? '').trim(),
    trainingDay: (row.trainingDay ?? '').trim(),
    plate: (row.plate ?? '').trim(),
    rounds:
      typeof row.rounds === 'number' && Number.isFinite(row.rounds) ? Math.floor(row.rounds) : 0,
    drove: row.drove === true,
    status,
    passed,
    note: (row.note ?? '').trim(),
    checklist: mapChecklist(row.checklist),
    mediaId: (row.mediaId ?? '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSaveLog(
  row: typeof sfOnboardingTrainingSaveLogs.$inferSelect,
): OnboardingTrainingSaveLogRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    actorUserId: (row.actorUserId ?? '').trim(),
    action: 'save',
    createdAt: row.createdAt,
  }
}

function mapQualification(
  row: typeof sfOnboardingQualifications.$inferSelect,
): OnboardingQualificationRecord {
  const source: TrainingQualificationSource = isTrainingQualificationSource(row.source)
    ? row.source
    : 'checklist'
  return {
    id: row.id,
    userId: row.userId,
    source,
    qualifiedDate: (row.qualifiedDate ?? '').trim(),
    createdAt: row.createdAt,
  }
}

function mapQuizAttempt(
  row: typeof sfOnboardingQuizAttempts.$inferSelect,
): OnboardingQuizAttemptRecord {
  return {
    id: row.id,
    userId: row.userId,
    formDefinitionId: (row.formDefinitionId ?? '').trim(),
    attemptId: (row.attemptId ?? '').trim(),
    passed: row.passed === true,
    resultNote: (row.resultNote ?? '').trim(),
    createdAt: row.createdAt,
  }
}

function mapTrainer(row: typeof sfOnboardingTrainers.$inferSelect): OnboardingTrainerRecord {
  return {
    id: row.id,
    name: (row.name ?? '').trim(),
    phone: (row.phone ?? '').trim(),
    linkedUserId: (row.linkedUserId ?? '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapTrainerSlot(
  row: typeof sfOnboardingTrainerSlots.$inferSelect,
): OnboardingTrainerSlotRecord {
  const kind: TrainerSlotKind = isTrainerSlotKind(row.kind) ? row.kind : 'ridealong'
  const status: TrainerSlotStatus = isTrainerSlotStatus(row.status) ? row.status : 'pending'
  return {
    id: row.id,
    instructorUserId: (row.instructorUserId ?? '').trim(),
    slotDate: (row.slotDate ?? '').trim(),
    slotIndex:
      typeof row.slotIndex === 'number' && Number.isFinite(row.slotIndex)
        ? Math.floor(row.slotIndex)
        : 1,
    startTime: (row.startTime ?? '').trim(),
    locationCode: (row.locationCode ?? '').trim(),
    traineeUserId: (row.traineeUserId ?? '').trim(),
    kind,
    status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function hasQualification(
  userId: string,
  source: TrainingQualificationSource,
): Promise<boolean> {
  const rows = await db
    .select({ id: sfOnboardingQualifications.id })
    .from(sfOnboardingQualifications)
    .where(
      and(
        eq(sfOnboardingQualifications.userId, userId),
        eq(sfOnboardingQualifications.source, source),
      ),
    )
    .limit(1)
  return Boolean(rows[0])
}

async function insertQualificationIfNeeded(input: {
  userId: string
  source: TrainingQualificationSource
  qualifiedDate: string
  createQualification: boolean
}): Promise<OnboardingQualificationRecord | null> {
  if (!input.createQualification) return null
  const id = newId('obqual')
  await db.insert(sfOnboardingQualifications).values({
    id,
    userId: input.userId,
    source: input.source,
    qualifiedDate: input.qualifiedDate,
  })
  const rows = await db
    .select()
    .from(sfOnboardingQualifications)
    .where(eq(sfOnboardingQualifications.id, id))
    .limit(1)
  return rows[0] ? mapQualification(rows[0]) : null
}

async function readStatusId(userId: string): Promise<string> {
  const facts = await getIdentityFacts(userId)
  return (facts?.statusId ?? '').trim()
}

/**
 * Advanced must not static-import advanced — load Documents through the Core
 * door slot (`loadModuleDoor('documents-api-server')` → api.server
 * `renderDocumentTemplate`). Same pattern as Marketplace → Social share.
 */
type DocumentsRenderDoor = {
  renderDocumentTemplate: (
    input: TrainingDocumentsRenderInput,
  ) => Promise<TrainingDocumentsRenderDoorResult>
}

async function loadDocumentsRenderDoor(): Promise<DocumentsRenderDoor | null> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('documents-api-server')
    if (!door || typeof door.renderDocumentTemplate !== 'function') return null
    return door as unknown as DocumentsRenderDoor
  } catch {
    return null
  }
}

async function renderViaDocumentsDoor(
  args: TrainingDocumentsRenderInput,
): Promise<TrainingDocumentsRenderDoorResult> {
  const door = await loadDocumentsRenderDoor()
  if (!door) return { ok: false, reason: 'disabled' }
  return door.renderDocumentTemplate(args)
}

/** Pack-local PDF bytes → Media. Used when Documents is off. */
async function storePackLocalReportPdf(
  report: OnboardingTrainingReportRecord,
): Promise<string> {
  const bytes = renderTrainingReportPdf(report, report.checklist)
  const file = new File(
    [new Uint8Array(bytes)],
    `training-report-${report.id}.pdf`,
    { type: 'application/pdf' },
  )
  const saved = await ingestImageUpload({
    file,
    alt: `Training report ${report.id}`,
    purpose: 'other',
    formAttachment: true,
    decodeToWebp: false,
    resize: false,
  })
  return saved.id
}

/**
 * Documents on → renderDocumentTemplate; off → pack-local PDF.
 * Authz disabled while Documents is on → leave mediaId unchanged (null).
 */
async function resolveReportPdfMediaId(
  report: OnboardingTrainingReportRecord,
  opts: { authorized: boolean; createdBy: string },
): Promise<string | null> {
  const settings = await getSiteSettings()
  const documentsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.documents)

  const resolved = await resolveTrainingReportMediaId(
    { documentsEnabled },
    {
      report,
      authorized: opts.authorized,
      createdBy: opts.createdBy,
      title: 'Training report',
    },
    {
      renderViaDocuments: renderViaDocumentsDoor,
      renderPackLocal: async () => storePackLocalReportPdf(report),
    },
  )

  if (resolved.action === 'leave_unchanged') return null
  return resolved.mediaId
}

export async function listTrainingReports(filter?: {
  traineeUserId?: string
}): Promise<OnboardingTrainingReportRecord[]> {
  const trainee = (filter?.traineeUserId ?? '').trim()
  const rows = trainee
    ? await db
        .select()
        .from(sfOnboardingTrainingReports)
        .where(eq(sfOnboardingTrainingReports.traineeUserId, trainee))
        .orderBy(desc(sfOnboardingTrainingReports.reportDate), desc(sfOnboardingTrainingReports.createdAt))
    : await db
        .select()
        .from(sfOnboardingTrainingReports)
        .orderBy(desc(sfOnboardingTrainingReports.reportDate), desc(sfOnboardingTrainingReports.createdAt))
  return rows.map(mapReport)
}

export async function getTrainingReportById(
  reportId: string,
): Promise<OnboardingTrainingReportRecord | null> {
  const id = reportId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingTrainingReports)
    .where(eq(sfOnboardingTrainingReports.id, id))
    .limit(1)
  return rows[0] ? mapReport(rows[0]) : null
}

export async function listQualifications(filter?: {
  userId?: string
}): Promise<OnboardingQualificationRecord[]> {
  const userId = (filter?.userId ?? '').trim()
  const rows = userId
    ? await db
        .select()
        .from(sfOnboardingQualifications)
        .where(eq(sfOnboardingQualifications.userId, userId))
        .orderBy(desc(sfOnboardingQualifications.qualifiedDate), desc(sfOnboardingQualifications.createdAt))
    : await db
        .select()
        .from(sfOnboardingQualifications)
        .orderBy(desc(sfOnboardingQualifications.qualifiedDate), desc(sfOnboardingQualifications.createdAt))
  return rows.map(mapQualification)
}

export async function listTrainerSlots(filter?: {
  instructorUserId?: string
  slotDate?: string
}): Promise<OnboardingTrainerSlotRecord[]> {
  const instructor = (filter?.instructorUserId ?? '').trim()
  const slotDate = (filter?.slotDate ?? '').trim()
  let rows
  if (instructor && slotDate) {
    rows = await db
      .select()
      .from(sfOnboardingTrainerSlots)
      .where(
        and(
          eq(sfOnboardingTrainerSlots.instructorUserId, instructor),
          eq(sfOnboardingTrainerSlots.slotDate, slotDate),
        ),
      )
      .orderBy(asc(sfOnboardingTrainerSlots.slotIndex))
  } else if (instructor) {
    rows = await db
      .select()
      .from(sfOnboardingTrainerSlots)
      .where(eq(sfOnboardingTrainerSlots.instructorUserId, instructor))
      .orderBy(desc(sfOnboardingTrainerSlots.slotDate), asc(sfOnboardingTrainerSlots.slotIndex))
  } else if (slotDate) {
    rows = await db
      .select()
      .from(sfOnboardingTrainerSlots)
      .where(eq(sfOnboardingTrainerSlots.slotDate, slotDate))
      .orderBy(asc(sfOnboardingTrainerSlots.slotIndex))
  } else {
    rows = await db
      .select()
      .from(sfOnboardingTrainerSlots)
      .orderBy(desc(sfOnboardingTrainerSlots.slotDate), asc(sfOnboardingTrainerSlots.slotIndex))
  }
  return rows.map(mapTrainerSlot)
}

export async function listTrainers(): Promise<OnboardingTrainerRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingTrainers)
    .orderBy(asc(sfOnboardingTrainers.name))
  return rows.map(mapTrainer)
}

export async function listQuizAttemptsForUser(
  userId: string,
): Promise<OnboardingQuizAttemptRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingQuizAttempts)
    .where(eq(sfOnboardingQuizAttempts.userId, id))
    .orderBy(desc(sfOnboardingQuizAttempts.createdAt))
  return rows.map(mapQuizAttempt)
}

export async function listSaveLogsForReport(
  reportId: string,
): Promise<OnboardingTrainingSaveLogRecord[]> {
  const id = reportId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingTrainingSaveLogs)
    .where(eq(sfOnboardingTrainingSaveLogs.reportId, id))
    .orderBy(desc(sfOnboardingTrainingSaveLogs.createdAt))
  return rows.map(mapSaveLog)
}

/**
 * Latest training result for the person card / door.
 * Prefers the newest report; falls back to newest quiz attempt.
 */
export async function getLatestTrainingResult(userId: string): Promise<{
  report: OnboardingTrainingReportRecord | null
  qualification: OnboardingQualificationRecord | null
  quizAttempt: OnboardingQuizAttemptRecord | null
  statusId: string
} | null> {
  const id = userId.trim()
  if (!id) return null
  const statusId = await readStatusId(id)
  const reports = await listTrainingReports({ traineeUserId: id })
  const quals = await listQualifications({ userId: id })
  const quizzes = await listQuizAttemptsForUser(id)
  return {
    report: reports[0] ?? null,
    qualification: quals[0] ?? null,
    quizAttempt: quizzes[0] ?? null,
    statusId,
  }
}

/**
 * Save (create or update) a training report.
 * On checklist pass → dated qualification (idempotent by source). Status unchanged.
 * Writes a save log. Renders PDF (Documents door when on, else pack-local) and stores mediaId.
 * `documentsAuthorized` defaults true for staff saves; false → Documents door disabled,
 * report mediaId left unchanged, no pack-local PDF.
 */
export async function saveTrainingReport(
  input: TrainingReportFieldInput & {
    id?: unknown
    actorUserId?: unknown
    documentsAuthorized?: unknown
  },
): Promise<
  | {
      ok: true
      report: OnboardingTrainingReportRecord
      qualificationCreated: boolean
      statusId: string
    }
  | { ok: false; error: string }
> {
  const existingId = String(input.id ?? '').trim()
  let defaults: Parameters<typeof validateTrainingReportFields>[1]
  if (existingId) {
    const existing = await getTrainingReportById(existingId)
    if (!existing) return { ok: false, error: 'Training report not found.' }
    defaults = {
      traineeUserId: existing.traineeUserId,
      instructorUserId: existing.instructorUserId,
      reportDate: existing.reportDate,
      depotKey: existing.depotKey,
      depotLabel: existing.depotLabel,
      trainingDay: existing.trainingDay,
      plate: existing.plate,
      rounds: existing.rounds,
      drove: existing.drove,
      status: existing.status,
      passed: existing.passed,
      note: existing.note,
      checklist: existing.checklist,
    }
  }

  const validated = validateTrainingReportFields(input, defaults)
  if (!validated.ok) return validated
  const values = validated.values

  const statusIdBefore = await readStatusId(values.traineeUserId)
  const alreadyQualified = await hasQualification(values.traineeUserId, 'checklist')
  const plan = planQualificationOnChecklistPass({
    statusId: statusIdBefore,
    passed: values.passed,
    reportDate: values.reportDate,
    hasQualificationForSource: alreadyQualified,
  })

  const id = existingId || newId('obtr')
  const actorUserId = String(input.actorUserId ?? '').trim()

  if (existingId) {
    await db
      .update(sfOnboardingTrainingReports)
      .set({
        traineeUserId: values.traineeUserId,
        instructorUserId: values.instructorUserId,
        reportDate: values.reportDate,
        depotKey: values.depotKey,
        depotLabel: values.depotLabel,
        trainingDay: values.trainingDay,
        plate: values.plate,
        rounds: values.rounds,
        drove: values.drove,
        status: values.status,
        passed: values.passed,
        note: values.note,
        checklist: values.checklist,
      })
      .where(eq(sfOnboardingTrainingReports.id, id))
  } else {
    await db.insert(sfOnboardingTrainingReports).values({
      id,
      traineeUserId: values.traineeUserId,
      instructorUserId: values.instructorUserId,
      reportDate: values.reportDate,
      depotKey: values.depotKey,
      depotLabel: values.depotLabel,
      trainingDay: values.trainingDay,
      plate: values.plate,
      rounds: values.rounds,
      drove: values.drove,
      status: values.status,
      passed: values.passed,
      note: values.note,
      checklist: values.checklist,
      mediaId: '',
    })
  }

  await db.insert(sfOnboardingTrainingSaveLogs).values({
    id: newId('obtrlog'),
    reportId: id,
    actorUserId,
    action: 'save',
  })

  const qualification = await insertQualificationIfNeeded({
    userId: values.traineeUserId,
    source: plan.source,
    qualifiedDate: plan.qualifiedDate,
    createQualification: plan.createQualification,
  })

  // Never write identity status — assert plan status matches before.
  if (plan.statusId !== statusIdBefore) {
    return { ok: false, error: 'Training pass must not change status.' }
  }
  const statusAfter = await readStatusId(values.traineeUserId)
  if (statusAfter !== statusIdBefore) {
    // Defensive: restore if somehow mutated (should never happen).
    await db
      .update(sfOnboardingIdentityFacts)
      .set({ statusId: statusIdBefore })
      .where(eq(sfOnboardingIdentityFacts.userId, values.traineeUserId))
  }

  let report = await getTrainingReportById(id)
  if (!report) return { ok: false, error: 'Training report save failed.' }

  const documentsAuthorized =
    input.documentsAuthorized === undefined
      ? true
      : input.documentsAuthorized === true || input.documentsAuthorized === '1'

  try {
    const mediaId = await resolveReportPdfMediaId(report, {
      authorized: documentsAuthorized,
      createdBy: actorUserId,
    })
    if (mediaId != null) {
      await db
        .update(sfOnboardingTrainingReports)
        .set({ mediaId })
        .where(eq(sfOnboardingTrainingReports.id, id))
      report = (await getTrainingReportById(id)) ?? { ...report, mediaId }
    }
  } catch (err) {
    console.error('[onboarding] training PDF media store failed', err)
  }

  return {
    ok: true,
    report,
    qualificationCreated: Boolean(qualification),
    statusId: statusIdBefore,
  }
}

/**
 * Record a Forms quiz attempt result. Questions stay in Forms.
 * Pass → dated qualification once. Fail → no qualification. Status unchanged.
 */
export async function recordQuizAttempt(
  input: QuizAttemptFieldInput,
): Promise<
  | {
      ok: true
      attempt: OnboardingQuizAttemptRecord
      qualificationCreated: boolean
      statusId: string
    }
  | { ok: false; error: string }
> {
  const validated = validateQuizAttemptFields(input)
  if (!validated.ok) return validated
  const values = validated.values

  const statusIdBefore = await readStatusId(values.userId)
  const alreadyQualified = await hasQualification(values.userId, 'quiz')
  const plan = planQualificationOnQuizResult({
    statusId: statusIdBefore,
    passed: values.passed,
    hasQualificationForSource: alreadyQualified,
  })

  const id = newId('obquiz')
  await db.insert(sfOnboardingQuizAttempts).values({
    id,
    userId: values.userId,
    formDefinitionId: values.formDefinitionId,
    attemptId: values.attemptId,
    passed: values.passed,
    resultNote: values.resultNote,
  })

  const qualification = await insertQualificationIfNeeded({
    userId: values.userId,
    source: plan.source,
    qualifiedDate: plan.qualifiedDate,
    createQualification: plan.createQualification,
  })

  const statusAfter = await readStatusId(values.userId)
  if (statusAfter !== statusIdBefore) {
    await db
      .update(sfOnboardingIdentityFacts)
      .set({ statusId: statusIdBefore })
      .where(eq(sfOnboardingIdentityFacts.userId, values.userId))
  }

  const rows = await db
    .select()
    .from(sfOnboardingQuizAttempts)
    .where(eq(sfOnboardingQuizAttempts.id, id))
    .limit(1)
  const attempt = rows[0] ? mapQuizAttempt(rows[0]) : null
  if (!attempt) return { ok: false, error: 'Quiz attempt save failed.' }

  return {
    ok: true,
    attempt,
    qualificationCreated: Boolean(qualification),
    statusId: statusIdBefore,
  }
}

export async function upsertTrainer(
  input: TrainerPersonFieldInput & { id?: unknown },
): Promise<
  { ok: true; trainer: OnboardingTrainerRecord } | { ok: false; error: string }
> {
  const validated = validateTrainerPersonFields(input)
  if (!validated.ok) return validated
  const values = validated.values
  const existingId = String(input.id ?? '').trim()
  const id = existingId || newId('obtrainer')

  if (existingId) {
    await db
      .update(sfOnboardingTrainers)
      .set({
        name: values.name,
        phone: values.phone,
        linkedUserId: values.linkedUserId,
      })
      .where(eq(sfOnboardingTrainers.id, id))
  } else {
    await db.insert(sfOnboardingTrainers).values({
      id,
      name: values.name,
      phone: values.phone,
      linkedUserId: values.linkedUserId,
    })
  }

  const rows = await db
    .select()
    .from(sfOnboardingTrainers)
    .where(eq(sfOnboardingTrainers.id, id))
    .limit(1)
  const trainer = rows[0] ? mapTrainer(rows[0]) : null
  if (!trainer) return { ok: false, error: 'Trainer save failed.' }
  return { ok: true, trainer }
}

export async function createTrainerSlot(
  input: TrainerSlotFieldInput,
): Promise<
  { ok: true; slot: OnboardingTrainerSlotRecord } | { ok: false; error: string }
> {
  const validated = validateTrainerSlotFields(input)
  if (!validated.ok) return validated
  const values = validated.values
  const id = newId('obtslot')

  try {
    await db.insert(sfOnboardingTrainerSlots).values({
      id,
      instructorUserId: values.instructorUserId,
      slotDate: values.slotDate,
      slotIndex: values.slotIndex,
      startTime: values.startTime,
      locationCode: values.locationCode,
      traineeUserId: values.traineeUserId,
      kind: values.kind,
      status: values.status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: 'That instructor already has this slot index on that date.' }
    }
    throw err
  }

  const rows = await db
    .select()
    .from(sfOnboardingTrainerSlots)
    .where(eq(sfOnboardingTrainerSlots.id, id))
    .limit(1)
  const slot = rows[0] ? mapTrainerSlot(rows[0]) : null
  if (!slot) return { ok: false, error: 'Trainer slot save failed.' }
  return { ok: true, slot }
}

export async function updateTrainerSlot(
  slotId: string,
  input: TrainerSlotFieldInput,
): Promise<
  { ok: true; slot: OnboardingTrainerSlotRecord } | { ok: false; error: string }
> {
  const id = slotId.trim()
  if (!id) return { ok: false, error: 'Missing trainer slot id.' }
  const existingRows = await db
    .select()
    .from(sfOnboardingTrainerSlots)
    .where(eq(sfOnboardingTrainerSlots.id, id))
    .limit(1)
  const existing = existingRows[0] ? mapTrainerSlot(existingRows[0]) : null
  if (!existing) return { ok: false, error: 'Trainer slot not found.' }

  const validated = validateTrainerSlotFields(input, {
    instructorUserId: existing.instructorUserId,
    slotDate: existing.slotDate,
    slotIndex: existing.slotIndex,
    startTime: existing.startTime,
    locationCode: existing.locationCode,
    traineeUserId: existing.traineeUserId,
    kind: existing.kind,
    status: existing.status,
  })
  if (!validated.ok) return validated
  const values = validated.values

  try {
    await db
      .update(sfOnboardingTrainerSlots)
      .set({
        instructorUserId: values.instructorUserId,
        slotDate: values.slotDate,
        slotIndex: values.slotIndex,
        startTime: values.startTime,
        locationCode: values.locationCode,
        traineeUserId: values.traineeUserId,
        kind: values.kind,
        status: values.status,
      })
      .where(eq(sfOnboardingTrainerSlots.id, id))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: 'That instructor already has this slot index on that date.' }
    }
    throw err
  }

  const rows = await db
    .select()
    .from(sfOnboardingTrainerSlots)
    .where(eq(sfOnboardingTrainerSlots.id, id))
    .limit(1)
  const slot = rows[0] ? mapTrainerSlot(rows[0]) : null
  if (!slot) return { ok: false, error: 'Trainer slot save failed.' }
  return { ok: true, slot }
}
