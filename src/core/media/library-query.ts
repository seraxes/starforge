/**
 * Pure Media library Phase 3 helpers — URL facets, bulk ids, analysis suggestions,
 * derivative size drift (boot-time Payload imageSizes vs saved Media Settings).
 */

import {
  DEFAULT_MEDIA_PIPELINE_RULES,
  isMediaPurpose,
  type MediaPipelineRules,
  type MediaPurpose,
} from './pipeline'
import type { MediaAnalysisResult } from './analysis/types'

export type MediaTagMatchMode = 'and' | 'or'

export type MediaLibraryTagFilter = {
  /** Unique tag ids (Payload tags collection). Empty = no tag facet. */
  ids: string[]
  mode: MediaTagMatchMode
}

/** Parse `?tag=` — single id or comma-separated multi. */
export function parseMediaTagFilter(
  raw: string | null | undefined,
  modeRaw?: string | null,
): MediaLibraryTagFilter {
  const mode: MediaTagMatchMode = modeRaw === 'and' ? 'and' : 'or'
  if (raw == null) return { ids: [], mode }
  const ids = String(raw)
    .split(/[,+\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== 'all')
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  return { ids: unique, mode }
}

/** Serialize tag facet for library URL (`tag` + optional `tagMode`). */
export function serializeMediaTagFilter(filter: MediaLibraryTagFilter): {
  tag?: string
  tagMode?: MediaTagMatchMode
} {
  if (!filter.ids.length) return {}
  return {
    tag: filter.ids.join(','),
    ...(filter.ids.length > 1 && filter.mode === 'and' ? { tagMode: 'and' as const } : {}),
  }
}

/** Normalize purpose query — `all` or a known purpose. */
export function normalizeMediaPurposeFilter(raw: string | null | undefined): MediaPurpose | 'all' {
  const v = (raw ?? '').trim()
  if (!v || v === 'all') return 'all'
  return isMediaPurpose(v) ? v : 'all'
}

/** Parse bulk media ids from FormData / CSV / repeated fields. */
export function parseMediaBulkIds(raw: unknown): string[] {
  const parts: string[] = []
  if (raw == null) return []
  if (Array.isArray(raw)) {
    for (const entry of raw) parts.push(...parseMediaBulkIds(entry))
    return dedupeIds(parts)
  }
  if (typeof raw === 'string') {
    for (const piece of raw.split(/[,;\s]+/)) {
      const id = piece.trim()
      if (id) parts.push(id)
    }
    return dedupeIds(parts)
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return [String(Math.trunc(raw))]
  }
  return []
}

function dedupeIds(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export type MediaSuggestionPatch = {
  alt?: string
  tagIds?: string[]
  purpose?: MediaPurpose
  categoryId?: string
}

/**
 * Merge analyzer suggestion objects into one confirmable patch.
 * First non-empty wins per field; tagIds are unioned.
 */
export function mergeMediaAnalysisSuggestions(
  results: MediaAnalysisResult[],
): MediaSuggestionPatch {
  const patch: MediaSuggestionPatch = {}
  const tagSeen = new Set<string>()
  const tagIds: string[] = []

  for (const result of results) {
    const s = result.suggestions
    if (!s) continue
    if (patch.alt == null && typeof s.alt === 'string' && s.alt.trim()) {
      patch.alt = s.alt.trim()
    }
    if (patch.purpose == null && isMediaPurpose(s.purpose)) {
      patch.purpose = s.purpose
    }
    if (patch.categoryId == null && Array.isArray(s.categoryIds)) {
      const first = s.categoryIds.map((c) => String(c).trim()).find(Boolean)
      if (first) patch.categoryId = first
    }
    if (Array.isArray(s.tagIds)) {
      for (const t of s.tagIds) {
        const id = String(t).trim()
        if (!id || tagSeen.has(id)) continue
        tagSeen.add(id)
        tagIds.push(id)
      }
    }
  }
  if (tagIds.length) patch.tagIds = tagIds
  return patch
}

export function mediaSuggestionPatchIsEmpty(patch: MediaSuggestionPatch): boolean {
  return (
    patch.alt == null &&
    patch.purpose == null &&
    patch.categoryId == null &&
    !(patch.tagIds && patch.tagIds.length)
  )
}

/** Boot-time Payload `imageSizes` edges (collection config constants). */
export function bootMediaDerivativeSizes(): MediaPipelineRules['sizes'] {
  return { ...DEFAULT_MEDIA_PIPELINE_RULES.sizes }
}

export type MediaDerivativeSizeDrift = {
  key: keyof MediaPipelineRules['sizes']
  boot: number
  saved: number
}

/** Saved Media Settings sizes that differ from boot-time Payload imageSizes. */
export function mediaDerivativeSizeDrift(
  saved: MediaPipelineRules['sizes'],
  boot: MediaPipelineRules['sizes'] = bootMediaDerivativeSizes(),
): MediaDerivativeSizeDrift[] {
  const keys: (keyof MediaPipelineRules['sizes'])[] = ['thumbnail', 'card', 'large']
  const out: MediaDerivativeSizeDrift[] = []
  for (const key of keys) {
    if (saved[key] !== boot[key]) {
      out.push({ key, boot: boot[key], saved: saved[key] })
    }
  }
  return out
}

/**
 * Payload `where` fragment for tag facet (hasMany).
 * Single id → `{ tags: { equals } }`; multi OR/AND as documented.
 */
export function mediaTagWhereClause(
  filter: MediaLibraryTagFilter,
): Record<string, unknown> | null {
  if (!filter.ids.length) return null
  const equalsClauses = filter.ids.map((id) => {
    const n = Number(id)
    return { tags: { equals: Number.isFinite(n) ? n : id } }
  })
  if (equalsClauses.length === 1) return equalsClauses[0]!
  if (filter.mode === 'and') return { and: equalsClauses }
  return { or: equalsClauses }
}
