/**
 * Home-feed composer stage.
 * One exclusive block (photos, link, vote, or place). Words ride along.
 * The client submits only that block so the server priority cannot drop another.
 */

import { POLL_OPTIONS_MAX, POLL_OPTIONS_MIN } from './polls-checkin'

export const STAGE_BLOCK_KINDS = ['media', 'link', 'poll', 'place'] as const
export type StageBlockKind = (typeof STAGE_BLOCK_KINDS)[number]

export type StageBlock =
  | { kind: 'media'; mediaIds: string[] }
  | { kind: 'link'; url: string }
  | { kind: 'poll'; options: string[] }
  | { kind: 'place'; label: string }

const HTTP_URL = /https?:\/\/[^\s<>"']+/i

export function firstHttpUrl(text: string): string | null {
  const match = text.match(HTTP_URL)
  if (!match?.[0]) return null
  const trimmed = match[0].replace(/[),.;!?]+$/g, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

/** Drop a promoted URL out of the caption. The card shows it instead. */
export function bodyWithoutUrl(body: string, url: string): string {
  const target = url.trim()
  if (!target) return body.trim()
  return body
    .replace(target, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function stageBlockHasContent(block: StageBlock | null): boolean {
  if (!block) return false
  if (block.kind === 'media') return block.mediaIds.some((id) => id.trim())
  if (block.kind === 'link') return block.url.trim().length > 0
  if (block.kind === 'place') return block.label.trim().length > 0
  return block.options.some((option) => option.trim())
}

/** A second instrument replaces the current block only after the member confirms. */
export function stageNeedsReplace(current: StageBlock | null, next: StageBlockKind): boolean {
  if (!current || current.kind === next) return false
  return stageBlockHasContent(current)
}

const BLOCK_NEXT: Record<StageBlockKind, string> = {
  media: 'photos',
  link: 'a link',
  poll: 'a vote',
  place: 'a place',
}

const BLOCK_OFF: Record<StageBlockKind, string> = {
  media: 'The photos come off.',
  link: 'The link comes off.',
  poll: 'The vote comes off.',
  place: 'The place comes off.',
}

export function stageReplacePrompt(from: StageBlockKind, to: StageBlockKind): string {
  return `This becomes ${BLOCK_NEXT[to]}. ${BLOCK_OFF[from]}`
}

export function stageCanPost(input: {
  body: string
  block: StageBlock | null
  allowText: boolean
}): boolean {
  const body = input.body.trim()
  const block = input.block
  if (!block || !stageBlockHasContent(block)) return input.allowText && body.length > 0
  if (block.kind === 'media') return block.mediaIds.some((id) => id.trim())
  if (block.kind === 'link') return firstHttpUrl(block.url) === block.url.trim()
  if (block.kind === 'place') return block.label.trim().length > 0
  const filled = block.options.map((option) => option.trim()).filter(Boolean)
  return filled.length >= POLL_OPTIONS_MIN && filled.length <= POLL_OPTIONS_MAX
}

export type StageSubmitFields = {
  linkUrl: string
  placeLabel: string
  pollOptions: string
  mediaIds: string[]
}

/** Only the active block is sent. An empty stage sends a text post. */
export function stageSubmitFields(block: StageBlock | null): StageSubmitFields {
  const empty: StageSubmitFields = {
    linkUrl: '',
    placeLabel: '',
    pollOptions: '',
    mediaIds: [],
  }
  if (!block || !stageBlockHasContent(block)) return empty
  if (block.kind === 'link') {
    return { ...empty, linkUrl: block.url.trim() }
  }
  if (block.kind === 'place') {
    return { ...empty, placeLabel: block.label.trim() }
  }
  if (block.kind === 'poll') {
    return {
      ...empty,
      pollOptions: block.options
        .map((option) => option.trim())
        .filter(Boolean)
        .join('\n'),
    }
  }
  return {
    ...empty,
    mediaIds: block.mediaIds.map((id) => id.trim()).filter(Boolean),
  }
}

/**
 * Newline-separated options stay intact (a comma can be part of a label).
 * A single line still splits on commas, matching the old composer field.
 */
export function splitPollOptionInput(raw: string): string[] {
  const text = raw.trim()
  if (!text) return []
  const parts = text.includes('\n') ? text.split(/\r?\n/) : text.split(',')
  return parts.map((line) => line.trim()).filter(Boolean)
}
