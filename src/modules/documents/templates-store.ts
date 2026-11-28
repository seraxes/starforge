/**
 * Document template persistence for staff admin.
 * PDF bytes are never stored here — Media keeps files; links hold mediaId.
 */

import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { isDocumentSubjectKind } from './links-rules'
import type { DocumentTemplateRecord } from './render-rules'
import { sfDocumentsTemplates } from './schema'
import {
  validateUpsertDocumentTemplate,
  type UpsertDocumentTemplateInput,
} from './templates-rules'

function mapTemplate(
  row: typeof sfDocumentsTemplates.$inferSelect,
): DocumentTemplateRecord | null {
  const kind = (row.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(kind)) return null
  return {
    id: row.id,
    title: (row.title ?? '').trim(),
    subjectKind: kind,
    renderSource: (row.renderSource ?? '').trim(),
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** List all staff templates (enabled and disabled), title order. */
export async function listDocumentTemplates(): Promise<DocumentTemplateRecord[]> {
  const rows = await db
    .select()
    .from(sfDocumentsTemplates)
    .orderBy(asc(sfDocumentsTemplates.title), asc(sfDocumentsTemplates.id))
  const out: DocumentTemplateRecord[] = []
  for (const row of rows) {
    const mapped = mapTemplate(row)
    if (mapped) out.push(mapped)
  }
  return out
}

export async function getDocumentTemplate(
  templateId: string,
): Promise<DocumentTemplateRecord | null> {
  const id = templateId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfDocumentsTemplates)
    .where(eq(sfDocumentsTemplates.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapTemplate(row) : null
}

export type UpsertDocumentTemplateResult =
  | { ok: true; template: DocumentTemplateRecord }
  | { ok: false; error: string }

/** Insert a new template. Refuses when the id already exists. */
export async function createDocumentTemplate(
  input: UpsertDocumentTemplateInput,
): Promise<UpsertDocumentTemplateResult> {
  const parsed = validateUpsertDocumentTemplate(input)
  if (!parsed.ok) return parsed

  const existing = await getDocumentTemplate(parsed.values.id)
  if (existing) {
    return { ok: false, error: 'A template with that id already exists.' }
  }

  const now = new Date()
  await db.insert(sfDocumentsTemplates).values({
    id: parsed.values.id,
    title: parsed.values.title,
    subjectKind: parsed.values.subjectKind,
    renderSource: parsed.values.renderSource,
    enabled: parsed.values.enabled,
    createdAt: now,
    updatedAt: now,
  })

  const template = await getDocumentTemplate(parsed.values.id)
  if (!template) {
    return { ok: false, error: 'Template create failed.' }
  }
  return { ok: true, template }
}

/** Update an existing template. Id is stable. */
export async function updateDocumentTemplate(
  input: UpsertDocumentTemplateInput,
): Promise<UpsertDocumentTemplateResult> {
  const parsed = validateUpsertDocumentTemplate(input)
  if (!parsed.ok) return parsed

  const existing = await getDocumentTemplate(parsed.values.id)
  if (!existing) {
    return { ok: false, error: 'Document template not found.' }
  }

  await db
    .update(sfDocumentsTemplates)
    .set({
      title: parsed.values.title,
      subjectKind: parsed.values.subjectKind,
      renderSource: parsed.values.renderSource,
      enabled: parsed.values.enabled,
      updatedAt: new Date(),
    })
    .where(eq(sfDocumentsTemplates.id, parsed.values.id))

  const template = await getDocumentTemplate(parsed.values.id)
  if (!template) {
    return { ok: false, error: 'Template update failed.' }
  }
  return { ok: true, template }
}
