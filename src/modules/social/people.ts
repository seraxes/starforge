/**
 * product:social People directory — filter candidates for /feed/people.
 * Omits hidden and blocked members. Block uses either blocker column (slice 7).
 * Suggestions prefer mutual accepted friends; zero-mutual rows stay off the list.
 */

export const PEOPLE_SUGGESTION_LIMIT_DEFAULT = 8

export type PeopleDirectoryCandidate = {
  userId: string
  /** Profiles status hidden, or Social account hide (slice 10). */
  isHidden: boolean
  /** True when either person has blocked the other (pair query / isBlockedBetween). */
  isBlocked: boolean
}

export type PeopleSuggestionCandidate = {
  userId: string
  isHidden: boolean
  isBlocked: boolean
  /** Accepted friendship with the viewer. */
  isFriend: boolean
  /** Social `bannedAt` set on the candidate. */
  isBanned: boolean
  /** Shared accepted friends with the viewer (intersection size). */
  mutualFriendCount: number
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

/**
 * Count of user ids present in both accepted-friend sets.
 * Neither set should include its owner; owners are never mutuals of each other here.
 */
export function countMutualFriends(
  viewerFriendIds: ReadonlySet<string>,
  candidateFriendIds: ReadonlySet<string>,
): number {
  if (viewerFriendIds.size === 0 || candidateFriendIds.size === 0) return 0
  const [smaller, larger] =
    viewerFriendIds.size <= candidateFriendIds.size
      ? [viewerFriendIds, candidateFriendIds]
      : [candidateFriendIds, viewerFriendIds]
  let n = 0
  for (const id of smaller) {
    if (larger.has(id)) n += 1
  }
  return n
}

/** Label for UI when count &gt; 0; otherwise null (hide the line). */
export function formatMutualFriendCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  const n = Math.floor(count)
  if (n <= 0) return null
  return n === 1 ? '1 mutual friend' : `${n} mutual friends`
}

/**
 * Whether a member may appear in People suggestions.
 * Self, hidden, blocked, accepted friends, and banned members are omitted.
 * Mutual count is applied in {@link selectPeopleSuggestions}.
 */
export function isPeopleSuggestionCandidate(
  personUserId: string,
  viewerUserId: string,
  ctx: Omit<PeopleSuggestionCandidate, 'userId'>,
): boolean {
  const person = personUserId.trim()
  const viewer = viewerUserId.trim()
  if (!person || !viewer) return false
  if (person === viewer) return false
  if (ctx.isHidden) return false
  if (ctx.isBlocked) return false
  if (ctx.isFriend) return false
  if (ctx.isBanned) return false
  return true
}

/**
 * Short suggestion list for People: eligible members with mutualFriendCount &gt; 0,
 * highest mutuals first. Zero-mutual candidates never pad the list.
 */
export function selectPeopleSuggestions(
  people: readonly PeopleSuggestionCandidate[],
  viewerUserId: string,
  opts?: { limit?: number },
): PeopleSuggestionCandidate[] {
  const rawLimit = opts?.limit ?? PEOPLE_SUGGESTION_LIMIT_DEFAULT
  const limit = Math.min(Math.max(1, Math.floor(rawLimit)), 50)
  return people
    .filter(
      (row) =>
        row.mutualFriendCount > 0 &&
        isPeopleSuggestionCandidate(row.userId, viewerUserId, {
          isHidden: row.isHidden,
          isBlocked: row.isBlocked,
          isFriend: row.isFriend,
          isBanned: row.isBanned,
          mutualFriendCount: row.mutualFriendCount,
        }),
    )
    .slice()
    .sort((a, b) => {
      if (b.mutualFriendCount !== a.mutualFriendCount) {
        return b.mutualFriendCount - a.mutualFriendCount
      }
      return a.userId.localeCompare(b.userId)
    })
    .slice(0, limit)
}
