/**
 * product:social People directory — filter candidates for /feed/people.
 * Omits hidden and blocked members. Block uses either blocker column (slice 7).
 */

export type PeopleDirectoryCandidate = {
  userId: string
  /** Profiles status hidden, or Social account hide (slice 10). */
  isHidden: boolean
  /** True when either person has blocked the other (pair query / isBlockedBetween). */
  isBlocked: boolean
}

/**
 * Whether a member appears in the viewer’s People directory.
 * Self is omitted. Hidden and blocked people are omitted.
 */
export function isPeopleDirectoryCandidate(
  personUserId: string,
  viewerUserId: string,
  ctx: Pick<PeopleDirectoryCandidate, 'isHidden' | 'isBlocked'>,
): boolean {
  const person = personUserId.trim()
  const viewer = viewerUserId.trim()
  if (!person || !viewer) return false
  if (person === viewer) return false
  if (ctx.isHidden) return false
  if (ctx.isBlocked) return false
  return true
}

/** Filter a list with the same rules as the People page. */
export function selectPeopleDirectory(
  people: readonly PeopleDirectoryCandidate[],
  viewerUserId: string,
): PeopleDirectoryCandidate[] {
  return people.filter((row) =>
    isPeopleDirectoryCandidate(row.userId, viewerUserId, {
      isHidden: row.isHidden,
      isBlocked: row.isBlocked,
    }),
  )
}
