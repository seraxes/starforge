/**
 * Document template render persistence.
 * Looks up sf_documents_templates, writes PDF bytes through Media, upserts
 * sf_documents_links by subject kind + subject id + template id.
 * Does not read Onboarding, Fleet, or Forms tables.
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
  ingestImageUpload,
  removeMediaAsset,
  replaceMediaFile,
} from '@/core/media/ingest'
import { db } from '@/core/db'

import { decideBindDocumentMedia, type DocumentLinkRecord } from './links'
import { isDocumentSubjectKind } from './links-rules'
import { renderDocumentValuesPdf } from './render-pdf'
import {
  validateRenderDocumentTemplate,
  validateTemplateForRender,
  type DocumentTemplateRecord,
  type RenderDocumentTemplateInput,
} from './render-rules'
import type { RenderDocumentTemplateResult } from './render'
import { documentLinkAllowsRender } from './signing-rules'
import { sfDocumentsLinks, sfDocumentsTemplates } from './schema'

function newLinkId(): string {
  return `dlink_${randomUUID().replace(/-/g, '')}`
}

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

async function loadTemplate(templateId: string): Promise<DocumentTemplateRecord | null> {
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

function mapLinkRow(
  row: typeof sfDocumentsLinks.$inferSelect,
): DocumentLinkRecord | null {
  const kind = (row.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(kind)) return null
  return {
    id: row.id,
    subjectKind: kind,
    subjectId: (row.subjectId ?? '').trim(),
    templateId: (row.templateId ?? '').trim(),
    mediaId: (row.mediaId ?? '').trim(),
    title: (row.title ?? '').trim(),
    status: (row.status ?? '').trim(),
    providerId: (row.providerId ?? '').trim(),
    envelopeId: (row.envelopeId ?? '').trim(),
    generation: Number(row.generation ?? 1) || 1,
    createdAt: row.createdAt,
    createdBy: (row.createdBy ?? '').trim(),
  }
}

/** Highest generation for subject + template (current contract row). */
async function findLinkByTemplate(input: {
  subjectKind: string
  subjectId: string
  templateId: string
}): Promise<DocumentLinkRecord | null> {
  const rows = await db
    .select()
    .from(sfDocumentsLinks)
    .where(
      and(
        eq(sfDocumentsLinks.subjectKind, input.subjectKind),
        eq(sfDocumentsLinks.subjectId, input.subjectId),
        eq(sfDocumentsLinks.templateId, input.templateId),
      ),
    )
  const mapped = rows
    .map(mapLinkRow)
    .filter((row): row is DocumentLinkRecord => row !== null)
    .sort((a, b) => b.generation - a.generation)
  return mapped[0] ?? null
}

async function writePdfToMedia(input: {
  bytes: Buffer
  title: string
  filename: string
  previousMediaId?: string
}): Promise<string> {
  const file = new File([new Uint8Array(input.bytes)], input.filename, {
    type: 'application/pdf',
  })
  const previous = (input.previousMediaId ?? '').trim()
  // Prefer in-place replace so a second render does not insert a second Media file.
  if (previous) {
    try {
      const replaced = await replaceMediaFile({
        id: previous,
        file,
        decodeToWebp: false,
        resize: false,
      })
      return replaced.id
    } catch {
      // Fall through to a fresh ingest when the prior Media row is gone.
    }
  }
  const saved = await ingestImageUpload({
    file,
    alt: input.title,
    purpose: 'other',
    formAttachment: true,
    decodeToWebp: false,
    resize: false,
  })
  if (previous && previous !== saved.id) {
    try {
      await removeMediaAsset(previous)
    } catch {
      // Primary write succeeded; leftover prior blob is not a failed render.
    }
  }
  return saved.id
}

/**
 * Render a template into Media and upsert the subject link.
 * Unique key: subject kind + subject id + template id.
 * A second render updates that link’s mediaId and does not insert a second file.
 */
export async function renderDocumentTemplateInStore(
  input: RenderDocumentTemplateInput,
): Promise<RenderDocumentTemplateResult> {
  const parsed = validateRenderDocumentTemplate(input)
  if (!parsed.ok) return parsed

  const template = await loadTemplate(parsed.values.templateId)
  const checked = validateTemplateForRender(template, parsed.values.subjectKind)
  if (!checked.ok) return checked

  const title =
    parsed.values.title || checked.template.title || checked.template.id
  const bytes = renderDocumentValuesPdf(title, parsed.values.values)
  const filename = `${parsed.values.templateId}-${parsed.values.subjectId}.pdf`

  const current = await findLinkByTemplate({
    subjectKind: parsed.values.subjectKind,
    subjectId: parsed.values.subjectId,
    templateId: parsed.values.templateId,
  })

  // Signed generation is frozen — refuse and do not write.
  if (current && !documentLinkAllowsRender(current.status)) {
    return {
      ok: false,
      error: 'Document link is signed and cannot be re-rendered.',
    }
  }

  const mediaId = await writePdfToMedia({
    bytes,
    title,
    filename,
    previousMediaId: current?.mediaId || undefined,
  })

  const decision = decideBindDocumentMedia(
    current,
    {
      subjectKind: parsed.values.subjectKind,
      subjectId: parsed.values.subjectId,
      templateId: parsed.values.templateId,
      mediaId,
      title,
      createdBy: parsed.values.createdBy,
    },
    { newId: newLinkId },
  )

  if (decision.write === 'update' && current) {
    await db
      .update(sfDocumentsLinks)
      .set({
        mediaId: decision.link.mediaId,
        title: decision.link.title,
        createdBy: decision.link.createdBy,
      })
      .where(eq(sfDocumentsLinks.id, current.id))
  } else {
    await db.insert(sfDocumentsLinks).values({
      id: decision.link.id,
      subjectKind: decision.link.subjectKind,
      subjectId: decision.link.subjectId,
      templateId: decision.link.templateId,
      mediaId: decision.link.mediaId,
      title: decision.link.title,
      status: decision.link.status,
      providerId: decision.link.providerId,
      envelopeId: decision.link.envelopeId,
      generation: decision.link.generation,
      createdBy: decision.link.createdBy,
      createdAt: decision.link.createdAt,
    })
  }

  const refreshed = await findLinkByTemplate({
    subjectKind: parsed.values.subjectKind,
    subjectId: parsed.values.subjectId,
    templateId: parsed.values.templateId,
  })
  if (!refreshed) return { ok: false, error: 'Could not reload document link.' }
  return { ok: true, mediaId: refreshed.mediaId, link: refreshed }
}
