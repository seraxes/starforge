/**
 * Onboarding slice 6 — training PDF ↔ product:documents.
 *
 * Documents on → renderDocumentTemplate via documents-api-server door
 * (subject onboarding, template training-report).
 * Documents off → pack-local PDF + Media ingest.
 * Door disabled (authz) while Documents is on → leave report mediaId unchanged;
 * do not write a pack-local PDF for that attempt.
 */

export const ONBOARDING_TRAINING_REPORT_TEMPLATE_ID = 'training-report' as const
export const ONBOARDING_TRAINING_REPORT_SUBJECT_KIND = 'onboarding' as const

export type TrainingReportDocumentValuesInput = {
  id: string
  traineeUserId: string
  instructorUserId: string
  reportDate: string
  depotKey: string
  depotLabel: string
  trainingDay: string
  plate: string
  rounds: number
  drove: boolean
  status: string
  passed: string
  note: string
}

/** Merge values passed to Documents render — report fields Onboarding already has. */
export function buildTrainingReportDocumentValues(
  report: TrainingReportDocumentValuesInput,
): Record<string, string> {
  return {
    id: report.id,
    traineeUserId: report.traineeUserId,
    instructorUserId: report.instructorUserId,
    reportDate: report.reportDate,
    depotKey: report.depotKey,
    depotLabel: report.depotLabel,
    trainingDay: report.trainingDay,
    plate: report.plate,
    rounds: String(report.rounds),
    drove: report.drove ? 'yes' : 'no',
    status: report.status,
    passed: report.passed,
    note: report.note,
  }
}

export type TrainingDocumentsRenderInput = {
  subjectKind: typeof ONBOARDING_TRAINING_REPORT_SUBJECT_KIND
  subjectId: string
  templateId: typeof ONBOARDING_TRAINING_REPORT_TEMPLATE_ID
  title: string
  createdBy: string
  values: Record<string, string>
  authorized: boolean
}

/** Shape of `@/modules/documents/api.server` renderDocumentTemplate door result. */
export type TrainingDocumentsRenderDoorResult =
  | { ok: true; value: { ok: true; mediaId: string } | { ok: false; error: string } }
  | { ok: false; reason: 'disabled' }

export type ResolveTrainingReportMediaResult =
  | { action: 'store'; mediaId: string; source: 'documents' | 'pack_local' }
  | { action: 'leave_unchanged' }

/**
 * Pick Documents render vs pack-local PDF vs leave mediaId alone.
 * Caller supplies the Documents door and the pack-local Media ingest.
 */
export async function resolveTrainingReportMediaId(
  gates: { documentsEnabled: boolean },
  input: {
    report: TrainingReportDocumentValuesInput
    authorized: boolean
    createdBy: string
    title?: string
  },
  deps: {
    renderViaDocuments: (
      args: TrainingDocumentsRenderInput,
    ) => Promise<TrainingDocumentsRenderDoorResult>
    renderPackLocal: (report: TrainingReportDocumentValuesInput) => Promise<string>
  },
): Promise<ResolveTrainingReportMediaResult> {
  if (!gates.documentsEnabled) {
    const mediaId = await deps.renderPackLocal(input.report)
    return { action: 'store', mediaId, source: 'pack_local' }
  }

  const title = (input.title ?? '').trim() || 'Training report'
  const door = await deps.renderViaDocuments({
    subjectKind: ONBOARDING_TRAINING_REPORT_SUBJECT_KIND,
    subjectId: input.report.id,
    templateId: ONBOARDING_TRAINING_REPORT_TEMPLATE_ID,
    title,
    createdBy: input.createdBy,
    values: buildTrainingReportDocumentValues(input.report),
    authorized: input.authorized,
  })

  // Pack is on: disabled means authz failed — do not fall back to pack-local.
  if (!door.ok) {
    return { action: 'leave_unchanged' }
  }
  if (!door.value.ok) {
    return { action: 'leave_unchanged' }
  }

  const mediaId = (door.value.mediaId ?? '').trim()
  if (!mediaId) {
    return { action: 'leave_unchanged' }
  }
  return { action: 'store', mediaId, source: 'documents' }
}
