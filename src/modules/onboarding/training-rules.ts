/**
 * Pure training / checklist / quiz / trainer-slot rules.
 * Store and unit tests call these without DB.
 */

export const TRAINING_CHECKLIST_SECTION_COUNT = 14 as const

export const TRAINING_CHECKLIST_LEVELS = ['shown', 'practiced', 'independent'] as const
export type TrainingChecklistLevel = (typeof TRAINING_CHECKLIST_LEVELS)[number]

export const TRAINING_REPORT_STATUSES = ['open', 'closed'] as const
export type TrainingReportStatus = (typeof TRAINING_REPORT_STATUSES)[number]

export const TRAINING_PASSED_VALUES = ['yes', 'no', 'partial', ''] as const
export type TrainingPassedValue = (typeof TRAINING_PASSED_VALUES)[number]

export const TRAINING_QUALIFICATION_SOURCES = ['checklist', 'quiz'] as const
export type TrainingQualificationSource = (typeof TRAINING_QUALIFICATION_SOURCES)[number]

export const TRAINER_SLOT_KINDS = ['ridealong', 'induction'] as const
export type TrainerSlotKind = (typeof TRAINER_SLOT_KINDS)[number]

export const TRAINER_SLOT_STATUSES = ['pending', 'accepted', 'cancelled'] as const
export type TrainerSlotStatus = (typeof TRAINER_SLOT_STATUSES)[number]

/** Max slot index inclusive. Index 4 is refused. */
export const TRAINER_SLOT_INDEX_MAX = 3 as const

/** Seeded 14-section practical checklist catalog (labels for UI / PDF). */
export const TRAINING_CHECKLIST_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 's01', label: 'Vehicle walkaround' },
  { key: 's02', label: 'Cabin and controls' },
  { key: 's03', label: 'Starting and moving off' },
  { key: 's04', label: 'Speed and following distance' },
  { key: 's05', label: 'Lane discipline' },
  { key: 's06', label: 'Junctions and priority' },
  { key: 's07', label: 'Roundabouts' },
  { key: 's08', label: 'Parking and stopping' },
  { key: 's09', label: 'Customer handoff' },
  { key: 's10', label: 'App and routing' },
  { key: 's11', label: 'Load and unload' },
  { key: 's12', label: 'Night and weather' },
  { key: 's13', label: 'Emergency stop' },
  { key: 's14', label: 'Depot return' },
]

export type TrainingChecklistSection = {
  key: string
  label: string
  level: TrainingChecklistLevel | ''
  note: string
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function asBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === '1' || raw === 1 || raw === 'true') return true
  if (raw === '0' || raw === 0 || raw === 'false' || raw === '') return false
  return fallback
}

function asInt(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw)
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  return Number.isFinite(n) ? n : fallback
}

export function isTrainingChecklistLevel(value: unknown): value is TrainingChecklistLevel {
  return (
    typeof value === 'string' &&
    (TRAINING_CHECKLIST_LEVELS as readonly string[]).includes(value)
  )
}

export function isTrainingReportStatus(value: unknown): value is TrainingReportStatus {
  return (
    typeof value === 'string' &&
    (TRAINING_REPORT_STATUSES as readonly string[]).includes(value)
  )
}

export function isTrainingPassedValue(value: unknown): value is TrainingPassedValue {
  if (value === '' || value === null || value === undefined) return true
  return (
    typeof value === 'string' &&
    (TRAINING_PASSED_VALUES as readonly string[]).includes(value)
  )
}

export function isTrainingQualificationSource(
  value: unknown,
): value is TrainingQualificationSource {
  return (
    typeof value === 'string' &&
    (TRAINING_QUALIFICATION_SOURCES as readonly string[]).includes(value)
  )
}

export function isTrainerSlotKind(value: unknown): value is TrainerSlotKind {
  return typeof value === 'string' && (TRAINER_SLOT_KINDS as readonly string[]).includes(value)
}

export function isTrainerSlotStatus(value: unknown): value is TrainerSlotStatus {
  return (
    typeof value === 'string' &&
    (TRAINER_SLOT_STATUSES as readonly string[]).includes(value)
  )
}

