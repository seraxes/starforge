/**
 * Document template render (decision + in-memory bag for unit tests).
 * Renders merge values into Media and upserts the subject link by
 * subject kind + subject id + template id. Second render updates that
 * one link’s mediaId and does not insert a second file (old Media is
 * dropped when the writer replaces). Pack off or authz failure → door
 * returns disabled and never writes.
 */

import { randomUUID } from 'node:crypto'

import { runDocumentsDoor, type DocumentsDoorResult } from './door'
import {
  decideBindDocumentMedia,
  type DocumentLinkRecord,
  type DocumentLinksBag,
} from './links'
import { renderDocumentValuesPdf } from './render-pdf'
import {
  validateRenderDocumentTemplate,
  validateTemplateForRender,
  type DocumentTemplateRecord,
  type RenderDocumentTemplateInput,
} from './render-rules'
import { documentLinkAllowsRender } from './signing-rules'

export type DocumentMediaFiles = {
  /** mediaId → PDF bytes */
  files: Map<string, Buffer>
}

export type DocumentRenderBag = DocumentLinksBag & {
  templates: Map<string, DocumentTemplateRecord>
  media: DocumentMediaFiles
}

export type RenderDocumentTemplateResult =
  | { ok: true; mediaId: string; link: DocumentLinkRecord }
  | { ok: false; error: string }

export type DocumentMediaWriter = {
  /**
   * Write PDF bytes to Media.
   * When `previousMediaId` is set, the writer must leave only one file
   * (replace in place or create + drop the previous id).
   */
  write: (
    bytes: Buffer,
    meta: { title: string; filename: string; previousMediaId?: string },
  ) => Promise<string>
}

function newLinkId(): string {
  return `dlink_${randomUUID().replace(/-/g, '')}`
}

function newMediaId(): string {
  return `media_${randomUUID().replace(/-/g, '')}`
}

/** Highest generation for subject + template (current contract row). */
function findLinkByTemplate(
  bag: DocumentLinksBag,
  subjectKind: string,
  subjectId: string,
  templateId: string,
): DocumentLinkRecord | null {
  let best: DocumentLinkRecord | null = null
  for (const row of bag.links.values()) {
    if (
      row.subjectKind !== subjectKind ||
      row.subjectId !== subjectId ||
      row.templateId !== templateId
    ) {
      continue
    }
    if (!best || row.generation > best.generation) best = row
  }
  return best
}

/**
 * In-memory Media writer.
 * With a previous id: drop the old file and create one new id so the link’s
 * mediaId updates and the bag still holds a single file.
 */
export function createDocumentMediaMemory(
  media: DocumentMediaFiles,
  opts?: { newId?: () => string },
): DocumentMediaWriter {
  const newId = opts?.newId ?? newMediaId
  return {
    async write(bytes, meta) {
      const previous = (meta.previousMediaId ?? '').trim()
      if (previous) media.files.delete(previous)
      const id = newId()
      media.files.set(id, bytes)
      return id
    },
  }
}

/**
 * Render a template into Media and upsert the subject link.
 * Unique key: subject kind + subject id + template id.
 */
export async function applyRenderDocumentTemplate(
  bag: DocumentRenderBag,
  input: RenderDocumentTemplateInput,
  mediaWriter: DocumentMediaWriter,
  opts?: { now?: Date; newId?: () => string },
): Promise<RenderDocumentTemplateResult> {
  const parsed = validateRenderDocumentTemplate(input)
  if (!parsed.ok) return parsed

  const template = bag.templates.get(parsed.values.templateId) ?? null
  const checked = validateTemplateForRender(template, parsed.values.subjectKind)
  if (!checked.ok) return checked

  const title =
    parsed.values.title || checked.template.title || checked.template.id
  const bytes = renderDocumentValuesPdf(title, parsed.values.values)
  const filename = `${parsed.values.templateId}-${parsed.values.subjectId}.pdf`

  const current = findLinkByTemplate(
    bag,
    parsed.values.subjectKind,
    parsed.values.subjectId,
    parsed.values.templateId,
  )

  // Signed generation is frozen — refuse and do not write.
  if (current && !documentLinkAllowsRender(current.status)) {
    return {
      ok: false,
      error: 'Document link is signed and cannot be re-rendered.',
    }
  }

  const mediaId = await mediaWriter.write(bytes, {
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
    { now: opts?.now, newId: opts?.newId ?? newLinkId },
  )
  bag.links.set(decision.link.id, decision.link)
  return { ok: true, mediaId, link: decision.link }
}

/**
 * Door-shaped render: pack off or authz failure → disabled and never writes.
 */
export async function renderDocumentTemplateThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  authorized: boolean,
  bag: DocumentRenderBag,
  input: RenderDocumentTemplateInput,
  mediaWriter: DocumentMediaWriter,
  opts?: { now?: Date; newId?: () => string },
): Promise<DocumentsDoorResult<RenderDocumentTemplateResult>> {
  return runDocumentsDoor(
    async () => {
      const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
      return enabled && authorized
    },
    () => applyRenderDocumentTemplate(bag, input, mediaWriter, opts),
  )
}

export function createDocumentRenderMemory(opts?: {
  now?: () => Date
  newId?: () => string
  newMediaId?: () => string
}): {
  bag: DocumentRenderBag
  mediaWriter: DocumentMediaWriter
  seedTemplate: (template: DocumentTemplateRecord) => void
  render: (
    input: RenderDocumentTemplateInput,
  ) => Promise<RenderDocumentTemplateResult>
  renderThroughDoor: (
    isEnabled: boolean,
    authorized: boolean,
    input: RenderDocumentTemplateInput,
  ) => Promise<DocumentsDoorResult<RenderDocumentTemplateResult>>
  linkCount: () => number
  mediaCount: () => number
} {
  const bag: DocumentRenderBag = {
    links: new Map(),
    templates: new Map(),
    media: { files: new Map() },
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? newLinkId
  const mediaWriter = createDocumentMediaMemory(bag.media, {
    newId: opts?.newMediaId ?? newMediaId,
  })

  return {
    bag,
    mediaWriter,
    seedTemplate: (template) => {
      bag.templates.set(template.id, template)
    },
    render: (input) =>
      applyRenderDocumentTemplate(bag, input, mediaWriter, {
        now: now(),
        newId,
      }),
    renderThroughDoor: (isEnabled, authorized, input) =>
      renderDocumentTemplateThroughDoor(
        isEnabled,
        authorized,
        bag,
        input,
        mediaWriter,
        { now: now(), newId },
      ),
    linkCount: () => bag.links.size,
    mediaCount: () => bag.media.files.size,
  }
}

export type { RenderDocumentTemplateInput, DocumentTemplateRecord } from './render-rules'
