import type { NavItem } from '@/core/settings/defaults'

import type { AccessViewer } from './types'

/**
 * Pure nav / module visibility helpers (no session / next/headers).
 * Safe to import from shared code; viewer is passed in by the caller.
 */

/** Normalize one access tag token. */
export function normalizeAccessTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (!v) return null
  if (v === 'public' || v === 'registered') return v
  if (v.startsWith('group:')) {
    const id = v.slice('group:'.length).trim()
    return id ? `group:${id}` : null
  }
  if (/^[a-zA-Z0-9_-]+$/.test(v)) return `group:${v}`
  return null
}

/**
 * Collect access tags from `accessTags` and/or legacy single `accessLevel`.
 * Empty / missing → `['public']`.
 */
export function normalizeAccessTags(raw: {
  accessTags?: unknown
  accessLevel?: unknown
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (tag: string | null) => {
    if (!tag || seen.has(tag)) return
    seen.add(tag)
    out.push(tag)
  }

  if (Array.isArray(raw.accessTags)) {
    for (const entry of raw.accessTags) push(normalizeAccessTag(entry))
  } else if (typeof raw.accessTags === 'string' && raw.accessTags.trim()) {
    // JSON array or comma/pipe-separated
    const s = raw.accessTags.trim()
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown
        if (Array.isArray(parsed)) {
          for (const entry of parsed) push(normalizeAccessTag(entry))
        }
      } catch {
        /* fall through */
      }
    }
    if (out.length === 0) {
      for (const part of s.split(/[,|]/)) push(normalizeAccessTag(part))
    }
  }

  if (out.length === 0) {
    push(normalizeAccessTag(raw.accessLevel) ?? 'public')
  }

  return out.length > 0 ? out : ['public']
}

/** True when a single tag matches the viewer (no admin bypass). */
export function tagMatchesViewer(tag: string, viewer: AccessViewer): boolean {
  const raw = (tag || 'public').trim() || 'public'
  if (raw === 'public') return true
  if (raw === 'registered') return viewer.isRegistered
  if (raw.startsWith('group:')) {
    const groupId = raw.slice('group:'.length).trim()
    if (!groupId) return true
    return viewer.groupIds.includes(groupId)
  }
  return true
}

/**
 * Whether access tags are visible to the viewer (OR / any-match).
 * - empty / only missing → treat as public
 * - app admins always see
 * - visible if **any** tag matches
 */
export function canSeeNavAccessTags(
  tags: string[] | null | undefined,
  viewer: AccessViewer,
): boolean {
  if (viewer.isAppAdmin) return true
  const list = tags && tags.length > 0 ? tags : ['public']
  return list.some((tag) => tagMatchesViewer(tag, viewer))
}

/**
 * @deprecated Prefer `canSeeNavAccessTags` (multi-tag OR). Kept for layout slot single field.
 */
export function canSeeNavAccessLevel(
  accessLevel: string | null | undefined,
  viewer: AccessViewer,
): boolean {
  return canSeeNavAccessTags(normalizeAccessTags({ accessLevel }), viewer)
}

export function filterNavItemsForViewer<T extends NavItem>(
  items: T[],
  viewer: AccessViewer,
): T[] {
  return items.filter((item) => {
    const tags =
      item.accessTags && item.accessTags.length > 0
        ? item.accessTags
        : normalizeAccessTags({ accessLevel: item.accessLevel })
    return canSeeNavAccessTags(tags, viewer)
  })
}
