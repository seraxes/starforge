/**
 * product:social account doors — DB path for export / hide / purge.
 *
 * Exposed on `@/modules/social/api.server` for `loadModuleDoor('social-api-server')`.
 * Hide keeps rows. Purge deletes this user’s Social rows (Core retention only).
 */

import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'

import { db } from '@/core/db'

import type {
  AccountExportPayload,
  AccountHideResult,
  AccountPurgeResult,
  SocialAccountTableName,
} from './account'
import { SOCIAL_ACCOUNT_TABLE_NAMES } from './account'
import { setMemberHiddenAt } from './members-store'
import {
  sfSocialActivities,
  sfSocialChallengeEntries,
  sfSocialChallengeLikes,
  sfSocialChallenges,
  sfSocialComments,
  sfSocialFriendships,
  sfSocialGroupMembers,
  sfSocialGroups,
  sfSocialMembers,
  sfSocialPageAdmins,
  sfSocialPageLikes,
  sfSocialPages,
  sfSocialPostMedia,
  sfSocialPosts,
  sfSocialReactions,
  sfSocialReports,
  sfSocialAlbumItems,
  sfSocialAlbums,
  sfSocialFollows,
  sfSocialMentions,
  sfSocialPollVotes,
  sfSocialPostTags,
  sfSocialSaves,
  sfSocialPostHides,
  sfSocialMutes,
  sfSocialStories,
  sfSocialStoryViews,
} from './schema'

function emptyTables(): Record<SocialAccountTableName, unknown[]> {
  const tables = {} as Record<SocialAccountTableName, unknown[]>
  for (const name of SOCIAL_ACCOUNT_TABLE_NAMES) {
    tables[name] = []
  }
  return tables
}

/**
 * Export this member’s Social rows for account download.
 * Null when userId is empty. Empty tables when Social tables are missing.
 */
