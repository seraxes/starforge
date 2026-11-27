/**
 * product:social account doors — export / hide / purge.
 *
 * Core calls these through `loadModuleDoor('social-api-server')`.
 * Hide keeps every registered table’s rows. Purge runs only when Core asks
 * after retention + final approval. This pack does not own the one-year clock.
 * A staff account is refused by the member hide flow (`staff_account`).
 */

import type { ActivityRecord } from './activity'
import type { HostConversationRecord } from './host-conversation'
import type {
  ChallengeEntryRecord,
  ChallengeLikeRecord,
  ChallengeRecord,
} from './challenge'
import type { CommentRecord } from './comments'
import type { FriendshipRecord } from './friends'
import type {
  GroupCategoryRecord,
  GroupMemberRecord,
  GroupRecord,
} from './groups'
import type { GroupDocumentRecord, GroupRankRecord } from './group-tools'
import type { MemberRecord } from './members'
import type {
  PageAdminRecord,
  PageLikeRecord,
  PageRecord,
} from './pages'
import type { PostMediaAttachment, PostRecord } from './posts'
import type { ReactionRecord } from './reactions'
import type { ReportRecord } from './reports'
import type { AlbumItemRecord, AlbumRecord } from './albums'
import type { FollowRecord } from './follows'
import type {
  MentionRecord,
  PostTagRecord,
  SaveRecord,
} from './mentions-tags-saves'
import type { PollVoteRecord } from './polls-checkin'
import type { MuteRecord, PostHideRecord } from './quiet'
import type { StoryRecord, StoryViewRecord } from './stories'

/** Every `sf_social_*` table must appear here with export, hide, and purge. */
export const SOCIAL_ACCOUNT_TABLE_NAMES = [
  'sf_social_friendships',
  'sf_social_posts',
  'sf_social_post_media',
  'sf_social_reactions',
  'sf_social_comments',
  'sf_social_members',
  'sf_social_reports',
  'sf_social_activities',
  'sf_social_conversations',
  'sf_social_challenges',
  'sf_social_challenge_entries',
  'sf_social_challenge_likes',
  'sf_social_group_categories',
  'sf_social_groups',
  'sf_social_group_members',
  'sf_social_group_ranks',
  'sf_social_group_documents',
  'sf_social_pages',
  'sf_social_page_admins',
  'sf_social_page_likes',
  'sf_social_stories',
  'sf_social_story_views',
  'sf_social_albums',
  'sf_social_album_items',
  'sf_social_follows',
  'sf_social_saves',
  'sf_social_post_tags',
  'sf_social_mentions',
  'sf_social_poll_votes',
  'sf_social_post_hides',
  'sf_social_mutes',
] as const

export type SocialAccountTableName = (typeof SOCIAL_ACCOUNT_TABLE_NAMES)[number]

export type AccountFriendshipRow = FriendshipRecord
export type AccountPostRow = PostRecord
export type AccountPostMediaRow = PostMediaAttachment & {
  id: string
  postId: string
  createdAt: Date
}
export type AccountReactionRow = ReactionRecord
export type AccountCommentRow = CommentRecord
export type AccountMemberRow = MemberRecord
export type AccountReportRow = ReportRecord
export type AccountActivityRow = ActivityRecord
export type AccountConversationRow = HostConversationRecord
export type AccountChallengeRow = ChallengeRecord
export type AccountChallengeEntryRow = ChallengeEntryRecord
export type AccountChallengeLikeRow = ChallengeLikeRecord
export type AccountGroupCategoryRow = GroupCategoryRecord
export type AccountGroupRow = GroupRecord
export type AccountGroupMemberRow = GroupMemberRecord
export type AccountGroupRankRow = GroupRankRecord
export type AccountGroupDocumentRow = GroupDocumentRecord
export type AccountPageRow = PageRecord
export type AccountPageAdminRow = PageAdminRecord
export type AccountPageLikeRow = PageLikeRecord
export type AccountStoryRow = StoryRecord
export type AccountStoryViewRow = StoryViewRecord
export type AccountAlbumRow = AlbumRecord
export type AccountAlbumItemRow = AlbumItemRecord
export type AccountFollowRow = FollowRecord
export type AccountSaveRow = SaveRecord
export type AccountPostTagRow = PostTagRecord
export type AccountMentionRow = MentionRecord
export type AccountPollVoteRow = PollVoteRecord
export type AccountPostHideRow = PostHideRecord
export type AccountMuteRow = MuteRecord