/** Empty 14-section checklist for new reports. */
export function emptyTrainingChecklist(): TrainingChecklistSection[] {
  return TRAINING_CHECKLIST_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    level: '',
    note: '',
  }))
}

/**
 * A checklist that is not exactly 14 sections is refused.
 * Each item: shown / practiced / independent (or blank) + note.
 */
export function validateTrainingChecklist(
  raw: unknown,
): { ok: true; sections: TrainingChecklistSection[] } | { ok: false; error: string } {
  let list: unknown[] = []
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) {
      return {
        ok: false,
        error: `Checklist must have exactly ${TRAINING_CHECKLIST_SECTION_COUNT} sections.`,
      }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'Checklist must be a JSON array of sections.' }
      }
      list = parsed
    } catch {
      return { ok: false, error: 'Checklist JSON is invalid.' }
    }
  } else if (Array.isArray(raw)) {
    list = raw
  } else if (raw == null) {
    return {
      ok: false,
      error: `Checklist must have exactly ${TRAINING_CHECKLIST_SECTION_COUNT} sections.`,
    }
  } else {
    return { ok: false, error: 'Checklist must be a JSON array of sections.' }
  }

  if (list.length !== TRAINING_CHECKLIST_SECTION_COUNT) {
    return {
      ok: false,
      error: `Checklist must have exactly ${TRAINING_CHECKLIST_SECTION_COUNT} sections.`,
    }
  }

  const sections: TrainingChecklistSection[] = []
  for (let i = 0; i < list.length; i++) {
    const row = list[i]
    const catalog = TRAINING_CHECKLIST_SECTIONS[i]
    if (!row || typeof row !== 'object') {
      return { ok: false, error: `Checklist section ${i + 1} is invalid.` }
    }
    const rec = row as Record<string, unknown>
    const levelRaw = asTrimmed(rec.level)
    if (levelRaw && !isTrainingChecklistLevel(levelRaw)) {
      return {
        ok: false,
        error: `Checklist section ${i + 1} level must be shown, practiced, or independent.`,
      }
    }
    const key = asTrimmed(rec.key) || catalog.key
    const label = asTrimmed(rec.label) || catalog.label
    sections.push({
      key,
      label,
      level: levelRaw as TrainingChecklistLevel | '',
      note: asTrimmed(rec.note),
    })
  }
  return { ok: true, sections }
}

/** Slot index must be 1–3 inclusive. Index 4 (and above / zero / negative) is refused. */
export function validateTrainerSlotIndex(
  raw: unknown,
): { ok: true; slotIndex: number } | { ok: false; error: string } {
  const slotIndex = asInt(raw, Number.NaN)
  if (!Number.isFinite(slotIndex) || slotIndex < 1 || slotIndex > TRAINER_SLOT_INDEX_MAX) {
    return {
      ok: false,
      error: `Trainer slot index must be between 1 and ${TRAINER_SLOT_INDEX_MAX}.`,
    }
  }
  return { ok: true, slotIndex }
}

/**
 * Checklist / quiz pass never moves the person’s main status id.
 * Pure helper so tests can assert the contract without a DB.
 */
export function statusIdAfterTrainingPass(statusId: string): string {
  return statusId
}

export type QualificationPlan = {
  /** Status id after the pass — always unchanged. */
  statusId: string
  /** Whether the store should insert a qualification row. */
  createQualification: boolean
  source: TrainingQualificationSource
  qualifiedDate: string
}

/**
 * Plan a qualification after a checklist save.
 * Pass (`passed === 'yes'`) creates a qualification once per source.
 * A second pass of the same source does not insert again.
 * Never changes status.
 */
export function planQualificationOnChecklistPass(input: {
  statusId: string
  passed: TrainingPassedValue | string
  reportDate?: string
  hasQualificationForSource: boolean
}): QualificationPlan {
  const statusId = statusIdAfterTrainingPass(asTrimmed(input.statusId))
  const passed = asTrimmed(input.passed)
  const qualifiedDate = asTrimmed(input.reportDate) || todayYmd()
  if (passed !== 'yes') {
    return {
      statusId,
      createQualification: false,
      source: 'checklist',
      qualifiedDate,
    }
  }
  return {
    statusId,
    createQualification: !input.hasQualificationForSource,
    source: 'checklist',
    qualifiedDate,
  }
}

