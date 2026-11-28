/**
 * Document link bind / list (decision + in-memory bag for unit tests).
 * Pack off or authz failure → door returns disabled and never writes.
 * Subject kind `page` (and any unknown kind) is refused and does not write.
 */

import { randomUUID } from 'node:crypto'

import { runDocumentsDoor, type DocumentsDoorResult } from './door'
import {
  validateBindDocumentMedia,
  type BindDocumentMediaInput,
  type DocumentSubjectKind,
  type ParsedBindDocumentMedia,
} from './links-rules'

export type DocumentLinkRecord = {
  id: string
  subjectKind: DocumentSubjectKind
  subjectId: string
  templateId: string
  mediaId: string
  title: string
  /** Empty | draft | sent | signed | declined | void */
  status: string
  providerId: string
  envelopeId: string
  /** Contract generation; defaults to 1. */
  generation: number
  createdAt: Date
  createdBy: string
}

export type DocumentLinksBag = {
  links: Map<string, DocumentLinkRecord>
}

export type BindDocumentMediaResult =
  | { ok: true; link: DocumentLinkRecord }
  | { ok: false; error: string }

export type ListDocumentLinksInput = {
  subjectKind: string
  subjectId: string
}

function newLinkId(): string {
  return `dlink_${randomUUID().replace(/-/g, '')}`
}

function findExisting(
  bag: DocumentLinksBag,
  values: ParsedBindDocumentMedia,
): DocumentLinkRecord | null {
  let bestTemplate: DocumentLinkRecord | null = null
  for (const row of bag.links.values()) {
    if (row.subjectKind !== values.subjectKind || row.subjectId !== values.subjectId) {
      continue
    }
    if (values.templateId) {
      if (row.templateId !== values.templateId) continue
      if (!bestTemplate || row.generation > bestTemplate.generation) {
        bestTemplate = row
      }
      continue
    }
    if (!row.templateId && row.mediaId === values.mediaId) return row
  }
  return bestTemplate
}

/**
 * Decide insert vs update for a validated bind. Does not mutate the bag.
 */
export function decideBindDocumentMedia(
  current: DocumentLinkRecord | null,
  values: ParsedBindDocumentMedia,
  opts?: { now?: Date; newId?: () => string },
): { ok: true; write: 'insert' | 'update'; link: DocumentLinkRecord } {
  const now = opts?.now ?? new Date()
  if (current) {
    return {
      ok: true,
      write: 'update',
      link: {
        ...current,
        mediaId: values.mediaId,
        title: values.title,
        createdBy: values.createdBy || current.createdBy,
      },
    }
  }
  return {
    ok: true,
    write: 'insert',
    link: {
      id: (opts?.newId ?? newLinkId)(),
      subjectKind: values.subjectKind,
      subjectId: values.subjectId,
      templateId: values.templateId,
      mediaId: values.mediaId,
      title: values.title,
      status: '',
      providerId: '',
      envelopeId: '',
      generation: 1,
      createdAt: now,
      createdBy: values.createdBy,
    },
  }
}

/** Apply a bind into an in-memory bag (unit tests). */
export function applyBindDocumentMedia(
  bag: DocumentLinksBag,
  input: BindDocumentMediaInput,
  opts?: { now?: Date; newId?: () => string },
): BindDocumentMediaResult {
  const parsed = validateBindDocumentMedia(input)
  if (!parsed.ok) return parsed

  const current = findExisting(bag, parsed.values)
  const decision = decideBindDocumentMedia(current, parsed.values, opts)
  bag.links.set(decision.link.id, decision.link)
  return { ok: true, link: decision.link }
}

/** List links for one subject from an in-memory bag. */
export function listDocumentLinksFromBag(
  bag: DocumentLinksBag,
  input: ListDocumentLinksInput,
): DocumentLinkRecord[] {
  const subjectKind = (input.subjectKind ?? '').trim()
  const subjectId = (input.subjectId ?? '').trim()
  if (!subjectKind || !subjectId) return []
  return [...bag.links.values()]
    .filter((row) => row.subjectKind === subjectKind && row.subjectId === subjectId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/**
 * Door-shaped bind: pack off or authz failure → disabled and never writes.
 */
export async function bindDocumentMediaThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  authorized: boolean,
  bag: DocumentLinksBag,
  input: BindDocumentMediaInput,
  opts?: { now?: Date; newId?: () => string },
): Promise<DocumentsDoorResult<BindDocumentMediaResult>> {
  return runDocumentsDoor(
    async () => {
      const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
      return enabled && authorized
    },
    () => applyBindDocumentMedia(bag, input, opts),
  )
}

/** Door-shaped list for one subject. */
export async function listDocumentLinksThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  bag: DocumentLinksBag,
  input: ListDocumentLinksInput,
): Promise<DocumentsDoorResult<DocumentLinkRecord[]>> {
  return runDocumentsDoor(isEnabled, () => listDocumentLinksFromBag(bag, input))
}

export function createDocumentLinksMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: DocumentLinksBag
  bind: (input: BindDocumentMediaInput) => BindDocumentMediaResult
  bindThroughDoor: (
    isEnabled: boolean,
    authorized: boolean,
    input: BindDocumentMediaInput,
  ) => Promise<DocumentsDoorResult<BindDocumentMediaResult>>
  list: (input: ListDocumentLinksInput) => DocumentLinkRecord[]
  listThroughDoor: (
    isEnabled: boolean,
    input: ListDocumentLinksInput,
  ) => Promise<DocumentsDoorResult<DocumentLinkRecord[]>>
  count: () => number
} {
  const bag: DocumentLinksBag = { links: new Map() }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? newLinkId

  return {
    bag,
    bind: (input) => applyBindDocumentMedia(bag, input, { now: now(), newId }),
    bindThroughDoor: (isEnabled, authorized, input) =>
      bindDocumentMediaThroughDoor(isEnabled, authorized, bag, input, {
        now: now(),
        newId,
      }),
    list: (input) => listDocumentLinksFromBag(bag, input),
    listThroughDoor: (isEnabled, input) =>
      listDocumentLinksThroughDoor(isEnabled, bag, input),
    count: () => bag.links.size,
  }
}

export type { BindDocumentMediaInput, DocumentSubjectKind } from './links-rules'
