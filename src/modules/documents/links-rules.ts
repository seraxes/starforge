/**
 * Document subject kinds + bind field validation (pure).
 * Allowed subjects: user, onboarding, fleet_vehicle. Unknown kinds are refused.
 */

export const DOCUMENT_SUBJECT_KINDS = ['user', 'onboarding', 'fleet_vehicle'] as const

export type DocumentSubjectKind = (typeof DOCUMENT_SUBJECT_KINDS)[number]

export type BindDocumentMediaInput = {
  subjectKind: string
  subjectId: string
  templateId?: string
  mediaId: string
  title: string
  createdBy: string
}

export type ParsedBindDocumentMedia = {
  subjectKind: DocumentSubjectKind
  subjectId: string
  templateId: string
  mediaId: string
  title: string
  createdBy: string
}

export function isDocumentSubjectKind(value: string): value is DocumentSubjectKind {
  return (DOCUMENT_SUBJECT_KINDS as readonly string[]).includes(value)
}

/**
 * Validate bind fields. Unknown subject kinds (e.g. `page`) are refused.
 */
export function validateBindDocumentMedia(
  input: BindDocumentMediaInput,
):
  | { ok: true; values: ParsedBindDocumentMedia }
  | { ok: false; error: string } {
  const subjectKind = (input.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(subjectKind)) {
    return { ok: false, error: 'Unknown document subject kind.' }
  }

  const subjectId = (input.subjectId ?? '').trim()
  if (!subjectId) {
    return { ok: false, error: 'Subject id is required.' }
  }

  const mediaId = (input.mediaId ?? '').trim()
  if (!mediaId) {
    return { ok: false, error: 'Media id is required.' }
  }

  const templateId = (input.templateId ?? '').trim()
  const title = (input.title ?? '').trim()
  const createdBy = (input.createdBy ?? '').trim()

  return {
    ok: true,
    values: {
      subjectKind,
      subjectId,
      templateId,
      mediaId,
      title,
      createdBy,
    },
  }
}