/**
 * Plan a qualification after a quiz attempt.
 * Fail does not create a qualification. Pass creates once per source.
 * Never changes status.
 */
export function planQualificationOnQuizResult(input: {
  statusId: string
  passed: boolean
  qualifiedDate?: string
  hasQualificationForSource: boolean
}): QualificationPlan {
  const statusId = statusIdAfterTrainingPass(asTrimmed(input.statusId))
  const qualifiedDate = asTrimmed(input.qualifiedDate) || todayYmd()
  if (!input.passed) {
    return {
      statusId,
      createQualification: false,
      source: 'quiz',
      qualifiedDate,
    }
  }
  return {
    statusId,
    createQualification: !input.hasQualificationForSource,
    source: 'quiz',
    qualifiedDate,
  }
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type TrainingReportFieldInput = {
  traineeUserId?: unknown
  instructorUserId?: unknown
  reportDate?: unknown
  depotKey?: unknown
  depotLabel?: unknown
  trainingDay?: unknown
  plate?: unknown
  rounds?: unknown
  drove?: unknown
  status?: unknown
  passed?: unknown
  note?: unknown
  checklist?: unknown
}

export type TrainingReportFieldValues = {
  traineeUserId: string
  instructorUserId: string
  reportDate: string
  depotKey: string
  depotLabel: string
  trainingDay: string
  plate: string
  rounds: number
  drove: boolean
  status: TrainingReportStatus
  passed: TrainingPassedValue
  note: string
  checklist: TrainingChecklistSection[]
}

export function validateTrainingReportFields(
  input: TrainingReportFieldInput,
  defaults?: Partial<TrainingReportFieldValues>,
): { ok: true; values: TrainingReportFieldValues } | { ok: false; error: string } {
  const traineeUserId = asTrimmed(input.traineeUserId ?? defaults?.traineeUserId ?? '')
  if (!traineeUserId) return { ok: false, error: 'Trainee user id is required.' }

  const statusRaw = asTrimmed(input.status ?? defaults?.status ?? 'open') || 'open'
  if (!isTrainingReportStatus(statusRaw)) {
    return { ok: false, error: 'Report status must be open or closed.' }
  }

  const passedRaw = asTrimmed(input.passed ?? defaults?.passed ?? '')
  if (!isTrainingPassedValue(passedRaw)) {
    return { ok: false, error: 'Passed must be yes, no, partial, or empty.' }
  }

  const checklist = validateTrainingChecklist(
    input.checklist !== undefined ? input.checklist : (defaults?.checklist ?? null),
  )
  if (!checklist.ok) return checklist

  const roundsRaw = input.rounds ?? defaults?.rounds ?? 0
  const rounds = asInt(roundsRaw, 0)
  if (rounds < 0) return { ok: false, error: 'Rounds cannot be negative.' }

  return {
    ok: true,
    values: {
      traineeUserId,
      instructorUserId: asTrimmed(input.instructorUserId ?? defaults?.instructorUserId ?? ''),
      reportDate: asTrimmed(input.reportDate ?? defaults?.reportDate ?? ''),
      depotKey: asTrimmed(input.depotKey ?? defaults?.depotKey ?? ''),
      depotLabel: asTrimmed(input.depotLabel ?? defaults?.depotLabel ?? ''),
      trainingDay: asTrimmed(input.trainingDay ?? defaults?.trainingDay ?? ''),
      plate: asTrimmed(input.plate ?? defaults?.plate ?? ''),
      rounds,
      drove:
        input.drove !== undefined
          ? asBool(input.drove, false)
          : (defaults?.drove ?? false),
      status: statusRaw,
      passed: passedRaw as TrainingPassedValue,
      note: asTrimmed(input.note ?? defaults?.note ?? ''),
      checklist: checklist.sections,
    },
  }
}

export type TrainerSlotFieldInput = {
  instructorUserId?: unknown
  slotDate?: unknown
  slotIndex?: unknown
  startTime?: unknown
  locationCode?: unknown
  traineeUserId?: unknown
  kind?: unknown
  status?: unknown
}

export type TrainerSlotFieldValues = {
  instructorUserId: string
  slotDate: string
  slotIndex: number
  startTime: string
  locationCode: string
  traineeUserId: string
  kind: TrainerSlotKind
  status: TrainerSlotStatus
}

export function validateTrainerSlotFields(
  input: TrainerSlotFieldInput,
  defaults?: Partial<TrainerSlotFieldValues>,
): { ok: true; values: TrainerSlotFieldValues } | { ok: false; error: string } {
  const index = validateTrainerSlotIndex(input.slotIndex ?? defaults?.slotIndex ?? 1)
  if (!index.ok) return index

  const kindRaw = asTrimmed(input.kind ?? defaults?.kind ?? 'ridealong') || 'ridealong'
  if (!isTrainerSlotKind(kindRaw)) {
    return { ok: false, error: 'Slot kind must be ridealong or induction.' }
  }

  const statusRaw = asTrimmed(input.status ?? defaults?.status ?? 'pending') || 'pending'
  if (!isTrainerSlotStatus(statusRaw)) {
    return { ok: false, error: 'Slot status must be pending, accepted, or cancelled.' }
  }

  const instructorUserId = asTrimmed(
    input.instructorUserId ?? defaults?.instructorUserId ?? '',
  )
  if (!instructorUserId) return { ok: false, error: 'Instructor user id is required.' }

  return {
    ok: true,
    values: {
      instructorUserId,
      slotDate: asTrimmed(input.slotDate ?? defaults?.slotDate ?? ''),
      slotIndex: index.slotIndex,
      startTime: asTrimmed(input.startTime ?? defaults?.startTime ?? ''),
      locationCode: asTrimmed(input.locationCode ?? defaults?.locationCode ?? ''),
      traineeUserId: asTrimmed(input.traineeUserId ?? defaults?.traineeUserId ?? ''),
      kind: kindRaw,
      status: statusRaw,
    },
  }
}

export type QuizAttemptFieldInput = {
  userId?: unknown
  formDefinitionId?: unknown
  attemptId?: unknown
  passed?: unknown
  resultNote?: unknown
}

export type QuizAttemptFieldValues = {
  userId: string
  formDefinitionId: string
  attemptId: string
  passed: boolean
  resultNote: string
}

export function validateQuizAttemptFields(
  input: QuizAttemptFieldInput,
): { ok: true; values: QuizAttemptFieldValues } | { ok: false; error: string } {
  const userId = asTrimmed(input.userId)
  if (!userId) return { ok: false, error: 'Quiz attempt user id is required.' }
  const formDefinitionId = asTrimmed(input.formDefinitionId)
  if (!formDefinitionId) return { ok: false, error: 'Form definition id is required.' }
  const attemptId = asTrimmed(input.attemptId)
  if (!attemptId) return { ok: false, error: 'Forms attempt id is required.' }
  return {
    ok: true,
    values: {
      userId,
      formDefinitionId,
      attemptId,
      passed: asBool(input.passed, false),
      resultNote: asTrimmed(input.resultNote),
    },
  }
}

export type TrainerPersonFieldInput = {
  name?: unknown
  phone?: unknown
  linkedUserId?: unknown
}

export type TrainerPersonFieldValues = {
  name: string
  phone: string
  linkedUserId: string
}

export function validateTrainerPersonFields(
  input: TrainerPersonFieldInput,
): { ok: true; values: TrainerPersonFieldValues } | { ok: false; error: string } {
  const name = asTrimmed(input.name)
  if (!name) return { ok: false, error: 'Trainer name is required.' }
  return {
    ok: true,
    values: {
      name,
      phone: asTrimmed(input.phone),
      linkedUserId: asTrimmed(input.linkedUserId),
    },
  }
}
