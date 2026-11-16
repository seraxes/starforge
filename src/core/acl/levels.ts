/**
 * Admin-area grant levels. Groups stay the only ACL subject.
 * A higher level includes the lower ones. Across groups, the highest wins.
 */

export const ACL_GRANT_LEVELS = ['view', 'edit', 'manage'] as const

export type AclGrantLevel = (typeof ACL_GRANT_LEVELS)[number]

const RANK: Record<AclGrantLevel, number> = {
  view: 1,
  edit: 2,
  manage: 3,
}

export function isAclGrantLevel(value: unknown): value is AclGrantLevel {
  return value === 'view' || value === 'edit' || value === 'manage'
}

/** Stored `none` and unknown strings are no grant. A legacy boolean `true` is manage. */
export function grantLevelFromRow(level: unknown, allowed: boolean): AclGrantLevel | null {
  if (isAclGrantLevel(level)) return level
  if (allowed) return 'manage'
  return null
}

export function aclLevelSatisfies(
  held: AclGrantLevel | null | undefined,
  need: AclGrantLevel,
): boolean {
  if (!held) return false
  return RANK[held] >= RANK[need]
}

export function highestAclLevel(
  levels: Iterable<AclGrantLevel | null | undefined>,
): AclGrantLevel | null {
  let best: AclGrantLevel | null = null
  for (const level of levels) {
    if (!level) continue
    if (!best || RANK[level] > RANK[best]) best = level
  }
  return best
}
