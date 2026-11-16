/**
 * Rewrite stored Nav page binds from Payload numeric ids to Starforge text ids.
 * Already-text ids (uuids) are left alone. Unmapped numbers stay put.
 */

function legacyKey(pageId: unknown): string | null {
  if (typeof pageId === 'number' && Number.isFinite(pageId)) return String(Math.trunc(pageId))
  if (typeof pageId === 'string' && /^\d+$/.test(pageId.trim())) return pageId.trim()
  return null
}

export function remapNavDocumentPageIds(
  raw: unknown,
  legacyToId: ReadonlyMap<string, string>,
): { next: unknown; changed: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { next: raw, changed: 0 }
  }
  const doc = raw as { items?: unknown }
  if (!Array.isArray(doc.items)) return { next: raw, changed: 0 }

  let changed = 0
  const items = doc.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const row = item as { pageId?: unknown; linkType?: unknown }
    if (row.linkType && row.linkType !== 'page') return item
    const key = legacyKey(row.pageId)
    if (!key) return item
    const mapped = legacyToId.get(key)
    if (!mapped || mapped === row.pageId) return item
    changed += 1
    return { ...row, pageId: mapped }
  })

  if (changed === 0) return { next: raw, changed: 0 }
  return { next: { ...(raw as object), items }, changed }
}