/** In-memory bag the registry handlers read and write (unit tests + pure doors). */
export type SocialAccountBag = {
  friendships: Map<string, AccountFriendshipRow>
  posts: Map<string, AccountPostRow>
  postMedia: Map<string, AccountPostMediaRow>
  reactions: Map<string, AccountReactionRow>
  comments: Map<string, AccountCommentRow>
  members: Map<string, AccountMemberRow>
  reports: Map<string, AccountReportRow>
  activities: Map<string, AccountActivityRow>
  conversations: Map<string, AccountConversationRow>
  challenges: Map<string, AccountChallengeRow>
  challengeEntries: Map<string, AccountChallengeEntryRow>
  challengeLikes: Map<string, AccountChallengeLikeRow>
  groupCategories: Map<string, AccountGroupCategoryRow>
  groups: Map<string, AccountGroupRow>
  groupMembers: Map<string, AccountGroupMemberRow>
  groupRanks: Map<string, AccountGroupRankRow>
  groupDocuments: Map<string, AccountGroupDocumentRow>
  pages: Map<string, AccountPageRow>
  pageAdmins: Map<string, AccountPageAdminRow>
  pageLikes: Map<string, AccountPageLikeRow>
  stories: Map<string, AccountStoryRow>
  storyViews: Map<string, AccountStoryViewRow>
  albums: Map<string, AccountAlbumRow>
  albumItems: Map<string, AccountAlbumItemRow>
  follows: Map<string, AccountFollowRow>
  saves: Map<string, AccountSaveRow>
  postTags: Map<string, AccountPostTagRow>
  mentions: Map<string, AccountMentionRow>
  pollVotes: Map<string, AccountPollVoteRow>
  postHides: Map<string, AccountPostHideRow>
  mutes: Map<string, AccountMuteRow>
}

export type SocialAccountTableHandlers = {
  table: SocialAccountTableName
  exportRows: (bag: SocialAccountBag, userId: string) => unknown[]
  /** Must keep rows. Members set hiddenAt; other tables are no-ops. */
  hide: (bag: SocialAccountBag, userId: string, now: Date) => void
  /** Hard-delete this user’s rows from the table. */
  purge: (bag: SocialAccountBag, userId: string) => void
}

export type AccountDoorRefuseReason =
  | 'invalid'
  | 'disabled'
  | 'staff_account'
  | 'not_found'

export type AccountHideResult =
  | { ok: true; member: AccountMemberRow; purged: false }
  | { ok: false; reason: AccountDoorRefuseReason }

export type AccountPurgeResult =
  | { ok: true; purged: true }
  | { ok: false; reason: AccountDoorRefuseReason }

export type AccountExportPayload = {
  exportedAt: string
  userId: string
  tables: Record<SocialAccountTableName, unknown[]>
}

/** Parse `pgTable('sf_social_…')` names from schema.ts source text. */
export function listSfSocialTablesFromSchemaSource(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/pgTable\(\s*['"](sf_social_[a-z0-9_]+)['"]/g)) {
    const name = match[1]
    if (name) found.add(name)
  }
  return [...found].sort()
}

export function listRegisteredSocialAccountTables(): SocialAccountTableName[] {
  return [...SOCIAL_ACCOUNT_TABLE_NAMES]
}

function emptyBag(): SocialAccountBag {
  return {
    friendships: new Map(),
    posts: new Map(),
    postMedia: new Map(),
    reactions: new Map(),
    comments: new Map(),
    members: new Map(),
    reports: new Map(),
    activities: new Map(),
    conversations: new Map(),
    challenges: new Map(),
    challengeEntries: new Map(),
    challengeLikes: new Map(),
    groupCategories: new Map(),
    groups: new Map(),
    groupMembers: new Map(),
    groupRanks: new Map(),
    groupDocuments: new Map(),
    pages: new Map(),
    pageAdmins: new Map(),
    pageLikes: new Map(),
    stories: new Map(),
    storyViews: new Map(),
    albums: new Map(),
    albumItems: new Map(),
    follows: new Map(),
    saves: new Map(),
    postTags: new Map(),
    mentions: new Map(),
    pollVotes: new Map(),
    postHides: new Map(),
    mutes: new Map(),
  }
}

function ownedPostIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.posts.values()]
      .filter((row) => row.authorUserId === userId)
      .map((row) => row.id),
  )
}

function ownedStoryIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.stories.values()]
      .filter((row) => row.authorUserId === userId)
      .map((row) => row.id),
  )
}

function ownedGroupIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.groups.values()]
      .filter((row) => row.ownerUserId === userId)
      .map((row) => row.id),
  )
}

function ownedPageIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.pages.values()]
      .filter((row) => row.ownerUserId === userId)
      .map((row) => row.id),
  )
}

function ownedAlbumIds(bag: SocialAccountBag, userId: string): Set<string> {
  const groups = ownedGroupIds(bag, userId)
  const pages = ownedPageIds(bag, userId)
  return new Set(
    [...bag.albums.values()]
      .filter((row) => {
        if (row.ownerType === 'user') return row.ownerId === userId
        if (row.ownerType === 'group') return groups.has(row.ownerId)
        if (row.ownerType === 'page') return pages.has(row.ownerId)
        return false
      })
      .map((row) => row.id),
  )
}

function ownedChallengeIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.challenges.values()]
      .filter((row) => row.creatorUserId === userId)
      .map((row) => row.id),
  )
}

function ensureMember(
  bag: SocialAccountBag,
  userId: string,
  now: Date,
): AccountMemberRow {
  const existing = bag.members.get(userId)
  if (existing) return existing
  const row: AccountMemberRow = {
    userId,
    bannedAt: null,
    hiddenAt: null,
    createdAt: now,
    updatedAt: now,
  }
  bag.members.set(userId, row)
  return row
}

function authoredPostIds(bag: SocialAccountBag, userId: string): Set<string> {
  return new Set(
    [...bag.posts.values()]
      .filter((row) => row.authorUserId === userId)
      .map((row) => row.id),
  )
}

