/**
 * Document template create / update field validation (pure).
 */

import {
  isDocumentSubjectKind,
  type DocumentSubjectKind,
} from './links-rules'
import type { DocumentTemplateRecord } from './render-rules'

export type UpsertDocumentTemplateInput = {
  id: string
  title: string
  subjectKind: string
  renderSource: string
  enabled: boolean
}

export type ParsedUpsertDocumentTemplate = {
  id: string
  title: string
  subjectKind: DocumentSubjectKind
  renderSource: string
  enabled: boolean
}

/**
 * Validate staff template fields. Unknown subject kinds are refused.
 * Empty title or id is refused.
 */
export function validateUpsertDocumentTemplate(
  input: UpsertDocumentTemplateInput,
):
  | { ok: true; values: ParsedUpsertDocumentTemplate }
  | { ok: false; error: string } {
  const id = (input.id ?? '').trim()
  if (!id) {
    return { ok: false, error: 'Template id is required.' }
  }

  const title = (input.title ?? '').trim()
  if (!title) {
    return { ok: false, error: 'Template title is required.' }
  }

  const subjectKind = (input.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(subjectKind)) {
    return { ok: false, error: 'Unknown document subject kind.' }
  }

  const renderSource = (input.renderSource ?? '').trim()
  if (!renderSource) {
    return { ok: false, error: 'Render source is required.' }
  }

  return {
    ok: true,
    values: {
      id,
      title,
      subjectKind,
      renderSource,
      enabled: Boolean(input.enabled),
    },
  }
}

export type { DocumentTemplateRecord }
