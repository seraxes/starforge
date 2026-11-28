/**
 * Document template render field validation (pure).
 * Caller passes merge values — this pack does not read Forms / Onboarding / Fleet.
 */

import {
  isDocumentSubjectKind,
  type DocumentSubjectKind,
} from './links-rules'

export type DocumentTemplateRecord = {
  id: string
  title: string
  subjectKind: DocumentSubjectKind
  renderSource: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type RenderDocumentTemplateInput = {
  subjectKind: string
  subjectId: string
  templateId: string
  title: string
  createdBy: string
  values: Record<string, string>
}

export type ParsedRenderDocumentTemplate = {
  subjectKind: DocumentSubjectKind
  subjectId: string
  templateId: string
  title: string
  createdBy: string
  values: Record<string, string>
}

/**
 * Validate render fields. Unknown subject kinds are refused.
 */
export function validateRenderDocumentTemplate(
  input: RenderDocumentTemplateInput,
):
  | { ok: true; values: ParsedRenderDocumentTemplate }
  | { ok: false; error: string } {
  const subjectKind = (input.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(subjectKind)) {
    return { ok: false, error: 'Unknown document subject kind.' }
  }

  const subjectId = (input.subjectId ?? '').trim()
  if (!subjectId) {
    return { ok: false, error: 'Subject id is required.' }
  }

  const templateId = (input.templateId ?? '').trim()
  if (!templateId) {
    return { ok: false, error: 'Template id is required.' }
  }

  const title = (input.title ?? '').trim()
  const createdBy = (input.createdBy ?? '').trim()
  const values: Record<string, string> = {}
  if (input.values && typeof input.values === 'object') {
    for (const [key, raw] of Object.entries(input.values)) {
      const k = (key ?? '').trim()
      if (!k) continue
      values[k] = typeof raw === 'string' ? raw : String(raw ?? '')
    }
  }

  return {
    ok: true,
    values: {
      subjectKind,
      subjectId,
      templateId,
      title,
      createdBy,
      values,
    },
  }
}

/**
 * Template must exist, be enabled, and match the render subject kind.
 */
export function validateTemplateForRender(
  template: DocumentTemplateRecord | null | undefined,
  subjectKind: DocumentSubjectKind,
): { ok: true; template: DocumentTemplateRecord } | { ok: false; error: string } {
  if (!template) {
    return { ok: false, error: 'Document template not found.' }
  }
  if (!template.enabled) {
    return { ok: false, error: 'Document template is disabled.' }
  }
  if (template.subjectKind !== subjectKind) {
    return { ok: false, error: 'Document template subject kind mismatch.' }
  }
  return { ok: true, template }
}