/** Registry: one entry per `sf_social_*` table with export / hide / purge. */
export const SOCIAL_ACCOUNT_REGISTRY: readonly SocialAccountTableHandlers[] = [
  {
    table: 'sf_social_friendships',
    exportRows: (bag, userId) =>
      [...bag.friendships.values()].filter(
        (row) => row.requesterId === userId || row.addresseeId === userId,
      ),
    hide: () => {
      /* keep rows — visibility uses member.hiddenAt */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.friendships) {
        if (row.requesterId === userId || row.addresseeId === userId) {
          bag.friendships.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_posts',
    exportRows: (bag, userId) =>
      [...bag.posts.values()].filter((row) => row.authorUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.posts) {
        if (row.authorUserId === userId) bag.posts.delete(id)
      }
    },
  },
  {
    table: 'sf_social_post_media',
    exportRows: (bag, userId) => {
      const owned = authoredPostIds(bag, userId)
      return [...bag.postMedia.values()].filter((row) => owned.has(row.postId))
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      // Call while posts still exist so authorship is known.
      const owned = authoredPostIds(bag, userId)
      for (const [id, row] of bag.postMedia) {
        if (owned.has(row.postId)) bag.postMedia.delete(id)
      }
    },
  },
  {
    table: 'sf_social_reactions',
    exportRows: (bag, userId) =>
      [...bag.reactions.values()].filter((row) => row.actorUserId === userId),
    hide: () => {
      /* keep rows — name shows unavailable at read time */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.reactions) {
        if (row.actorUserId === userId) bag.reactions.delete(id)
      }
    },
  },
  {
    table: 'sf_social_comments',
    exportRows: (bag, userId) =>
      [...bag.comments.values()].filter((row) => row.authorUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.comments) {
        if (row.authorUserId === userId) bag.comments.delete(id)
      }
    },
  },
  {
    table: 'sf_social_members',
    exportRows: (bag, userId) => {
      const row = bag.members.get(userId)
      return row ? [row] : []
    },
    hide: (bag, userId, now) => {
      const current = ensureMember(bag, userId, now)
      bag.members.set(userId, {
        ...current,
        hiddenAt: now,
        updatedAt: now,
      })
    },
    purge: (bag, userId) => {
      bag.members.delete(userId)
    },
  },
  {
    table: 'sf_social_reports',
    exportRows: (bag, userId) =>
      [...bag.reports.values()].filter((row) => row.reporterUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.reports) {
        if (row.reporterUserId === userId) bag.reports.delete(id)
      }
    },
  },
  {
    table: 'sf_social_activities',
    exportRows: (bag, userId) =>
      [...bag.activities.values()].filter((row) => row.actorUserId === userId),
    hide: () => {
      /* keep rows — visibility uses member.hiddenAt / canViewPost */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.activities) {
        if (row.actorUserId === userId) bag.activities.delete(id)
      }
    },
  },
  {
    table: 'sf_social_conversations',
    exportRows: () => [],
    hide: () => {
      /* host-owned event/page threads — keep */
    },
    purge: () => {
      /* host-owned — not purged with a member */
    },
  },
  {
    table: 'sf_social_challenges',
    exportRows: (bag, userId) =>
      [...bag.challenges.values()].filter((row) => row.creatorUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.challenges) {
        if (row.creatorUserId === userId) bag.challenges.delete(id)
      }
    },
  },
  {
    table: 'sf_social_challenge_entries',
    exportRows: (bag, userId) =>
      [...bag.challengeEntries.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedChallengeIds(bag, userId)
      for (const [id, row] of bag.challengeEntries) {
        if (row.userId === userId || owned.has(row.challengeId)) {
          bag.challengeEntries.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_challenge_likes',
    exportRows: (bag, userId) =>
      [...bag.challengeLikes.values()].filter((row) => row.actorUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedChallengeIds(bag, userId)
      for (const [id, row] of bag.challengeLikes) {
        if (row.actorUserId === userId || owned.has(row.challengeId)) {
          bag.challengeLikes.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_group_categories',
    exportRows: () => [],
    hide: () => {
      /* site-owned categories — keep */
    },
    purge: () => {
      /* site-owned — not purged with a member */
    },
  },
  {
    table: 'sf_social_groups',
    exportRows: (bag, userId) =>
      [...bag.groups.values()].filter((row) => row.ownerUserId === userId),
    hide: () => {
      /* keep rows — visibility uses member.hiddenAt */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.groups) {
        if (row.ownerUserId === userId) bag.groups.delete(id)
      }
    },
  },
  {
    table: 'sf_social_group_members',
    exportRows: (bag, userId) =>
      [...bag.groupMembers.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedGroupIds(bag, userId)
      for (const [id, row] of bag.groupMembers) {
        if (row.userId === userId || owned.has(row.groupId)) {
          bag.groupMembers.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_group_ranks',
    exportRows: (bag, userId) => {
      const owned = ownedGroupIds(bag, userId)
      return [...bag.groupRanks.values()].filter((row) => owned.has(row.groupId))
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedGroupIds(bag, userId)
      for (const [id, row] of bag.groupRanks) {
        if (owned.has(row.groupId)) bag.groupRanks.delete(id)
      }
    },
  },
  {
    table: 'sf_social_group_documents',
    exportRows: (bag, userId) =>
      [...bag.groupDocuments.values()].filter((row) => row.addedByUserId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedGroupIds(bag, userId)
      for (const [id, row] of bag.groupDocuments) {
        if (row.addedByUserId === userId || owned.has(row.groupId)) {
          bag.groupDocuments.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_pages',
    exportRows: (bag, userId) =>
      [...bag.pages.values()].filter((row) => row.ownerUserId === userId),
    hide: () => {
      /* keep rows — visibility uses member.hiddenAt */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.pages) {
        if (row.ownerUserId === userId) bag.pages.delete(id)
      }
    },
  },
  {
    table: 'sf_social_page_admins',
    exportRows: (bag, userId) =>
      [...bag.pageAdmins.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPageIds(bag, userId)
      for (const [id, row] of bag.pageAdmins) {
        if (row.userId === userId || owned.has(row.pageId)) {
          bag.pageAdmins.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_page_likes',
    exportRows: (bag, userId) =>
      [...bag.pageLikes.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPageIds(bag, userId)
      for (const [id, row] of bag.pageLikes) {
        if (row.userId === userId || owned.has(row.pageId)) {
          bag.pageLikes.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_stories',
    exportRows: (bag, userId) =>
      [...bag.stories.values()].filter((row) => row.authorUserId === userId),
    hide: () => {
      /* keep rows — media file stays in product:media */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.stories) {
        if (row.authorUserId === userId) bag.stories.delete(id)
      }
    },
  },
  {
    table: 'sf_social_story_views',
    exportRows: (bag, userId) =>
      [...bag.storyViews.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedStoryIds(bag, userId)
      for (const [id, row] of bag.storyViews) {
        if (row.userId === userId || owned.has(row.storyId)) {
          bag.storyViews.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_albums',
    exportRows: (bag, userId) => {
      const owned = ownedAlbumIds(bag, userId)
      return [...bag.albums.values()].filter(
        (row) => owned.has(row.id) || row.createdByUserId === userId,
      )
    },
    hide: () => {
      /* keep rows — media file stays in product:media */
    },
    purge: (bag, userId) => {
      const owned = ownedAlbumIds(bag, userId)
      for (const [id, row] of bag.albums) {
        if (owned.has(row.id) || row.createdByUserId === userId) {
          bag.albums.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_album_items',
    exportRows: (bag, userId) => {
      const owned = ownedAlbumIds(bag, userId)
      return [...bag.albumItems.values()].filter(
        (row) => owned.has(row.albumId) || row.addedByUserId === userId,
      )
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      // Call while albums still exist so ownership is known.
      const owned = ownedAlbumIds(bag, userId)
      for (const [id, row] of bag.albumItems) {
        if (owned.has(row.albumId) || row.addedByUserId === userId) {
          bag.albumItems.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_follows',
    exportRows: (bag, userId) =>
      [...bag.follows.values()].filter(
        (row) => row.followerUserId === userId || row.followeeUserId === userId,
      ),
    hide: () => {
      /* keep rows — visibility uses member.hiddenAt / canInteract */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.follows) {
        if (row.followerUserId === userId || row.followeeUserId === userId) {
          bag.follows.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_saves',
    exportRows: (bag, userId) =>
      [...bag.saves.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      for (const [id, row] of bag.saves) {
        if (row.userId === userId || owned.has(row.postId)) {
          bag.saves.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_post_tags',
    exportRows: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      return [...bag.postTags.values()].filter((row) => owned.has(row.postId))
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      // Call while posts still exist so authorship is known.
      const owned = ownedPostIds(bag, userId)
      for (const [id, row] of bag.postTags) {
        if (owned.has(row.postId)) bag.postTags.delete(id)
      }
    },
  },
  {
    table: 'sf_social_mentions',
    exportRows: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      return [...bag.mentions.values()].filter(
        (row) => owned.has(row.postId) || row.mentionedUserId === userId,
      )
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      for (const [id, row] of bag.mentions) {
        if (owned.has(row.postId) || row.mentionedUserId === userId) {
          bag.mentions.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_poll_votes',
    exportRows: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      return [...bag.pollVotes.values()].filter(
        (row) => row.userId === userId || owned.has(row.postId),
      )
    },
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      for (const [id, row] of bag.pollVotes) {
        if (row.userId === userId || owned.has(row.postId)) {
          bag.pollVotes.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_post_hides',
    exportRows: (bag, userId) =>
      [...bag.postHides.values()].filter((row) => row.userId === userId),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      const owned = ownedPostIds(bag, userId)
      for (const [id, row] of bag.postHides) {
        if (row.userId === userId || owned.has(row.postId)) {
          bag.postHides.delete(id)
        }
      }
    },
  },
  {
    table: 'sf_social_mutes',
    exportRows: (bag, userId) =>
      [...bag.mutes.values()].filter(
        (row) => row.muterUserId === userId || row.mutedUserId === userId,
      ),
    hide: () => {
      /* keep rows */
    },
    purge: (bag, userId) => {
      for (const [id, row] of bag.mutes) {
        if (row.muterUserId === userId || row.mutedUserId === userId) {
          bag.mutes.delete(id)
        }
      }
    },
  },
]

/**
 * GDPR-style export of this member’s Social rows.
 * Returns null when userId is empty (caller treats as omit).
 */
export function exportOwnSocialRecord(
  bag: SocialAccountBag,
  userId: string,
  opts?: { now?: Date },
): AccountExportPayload | null {
  const id = userId.trim()
  if (!id) return null
  const now = opts?.now ?? new Date()
  const tables = {} as Record<SocialAccountTableName, unknown[]>
  for (const handlers of SOCIAL_ACCOUNT_REGISTRY) {
    tables[handlers.table] = handlers.exportRows(bag, id)
  }
  return {
    exportedAt: now.toISOString(),
    userId: id,
    tables,
  }
}

/**
 * Member / Core hide door. Sets `hiddenAt` on the member row; keeps every table’s rows.
 * Never calls purge. Staff accounts are refused (`staff_account`).
 */
export function hideOwnedSocialContent(
  bag: SocialAccountBag,
  input: { userId: string; isStaff?: boolean },
  opts?: { now?: Date },
): AccountHideResult {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }
  if (input.isStaff) return { ok: false, reason: 'staff_account' }

  const now = opts?.now ?? new Date()
  for (const handlers of SOCIAL_ACCOUNT_REGISTRY) {
    handlers.hide(bag, userId, now)
  }
  const member = bag.members.get(userId)
  if (!member || !member.hiddenAt) {
    return { ok: false, reason: 'not_found' }
  }
  return { ok: true, member, purged: false }
}

/**
 * Core retention final-delete door. Removes this user’s rows from every registered table.
 * Not called by the member hide flow. post_media runs before posts so authorship is known.
 */
export function purgeOwnSocialRecord(
  bag: SocialAccountBag,
  input: { userId: string },
): AccountPurgeResult {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }

  const byTable = new Map(SOCIAL_ACCOUNT_REGISTRY.map((row) => [row.table, row]))
  const order: SocialAccountTableName[] = [
    'sf_social_post_media',
    'sf_social_reactions',
    'sf_social_comments',
    'sf_social_reports',
    'sf_social_activities',
    'sf_social_conversations',
    'sf_social_challenge_likes',
    'sf_social_challenge_entries',
    'sf_social_challenges',
    // Albums before groups/pages so ownership is still known.
    'sf_social_album_items',
    'sf_social_albums',
    'sf_social_group_documents',
    'sf_social_group_ranks',
    'sf_social_group_members',
    'sf_social_groups',
    'sf_social_group_categories',
    'sf_social_page_likes',
    'sf_social_page_admins',
    'sf_social_pages',
    'sf_social_story_views',
    'sf_social_stories',
    'sf_social_follows',
    // Tags / mentions / saves / poll votes / hides / mutes before posts so authorship is still known.
    'sf_social_post_tags',
    'sf_social_mentions',
    'sf_social_saves',
    'sf_social_poll_votes',
    'sf_social_post_hides',
    'sf_social_mutes',
    'sf_social_friendships',
    'sf_social_posts',
    'sf_social_members',
  ]
  for (const table of order) {
    byTable.get(table)?.purge(bag, userId)
  }
  return { ok: true, purged: true }
}

/**
 * In-memory account bag for unit tests.
 * Optional `onPurge` / `onHide` let tests assert the member path never purges.
 */
export function createAccountMemory(opts?: {
  now?: () => Date
  onPurge?: (userId: string) => void
  onHide?: (userId: string) => void
}): {
  bag: SocialAccountBag
  exportOwn: (userId: string) => AccountExportPayload | null
  hideOwned: (input: { userId: string; isStaff?: boolean }) => AccountHideResult
  purgeOwn: (input: { userId: string }) => AccountPurgeResult
  seedFriendship: (row: AccountFriendshipRow) => void
  seedPost: (row: AccountPostRow) => void
  seedPostMedia: (row: AccountPostMediaRow) => void
  seedReaction: (row: AccountReactionRow) => void
  seedComment: (row: AccountCommentRow) => void
  seedMember: (row: AccountMemberRow) => void
  seedReport: (row: AccountReportRow) => void
  seedActivity: (row: AccountActivityRow) => void
  seedChallenge: (row: AccountChallengeRow) => void
  seedChallengeEntry: (row: AccountChallengeEntryRow) => void
  seedChallengeLike: (row: AccountChallengeLikeRow) => void
  seedGroupCategory: (row: AccountGroupCategoryRow) => void
  seedGroup: (row: AccountGroupRow) => void
  seedGroupMember: (row: AccountGroupMemberRow) => void
  seedGroupRank: (row: AccountGroupRankRow) => void
  seedGroupDocument: (row: AccountGroupDocumentRow) => void
  seedPage: (row: AccountPageRow) => void
  seedPageAdmin: (row: AccountPageAdminRow) => void
  seedPageLike: (row: AccountPageLikeRow) => void
  seedStory: (row: AccountStoryRow) => void
  seedStoryView: (row: AccountStoryViewRow) => void
  seedAlbum: (row: AccountAlbumRow) => void
  seedAlbumItem: (row: AccountAlbumItemRow) => void
  seedFollow: (row: AccountFollowRow) => void
  seedSave: (row: AccountSaveRow) => void
  seedPostTag: (row: AccountPostTagRow) => void
  seedMention: (row: AccountMentionRow) => void
  seedPostHide: (row: AccountPostHideRow) => void
  seedMute: (row: AccountMuteRow) => void
  countOwnedPosts: (userId: string) => number
  countOwnedFriendships: (userId: string) => number
} {
  const bag = emptyBag()
  const now = opts?.now ?? (() => new Date())

  return {
    bag,
    exportOwn: (userId) => exportOwnSocialRecord(bag, userId, { now: now() }),
    hideOwned: (input) => {
      opts?.onHide?.(input.userId.trim())
      return hideOwnedSocialContent(bag, input, { now: now() })
    },
    purgeOwn: (input) => {
      opts?.onPurge?.(input.userId.trim())
      return purgeOwnSocialRecord(bag, input)
    },
    seedFriendship: (row) => {
      bag.friendships.set(row.id, row)
    },
    seedPost: (row) => {
      bag.posts.set(row.id, row)
    },
    seedPostMedia: (row) => {
      bag.postMedia.set(row.id, row)
    },
    seedReaction: (row) => {
      bag.reactions.set(row.id, row)
    },
    seedComment: (row) => {
      bag.comments.set(row.id, row)
    },
    seedMember: (row) => {
      bag.members.set(row.userId, row)
    },
    seedReport: (row) => {
      bag.reports.set(row.id, row)
    },
    seedActivity: (row) => {
      bag.activities.set(row.id, row)
    },
    seedChallenge: (row) => {
      bag.challenges.set(row.id, row)
    },
    seedChallengeEntry: (row) => {
      bag.challengeEntries.set(row.id, row)
    },
    seedChallengeLike: (row) => {
      bag.challengeLikes.set(row.id, row)
    },
    seedGroupCategory: (row) => {
      bag.groupCategories.set(row.id, row)
    },
    seedGroup: (row) => {
      bag.groups.set(row.id, row)
    },
    seedGroupMember: (row) => {
      bag.groupMembers.set(row.id, row)
    },
    seedGroupRank: (row) => {
      bag.groupRanks.set(row.id, row)
    },
    seedGroupDocument: (row) => {
      bag.groupDocuments.set(row.id, row)
    },
    seedPage: (row) => {
      bag.pages.set(row.id, row)
    },
    seedPageAdmin: (row) => {
      bag.pageAdmins.set(row.id, row)
    },
    seedPageLike: (row) => {
      bag.pageLikes.set(row.id, row)
    },
    seedStory: (row) => {
      bag.stories.set(row.id, row)
    },
    seedStoryView: (row) => {
      bag.storyViews.set(row.id, row)
    },
    seedAlbum: (row) => {
      bag.albums.set(row.id, row)
    },
    seedAlbumItem: (row) => {
      bag.albumItems.set(row.id, row)
    },
    seedFollow: (row) => {
      bag.follows.set(row.id, row)
    },
    seedSave: (row) => {
      bag.saves.set(row.id, row)
    },
    seedPostTag: (row) => {
      bag.postTags.set(row.id, row)
    },
    seedMention: (row) => {
      bag.mentions.set(row.id, row)
    },
    seedPostHide: (row) => {
      bag.postHides.set(row.id, row)
    },
    seedMute: (row) => {
      bag.mutes.set(row.id, row)
    },
    countOwnedPosts: (userId) =>
      [...bag.posts.values()].filter((row) => row.authorUserId === userId).length,
    countOwnedFriendships: (userId) =>
      [...bag.friendships.values()].filter(
        (row) => row.requesterId === userId || row.addresseeId === userId,
      ).length,
  }
}
