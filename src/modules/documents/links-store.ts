/**
 * Document links persistence (sf_documents_links).
 * Media owns bytes; this store keeps subject ↔ mediaId only.
 */

import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import {
  decideBindDocumentMedia,
  type BindDocumentMediaResult,
  type DocumentLinkRecord,
  type ListDocumentLinksInput,
} from './links'
import { validateBindDocumentMedia, type BindDocumentMediaInput } from './links-rules'
import { sfDocumentsLinks } from './schema'

function newId(): string {
  return `dlink_${randomUUID().replace(/-/g, '')}`
}

function mapLink(row: typeof sfDocumentsLinks.$inferSelect): DocumentLinkRecord | null {
  const kind = (row.subjectKind ?? '').trim()
  if (kind !== 'user' && kind !== 'onboarding' && kind !== 'fleet_vehicle') {
    return null
  }
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

async function findExistingLink(
  values: {
    subjectKind: string
    subjectId: string
    templateId: string
    mediaId: string
  },
): Promise<DocumentLinkRecord | null> {
  if (values.templateId) {
    const rows = await db
      .select()
      .from(sfDocumentsLinks)
      .where(
        and(
          eq(sfDocumentsLinks.subjectKind, values.subjectKind),
          eq(sfDocumentsLinks.subjectId, values.subjectId),
          eq(sfDocumentsLinks.templateId, values.templateId),
        ),
      )
    const mapped = rows
      .map(mapLink)
      .filter((row): row is DocumentLinkRecord => row !== null)
      .sort((a, b) => b.generation - a.generation)
    return mapped[0] ?? null
  }

  const rows = await db
    .select()
    .from(sfDocumentsLinks)
    .where(
      and(
        eq(sfDocumentsLinks.subjectKind, values.subjectKind),
        eq(sfDocumentsLinks.subjectId, values.subjectId),
        eq(sfDocumentsLinks.templateId, ''),
        eq(sfDocumentsLinks.mediaId, values.mediaId),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? mapLink(row) : null
}

/** List links for one subject. */
export async function listDocumentLinksForSubject(
  input: ListDocumentLinksInput,
): Promise<DocumentLinkRecord[]> {
  const subjectKind = (input.subjectKind ?? '').trim()
  const subjectId = (input.subjectId ?? '').trim()
  if (!subjectKind || !subjectId) return []

  const rows = await db
    .select()
    .from(sfDocumentsLinks)
    .where(
      and(
        eq(sfDocumentsLinks.subjectKind, subjectKind),
        eq(sfDocumentsLinks.subjectId, subjectId),
      ),
    )
    .orderBy(asc(sfDocumentsLinks.createdAt))

  return rows.map(mapLink).filter((row): row is DocumentLinkRecord => row !== null)
}

/**
 * Store an existing mediaId on a subject. Does not create file bytes.
 * Template id set → unique on subject kind + subject id + template id (update that link).
 * No template id → update the same mediaId on that subject.
 */
export async function bindDocumentMediaInStore(
  input: BindDocumentMediaInput,
): Promise<BindDocumentMediaResult> {
  const parsed = validateBindDocumentMedia(input)
  if (!parsed.ok) return parsed

  const current = await findExistingLink(parsed.values)
  const decision = decideBindDocumentMedia(current, parsed.values, { newId })

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

  const refreshed = await findExistingLink(parsed.values)
  if (!refreshed) return { ok: false, error: 'Could not reload document link.' }
  return { ok: true, link: refreshed }
}
