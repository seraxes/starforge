/**
 * Pure nested-group helpers (no DB / session).
 * Membership expands **up** the parent chain at access-check time.
 */

/** Max nesting depth from a root (depth 0) to a leaf. */
export const MAX_GROUP_DEPTH = 8

/**
 * Expand direct membership ids with every ancestor parent id.
 * Order: direct ids first (stable), then newly discovered ancestors.
 */
export function expandGroupIdsWithAncestors(
  directIds: readonly string[],
  parentById: ReadonlyMap<string, string | null>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (id: string) => {
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    out.push(trimmed)
  }

  for (const id of directIds) push(id)

  for (const id of [...out]) {
    let current: string | null | undefined = parentById.get(id) ?? null
    let guard = 0
    while (current && guard < MAX_GROUP_DEPTH + 2) {
      push(current)
      current = parentById.get(current) ?? null
      guard += 1
    }
  }

  return out
}

/** Depth of `groupId` walking parents (0 = root). Missing id → 0. */
export function groupDepth(
  groupId: string,
  parentById: ReadonlyMap<string, string | null>,
): number {
  let depth = 0
  let current: string | null | undefined = parentById.get(groupId) ?? null
  const seen = new Set<string>([groupId])
  while (current) {
    if (seen.has(current)) return depth
    seen.add(current)
    depth += 1
    if (depth > MAX_GROUP_DEPTH) return depth
    current = parentById.get(current) ?? null
  }
  return depth
}

/**
 * True if setting `groupId`'s parent to `parentId` would create a cycle
 * (parent is the group itself or a descendant).
 */
export function wouldCreateCycle(
  groupId: string,
  parentId: string | null,
  parentById: ReadonlyMap<string, string | null>,
): boolean {
  if (!parentId) return false
  if (parentId === groupId) return true
  let current: string | null | undefined = parentId
  const seen = new Set<string>()
  while (current) {
    if (current === groupId) return true
    if (seen.has(current)) return true
    seen.add(current)
    current = parentById.get(current) ?? null
  }
  return false
}

/**
 * Depth the group would have if attached under `parentId`
 * (parent depth + 1, or 0 when no parent).
 */
export function depthUnderParent(
  parentId: string | null,
  parentById: ReadonlyMap<string, string | null>,
): number {
  if (!parentId) return 0
  return groupDepth(parentId, parentById) + 1
}

export type TreeGroupRow = {
  id: string
  parentId: string | null
  label: string
}

/**
 * Max depth of any descendant relative to `rootId` (root itself = 0).
 * Used when reparenting a subtree so the whole branch stays ≤ MAX_GROUP_DEPTH.
 */
export function maxRelativeSubtreeDepth(
  rootId: string,
  parentById: ReadonlyMap<string, string | null>,
): number {
  const children = new Map<string, string[]>()
  for (const [id, parentId] of parentById) {
    if (!parentId) continue
    const list = children.get(parentId) ?? []
    list.push(id)
    children.set(parentId, list)
  }

  let max = 0
  const walk = (id: string, depth: number) => {
    if (depth > max) max = depth
    for (const child of children.get(id) ?? []) {
      walk(child, depth + 1)
    }
  }
  walk(rootId, 0)
  return max
}

/**
 * DFS tree order: roots alphabetically by label, then children under each parent.
 * Orphans (parent missing from the set) are treated as roots.
 */
export function orderGroupsAsTree<T extends TreeGroupRow>(
  rows: readonly T[],
): Array<T & { depth: number }> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const children = new Map<string | null, T[]>()

  for (const row of rows) {
    const parentKey =
      row.parentId && byId.has(row.parentId) ? row.parentId : null
    const list = children.get(parentKey) ?? []
    list.push(row)
    children.set(parentKey, list)
  }

  for (const list of children.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }

  const out: Array<T & { depth: number }> = []
  const walk = (parentKey: string | null, depth: number) => {
    const list = children.get(parentKey) ?? []
    for (const row of list) {
      out.push({ ...row, depth })
      walk(row.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