export async function exportOwnSocialRecordFromDb(
  userId: string,
  opts?: { now?: Date },
): Promise<AccountExportPayload | null> {
  const id = userId.trim()
  if (!id) return null
  const now = opts?.now ?? new Date()
  const tables = emptyTables()

  try {
    tables.sf_social_friendships = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        or(
          eq(sfSocialFriendships.requesterId, id),
          eq(sfSocialFriendships.addresseeId, id),
        ),
      )

    tables.sf_social_posts = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.authorUserId, id))

    const postIds = (tables.sf_social_posts as { id: string }[]).map((row) => row.id)
    tables.sf_social_post_media =
      postIds.length > 0
        ? await db
            .select()
            .from(sfSocialPostMedia)
            .where(inArray(sfSocialPostMedia.postId, postIds))
        : []

    tables.sf_social_reactions = await db
      .select()
      .from(sfSocialReactions)
      .where(eq(sfSocialReactions.actorUserId, id))

    tables.sf_social_comments = await db
      .select()
      .from(sfSocialComments)
      .where(eq(sfSocialComments.authorUserId, id))

    tables.sf_social_members = await db
      .select()
      .from(sfSocialMembers)
      .where(eq(sfSocialMembers.userId, id))

    tables.sf_social_reports = await db
      .select()
      .from(sfSocialReports)
      .where(eq(sfSocialReports.reporterUserId, id))

    tables.sf_social_activities = await db
      .select()
      .from(sfSocialActivities)
      .where(eq(sfSocialActivities.actorUserId, id))

    // Host event/page threads — export stays empty for a member.
    tables.sf_social_conversations = []

    tables.sf_social_challenges = await db
      .select()
      .from(sfSocialChallenges)
      .where(eq(sfSocialChallenges.creatorUserId, id))

    tables.sf_social_challenge_entries = await db
      .select()
      .from(sfSocialChallengeEntries)
      .where(eq(sfSocialChallengeEntries.userId, id))

    tables.sf_social_challenge_likes = await db
      .select()
      .from(sfSocialChallengeLikes)
      .where(eq(sfSocialChallengeLikes.actorUserId, id))

    // Categories are site-owned — export stays empty for a member.
    tables.sf_social_group_categories = []

    tables.sf_social_groups = await db
      .select()
      .from(sfSocialGroups)
      .where(eq(sfSocialGroups.ownerUserId, id))

    tables.sf_social_group_members = await db
      .select()
      .from(sfSocialGroupMembers)
      .where(eq(sfSocialGroupMembers.userId, id))

    tables.sf_social_pages = await db
      .select()
      .from(sfSocialPages)
      .where(eq(sfSocialPages.ownerUserId, id))

    tables.sf_social_page_admins = await db
      .select()
      .from(sfSocialPageAdmins)
      .where(eq(sfSocialPageAdmins.userId, id))

    tables.sf_social_page_likes = await db
      .select()
      .from(sfSocialPageLikes)
      .where(eq(sfSocialPageLikes.userId, id))

    tables.sf_social_stories = await db
      .select()
      .from(sfSocialStories)
      .where(eq(sfSocialStories.authorUserId, id))

    tables.sf_social_story_views = await db
      .select()
      .from(sfSocialStoryViews)
      .where(eq(sfSocialStoryViews.userId, id))

    tables.sf_social_albums = await db
      .select()
      .from(sfSocialAlbums)
      .where(
        or(
          and(eq(sfSocialAlbums.ownerType, 'user'), eq(sfSocialAlbums.ownerId, id)),
          eq(sfSocialAlbums.createdByUserId, id),
        ),
      )

    tables.sf_social_album_items = await db
      .select()
      .from(sfSocialAlbumItems)
      .where(eq(sfSocialAlbumItems.addedByUserId, id))

    tables.sf_social_follows = await db
      .select()
      .from(sfSocialFollows)
      .where(
        or(
          eq(sfSocialFollows.followerUserId, id),
          eq(sfSocialFollows.followeeUserId, id),
        ),
      )

    tables.sf_social_saves = await db
      .select()
      .from(sfSocialSaves)
      .where(eq(sfSocialSaves.userId, id))

    tables.sf_social_post_tags =
      postIds.length > 0
        ? await db
            .select()
            .from(sfSocialPostTags)
            .where(inArray(sfSocialPostTags.postId, postIds))
        : []

    tables.sf_social_mentions = await db
      .select()
      .from(sfSocialMentions)
      .where(
        postIds.length > 0
          ? or(
              inArray(sfSocialMentions.postId, postIds),
              eq(sfSocialMentions.mentionedUserId, id),
            )
          : eq(sfSocialMentions.mentionedUserId, id),
      )

    tables.sf_social_poll_votes = await db
      .select()
      .from(sfSocialPollVotes)
      .where(
        postIds.length > 0
          ? or(
              eq(sfSocialPollVotes.userId, id),
              inArray(sfSocialPollVotes.postId, postIds),
            )
          : eq(sfSocialPollVotes.userId, id),
      )

    tables.sf_social_post_hides = await db
      .select()
      .from(sfSocialPostHides)
      .where(
        postIds.length > 0
          ? or(
              eq(sfSocialPostHides.userId, id),
              inArray(sfSocialPostHides.postId, postIds),
            )
          : eq(sfSocialPostHides.userId, id),
      )

    tables.sf_social_mutes = await db
      .select()
      .from(sfSocialMutes)
      .where(
        or(
          eq(sfSocialMutes.muterUserId, id),
          eq(sfSocialMutes.mutedUserId, id),
        ),
      )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) {
      return { exportedAt: now.toISOString(), userId: id, tables: emptyTables() }
    }
    throw error
  }

  return { exportedAt: now.toISOString(), userId: id, tables }
}

/**
 * Hide this member’s Social content. Sets `hiddenAt`; keeps every table’s rows.
 * Never calls purge. Staff accounts are refused.
 */
export async function hideOwnedSocialContentInDb(
  input: { userId: string; isStaff?: boolean },
  opts?: { now?: Date },
): Promise<AccountHideResult> {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }
  if (input.isStaff) return { ok: false, reason: 'staff_account' }

  const now = opts?.now ?? new Date()
  const member = await setMemberHiddenAt(userId, now, { now })
  if (!member || !member.hiddenAt) return { ok: false, reason: 'not_found' }
  return { ok: true, member, purged: false }
}

/**
 * Purge this member’s Social rows. Core retention final-delete only.
 * Not invoked by hideOwnedSocialContent.
 */
export async function purgeOwnSocialRecordInDb(input: {
  userId: string
}): Promise<AccountPurgeResult> {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }

  try {
    await db.transaction(async (tx) => {
      const authored = await tx
        .select({ id: sfSocialPosts.id })
        .from(sfSocialPosts)
        .where(eq(sfSocialPosts.authorUserId, userId))
      const postIds = authored.map((row) => row.id)

      if (postIds.length > 0) {
        await tx
          .delete(sfSocialPostMedia)
          .where(inArray(sfSocialPostMedia.postId, postIds))
        // Reactions / comments / activities / tags / mentions / saves on those posts.
        await tx
          .delete(sfSocialReactions)
          .where(
            and(
              eq(sfSocialReactions.targetType, 'post'),
              inArray(sfSocialReactions.targetId, postIds),
            ),
          )
        await tx.delete(sfSocialComments).where(inArray(sfSocialComments.postId, postIds))
        await tx
          .delete(sfSocialActivities)
          .where(inArray(sfSocialActivities.postId, postIds))
        await tx.delete(sfSocialPostTags).where(inArray(sfSocialPostTags.postId, postIds))
        await tx.delete(sfSocialMentions).where(inArray(sfSocialMentions.postId, postIds))
        await tx.delete(sfSocialSaves).where(inArray(sfSocialSaves.postId, postIds))
        await tx
          .delete(sfSocialPollVotes)
          .where(inArray(sfSocialPollVotes.postId, postIds))
        await tx
          .delete(sfSocialPostHides)
          .where(inArray(sfSocialPostHides.postId, postIds))
      }

      const ownedChallenges = await tx
        .select({ id: sfSocialChallenges.id })
        .from(sfSocialChallenges)
        .where(eq(sfSocialChallenges.creatorUserId, userId))
      const challengeIds = ownedChallenges.map((row) => row.id)

      if (challengeIds.length > 0) {
        await tx
          .delete(sfSocialChallengeLikes)
          .where(inArray(sfSocialChallengeLikes.challengeId, challengeIds))
        await tx
          .delete(sfSocialChallengeEntries)
          .where(inArray(sfSocialChallengeEntries.challengeId, challengeIds))
      }
      await tx
        .delete(sfSocialChallengeLikes)
        .where(eq(sfSocialChallengeLikes.actorUserId, userId))
      await tx
        .delete(sfSocialChallengeEntries)
        .where(eq(sfSocialChallengeEntries.userId, userId))
      await tx
        .delete(sfSocialChallenges)
        .where(eq(sfSocialChallenges.creatorUserId, userId))

      await tx
        .delete(sfSocialReactions)
        .where(eq(sfSocialReactions.actorUserId, userId))
      await tx
        .delete(sfSocialComments)
        .where(eq(sfSocialComments.authorUserId, userId))
      await tx
        .delete(sfSocialReports)
        .where(eq(sfSocialReports.reporterUserId, userId))
      await tx
        .delete(sfSocialActivities)
        .where(eq(sfSocialActivities.actorUserId, userId))
      await tx
        .delete(sfSocialFriendships)
        .where(
          or(
            eq(sfSocialFriendships.requesterId, userId),
            eq(sfSocialFriendships.addresseeId, userId),
          ),
        )

      const ownedGroups = await tx
        .select({ id: sfSocialGroups.id })
        .from(sfSocialGroups)
        .where(eq(sfSocialGroups.ownerUserId, userId))
      const ownedGroupIds = ownedGroups.map((row) => row.id)
      const ownedPages = await tx
        .select({ id: sfSocialPages.id })
        .from(sfSocialPages)
        .where(eq(sfSocialPages.ownerUserId, userId))
      const ownedPageIds = ownedPages.map((row) => row.id)

      // Albums before groups/pages so ownership rows still exist.
      const ownedAlbums = await tx.select().from(sfSocialAlbums)
      const albumIdsToPurge = ownedAlbums
        .filter((row) => {
          if (row.createdByUserId === userId) return true
          if (row.ownerType === 'user' && row.ownerId === userId) return true
          if (row.ownerType === 'group' && ownedGroupIds.includes(row.ownerId)) {
            return true
          }
          if (row.ownerType === 'page' && ownedPageIds.includes(row.ownerId)) {
            return true
          }
          return false
        })
        .map((row) => row.id)
      if (albumIdsToPurge.length > 0) {
        await tx
          .delete(sfSocialAlbumItems)
          .where(inArray(sfSocialAlbumItems.albumId, albumIdsToPurge))
        await tx.delete(sfSocialAlbums).where(inArray(sfSocialAlbums.id, albumIdsToPurge))
      }
      await tx
        .delete(sfSocialAlbumItems)
        .where(eq(sfSocialAlbumItems.addedByUserId, userId))

      if (ownedGroupIds.length > 0) {
        await tx
          .delete(sfSocialGroupMembers)
          .where(inArray(sfSocialGroupMembers.groupId, ownedGroupIds))
        await tx.delete(sfSocialGroups).where(inArray(sfSocialGroups.id, ownedGroupIds))
      }
      await tx
        .delete(sfSocialGroupMembers)
        .where(eq(sfSocialGroupMembers.userId, userId))
      // Categories stay — site-owned.

      if (ownedPageIds.length > 0) {
        await tx
          .delete(sfSocialPageLikes)
          .where(inArray(sfSocialPageLikes.pageId, ownedPageIds))
        await tx
          .delete(sfSocialPageAdmins)
          .where(inArray(sfSocialPageAdmins.pageId, ownedPageIds))
        await tx.delete(sfSocialPages).where(inArray(sfSocialPages.id, ownedPageIds))
      }
      await tx
        .delete(sfSocialPageLikes)
        .where(eq(sfSocialPageLikes.userId, userId))
      await tx
        .delete(sfSocialPageAdmins)
        .where(eq(sfSocialPageAdmins.userId, userId))

      const ownedStories = await tx
        .select({ id: sfSocialStories.id })
        .from(sfSocialStories)
        .where(eq(sfSocialStories.authorUserId, userId))
      const ownedStoryIds = ownedStories.map((row) => row.id)
      if (ownedStoryIds.length > 0) {
        await tx
          .delete(sfSocialStoryViews)
          .where(inArray(sfSocialStoryViews.storyId, ownedStoryIds))
        await tx.delete(sfSocialStories).where(inArray(sfSocialStories.id, ownedStoryIds))
      }
      await tx
        .delete(sfSocialStoryViews)
        .where(eq(sfSocialStoryViews.userId, userId))

      await tx
        .delete(sfSocialFollows)
        .where(
          or(
            eq(sfSocialFollows.followerUserId, userId),
            eq(sfSocialFollows.followeeUserId, userId),
          ),
        )

      await tx.delete(sfSocialSaves).where(eq(sfSocialSaves.userId, userId))
      await tx
        .delete(sfSocialMentions)
        .where(eq(sfSocialMentions.mentionedUserId, userId))
      await tx.delete(sfSocialPollVotes).where(eq(sfSocialPollVotes.userId, userId))
      await tx.delete(sfSocialPostHides).where(eq(sfSocialPostHides.userId, userId))
      await tx
        .delete(sfSocialMutes)
        .where(
          or(
            eq(sfSocialMutes.muterUserId, userId),
            eq(sfSocialMutes.mutedUserId, userId),
          ),
        )

      await tx.delete(sfSocialPosts).where(eq(sfSocialPosts.authorUserId, userId))
      await tx.delete(sfSocialMembers).where(eq(sfSocialMembers.userId, userId))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'not_found' }
    }
    throw error
  }

  return { ok: true, purged: true }
}
