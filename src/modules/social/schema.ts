/**
 * product:social tables (sf_social_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 2: friendships (one row per unordered pair).
 * Slice 3: text posts (audiences + canViewPost).
 * Slice 4: feed reads those tables (no new tables).
 * Slice 5: post media attachments (mediaId rows; files stay in product:media).
 * Slice 6: reactions (unique per actor + target; catalog kinds in slice 22).
 * Slice 7: second blocker column (blocked_by_other) for mutual block without erase.
 * Slice 7b: home feed SQL visibility predicate (no new tables).
 * Slice 8: comments (visual two-level replies); post delete cascades comments + likes.
 * Slice 9: reports (postId required, optional commentId; one open per reporter/post).
 * Slice 9b: member bannedAt; comment staff hide; report resolve (review queue).
 * Slice 10: member hiddenAt (account hide keeps rows; purge is Core retention only).
 * Slice 11: activity cards (publishActivity; unique sourceModule+sourceId+activityKind).
 * Slice 12: challenges + entries + challenge likes; social.sweep locks past endsAt.
 * Slice 13: group categories, groups, membership (wall posts + invite).
 * Slice 14: group ranks, documents, announcement pin, member rankId.
 * Slice 15: pages, page admins, page likes (unique userId+pageId); page posts.
 * Slice 16: stories (24h) + story views (unique userId+storyId); social.sweep expiry.
 * Slice 17: albums (member/group/page) + album items (mediaId; files stay in Media).
 * Slice 18: share (sharedPostId) + link preview columns on sf_social_posts.
 * Slice 19: follows (unique follower+followee) + Following tab of public posts.
 * Slice 20: mentions, hashtags (post tags), saves (unique userId+postId).
 * Slice 21: polls (options on post + sf_social_poll_votes) and check-in (label + optional Maps pin).
 * Slice 22 discover: /feed/discover public posts (no new tables); friends-only absent.
 * Slice 22 reaction catalog: kinds like|love|haha|wow|sad|angry; only like enabled (admin toggles in 15b).
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Friend / block edge between two members.
 * Unique on (pairLow, pairHigh) — one row per unordered pair.
 * User ids are plain text (no FK to auth).
 */
export const sfSocialFriendships = pgTable(
  'sf_social_friendships',
  {
    id: text('id').primaryKey(),
    requesterId: text('requester_id').notNull(),
    addresseeId: text('addressee_id').notNull(),
    /** Lexicographic low of the unordered pair (unique with pairHigh). */
    pairLow: text('pair_low').notNull(),
    /** Lexicographic high of the unordered pair (unique with pairLow). */
    pairHigh: text('pair_high').notNull(),
    /** pending | accepted | declined | blocked */
    status: text('status').notNull().default('pending'),
    /**
     * First recorded blocker user id (slice 2).
     * Slice 7: a second person uses blockedByOther — neither column erases the other.
     */
    blockedBy: text('blocked_by'),
    /** Second blocker user id — mutual block without clearing the first. */
    blockedByOther: text('blocked_by_other'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_friendships_pair_uidx').on(table.pairLow, table.pairHigh),
    index('sf_social_friendships_requester_idx').on(table.requesterId),
    index('sf_social_friendships_addressee_idx').on(table.addresseeId),
    index('sf_social_friendships_status_idx').on(table.status),
  ],
)

/**
 * Member / group / page post.
 * Audience: only_me | group | friends (default) | public.
 * User ids and group/page ids are plain text (no cross-pack FK).
 * Hero airsoft fields go in extensions, not new columns.
 */
export const sfSocialPosts = pgTable(
  'sf_social_posts',
  {
    id: text('id').primaryKey(),
    authorUserId: text('author_user_id').notNull(),
    /** Author words (rich-editor HTML). Not content-locale files. */
    body: text('body').notNull().default(''),
    /** text | media | activity | challenge | link | share | poll | checkin */
    kind: text('kind').notNull().default('text'),
    /** only_me | group | friends | public */
    audience: text('audience').notNull().default('friends'),
    /** Set when audience is group (or a group-wall post). */
    groupId: text('group_id'),
    /** Set for a social-page post (likers + page admins). */
    pageId: text('page_id'),
    /** Share target post id (kind=share). Plain text — no FK. */
    sharedPostId: text('shared_post_id'),
    /** Link URL (kind=link). Private / internal addresses refused at create. */
    linkUrl: text('link_url'),
    linkTitle: text('link_title'),
    linkDescription: text('link_description'),
    linkImageUrl: text('link_image_url'),
    /** Poll options (kind=poll). Votes live in sf_social_poll_votes. */
    pollOptions: jsonb('poll_options')
      .$type<Array<{ id: string; label: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** When set, the poll is closed — cannot edit options or body. */
    pollClosedAt: timestamp('poll_closed_at', { withTimezone: true }),
    /** Check-in place label (kind=checkin). Saved even when Maps fails. */
    placeLabel: text('place_label'),
    /** Optional Maps pin id when the Maps door resolved a pin. */
    mapsPinId: text('maps_pin_id'),
    placeLat: doublePrecision('place_lat'),
    placeLng: doublePrecision('place_lng'),
    /** Staff moderation hide. Author and social.posts manage still see it. */
    staffHidden: boolean('staff_hidden').notNull().default(false),
    /** Group announcement pin (team/association tools). */
    isAnnouncement: boolean('is_announcement').notNull().default(false),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    /** Hero / vertical extras — not new sf_social_* columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_posts_author_idx').on(table.authorUserId),
    index('sf_social_posts_audience_idx').on(table.audience),
    index('sf_social_posts_group_idx').on(table.groupId),
    index('sf_social_posts_page_idx').on(table.pageId),
    index('sf_social_posts_shared_post_idx').on(table.sharedPostId),
    index('sf_social_posts_created_idx').on(table.createdAt),
    index('sf_social_posts_announcement_idx').on(table.groupId, table.isAnnouncement),
  ],
)

/**
 * Media attached to a post. Files live in product:media; this row is the bind.
 * Role attachment (composer) or challenge_entry (later). Many images or one video.
 */
export const sfSocialPostMedia = pgTable(
  'sf_social_post_media',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    /** Plain text media id — no FK to sf_media_*. */
    mediaId: text('media_id').notNull(),
    /** Snapshot at attach time (image/* or video/*) for feed render. */
    mimeType: text('mime_type'),
    /** attachment | challenge_entry */
    role: text('role').notNull().default('attachment'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_post_media_post_media_uidx').on(table.postId, table.mediaId),
    index('sf_social_post_media_post_idx').on(table.postId),
    index('sf_social_post_media_media_idx').on(table.mediaId),
  ],
)

/**
 * Reaction on a post (or later a comment). Catalog kinds: like, love, haha,
 * wow, sad, angry. Only `like` is enabled until slice 15b admin toggles.
 * Unique (actorUserId, targetType, targetId) — not the challenge vote table.
 * User ids and target ids are plain text (no cross-pack FK).
 */
export const sfSocialReactions = pgTable(
  'sf_social_reactions',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    /** post (comment later) */
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    /** Catalog kind; enabled set defaults to like only */
    kind: text('kind').notNull().default('like'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_reactions_actor_target_uidx').on(
      table.actorUserId,
      table.targetType,
      table.targetId,
    ),
    index('sf_social_reactions_target_idx').on(table.targetType, table.targetId),
    index('sf_social_reactions_actor_idx').on(table.actorUserId),
  ],
)

/**
 * Comment on a post. parentCommentId points at the comment being answered
 * (any depth). The conversation UI keeps two visual steps and names who a
 * nested reply answers.
 * User ids and post/comment ids are plain text (no cross-pack FK).
 */
export const sfSocialComments = pgTable(
  'sf_social_comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    authorUserId: text('author_user_id').notNull(),
    /** Author words (rich-editor HTML). Not content-locale files. */
    body: text('body').notNull().default(''),
    /** Null = comment on the post. Set = reply to that comment (any depth). */
    parentCommentId: text('parent_comment_id'),
    /** Staff moderation hide. Author and social.posts manage still see it. */
    staffHidden: boolean('staff_hidden').notNull().default(false),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_comments_post_idx').on(table.postId),
    index('sf_social_comments_parent_idx').on(table.parentCommentId),
    index('sf_social_comments_author_idx').on(table.authorUserId),
    index('sf_social_comments_created_idx').on(table.createdAt),
  ],
)

/**
 * Social member extras (ban + account hide). One row per userId.
 * A ban is Social `bannedAt` — not a Core role change and not an account delete.
 * Account hide sets `hiddenAt` and keeps rows; purge is a separate Core door.
 */
export const sfSocialMembers = pgTable(
  'sf_social_members',
  {
    userId: text('user_id').primaryKey(),
    /** Set when staff bans this member inside Social. Null = not banned. */
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    /**
     * Set when the account is hidden (member flow or Core retention hide).
     * Rows stay; canViewPost / canInteract treat the account as hidden.
     * Null = visible. Purge clears the row later via purgeOwnSocialRecord.
     */
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_members_banned_idx').on(table.bannedAt),
    index('sf_social_members_hidden_idx').on(table.hiddenAt),
  ],
)

/**
 * Abuse flag on a post (optional comment under that post).
 * Always has postId. Stories / groups / pages have no Report control.
 * One open row per (reporterUserId, postId) — second flag updates that row.
 * Post delete keeps report rows (queue shows the post as deleted).
 */
export const sfSocialReports = pgTable(
  'sf_social_reports',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    /** Optional — comment under the same post. */
    commentId: text('comment_id'),
    reporterUserId: text('reporter_user_id').notNull(),
    /** spam | harassment | other */
    reason: text('reason').notNull().default('other'),
    note: text('note'),
    /** open | hidden | dismissed — create always opens; 9b resolves. */
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_reports_open_reporter_post_uidx')
      .on(table.reporterUserId, table.postId)
      .where(sql`${table.status} = 'open'`),
    index('sf_social_reports_post_idx').on(table.postId),
    index('sf_social_reports_comment_idx').on(table.commentId),
    index('sf_social_reports_reporter_idx').on(table.reporterUserId),
    index('sf_social_reports_status_idx').on(table.status),
    index('sf_social_reports_created_idx').on(table.createdAt),
  ],
)

/**
 * Cross-pack activity card (Events / Pages publish via publishActivity).
 * Unique (sourceModule, sourceId, activityKind) — a republish updates that row.
 * Linked post is kind `activity` for feed + canViewPost. Snapshot is the
 * fallback when the source is gone; readers re-resolve through the owner door.
 */
export const sfSocialActivities = pgTable(
  'sf_social_activities',
  {
    id: text('id').primaryKey(),
    /** Owning pack id, e.g. product:events — plain text, no FK. */
    sourceModule: text('source_module').notNull(),
    /** Id inside the source pack — plain text, no FK. */
    sourceId: text('source_id').notNull(),
    /** e.g. event.published | page.published */
    activityKind: text('activity_kind').notNull(),
    /** Publisher member — card shows on their friends’ feeds. */
    actorUserId: text('actor_user_id').notNull(),
    /** Linked sf_social_posts row (kind activity). */
    postId: text('post_id').notNull(),
    /** Fallback title / href / mediaId when the source is gone. */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_activities_source_uidx').on(
      table.sourceModule,
      table.sourceId,
      table.activityKind,
    ),
    index('sf_social_activities_actor_idx').on(table.actorUserId),
    index('sf_social_activities_post_idx').on(table.postId),
    index('sf_social_activities_created_idx').on(table.createdAt),
  ],
)

/**
 * Challenge contest linked to a kind=challenge post.
 * endsAt = publishedAt + lengthDays × 24h. Accept window 24|48 must not exceed length.
 * Sweep locks past endsAt and writes outcome. No share of the challenge post.
 */
export const sfSocialChallenges = pgTable(
  'sf_social_challenges',
  {
    id: text('id').primaryKey(),
    /** Linked sf_social_posts row (kind challenge). */
    postId: text('post_id').notNull(),
    creatorUserId: text('creator_user_id').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    /** Contest length in whole days (1–7). */
    lengthDays: integer('length_days').notNull(),
    /** Accept / upload response window in hours (24 | 48). */
    acceptWindowHours: integer('accept_window_hours').notNull(),
    /** publishedAt + lengthDays × 24h — hard stop for accepts, uploads, likes. */
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** Set by social.sweep when now >= endsAt. */
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    /** winner | draw | unanswered — set when locked. */
    outcome: text('outcome'),
    /** Winning entry id when outcome is winner. */
    winnerEntryId: text('winner_entry_id'),
    /** Hero / vertical extras — not new columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_challenges_post_uidx').on(table.postId),
    index('sf_social_challenges_creator_idx').on(table.creatorUserId),
    index('sf_social_challenges_ends_idx').on(table.endsAt),
    index('sf_social_challenges_locked_idx').on(table.lockedAt),
  ],
)

/**
 * One row per invitee (or creator opening entry) on a challenge.
 * Status: invited → accepted → submitted, or declined / expired.
 */
export const sfSocialChallengeEntries = pgTable(
  'sf_social_challenge_entries',
  {
    id: text('id').primaryKey(),
    challengeId: text('challenge_id').notNull(),
    userId: text('user_id').notNull(),
    /** invited | accepted | submitted | declined | expired */
    status: text('status').notNull().default('invited'),
    /** Creator opening media counts as an entry. */
    isCreator: boolean('is_creator').notNull().default(false),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    /** min(publishedAt + acceptWindow, endsAt) while invited. */
    acceptDeadlineAt: timestamp('accept_deadline_at', { withTimezone: true }),
    /** min(acceptedAt + acceptWindow, endsAt) while accepted. */
    uploadDeadlineAt: timestamp('upload_deadline_at', { withTimezone: true }),
    /** Submitted entry media — files stay in product:media. */
    mediaId: text('media_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_challenge_entries_challenge_user_uidx').on(
      table.challengeId,
      table.userId,
    ),
    index('sf_social_challenge_entries_challenge_idx').on(table.challengeId),
    index('sf_social_challenge_entries_user_idx').on(table.userId),
    index('sf_social_challenge_entries_status_idx').on(table.status),
  ],
)

/**
 * Challenge entry likes — not sf_social_reactions.
 * Unique (actorUserId, challengeId): moving a like updates this row’s entryId.
 * Entrants cannot like.
 */
export const sfSocialChallengeLikes = pgTable(
  'sf_social_challenge_likes',
  {
    id: text('id').primaryKey(),
    challengeId: text('challenge_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    /** Liked entry under this challenge. */
    entryId: text('entry_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_challenge_likes_actor_challenge_uidx').on(
      table.actorUserId,
      table.challengeId,
    ),
    index('sf_social_challenge_likes_challenge_idx').on(table.challengeId),
    index('sf_social_challenge_likes_entry_idx').on(table.entryId),
  ],
)

/**
 * Named group category. Kind is general | team | association.
 * Team / association tools (ranks, docs, announcements) are slice 14.
 */
export const sfSocialGroupCategories = pgTable(
  'sf_social_group_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** general | team | association */
    kind: text('kind').notNull().default('general'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_group_categories_slug_uidx').on(table.slug),
    index('sf_social_group_categories_kind_idx').on(table.kind),
  ],
)

/**
 * Social group (wall + members). Visibility open | closed.
 * formDefinitionId is optional Forms join bind.
 * User ids and category / form ids are plain text (no cross-pack FK).
 */
export const sfSocialGroups = pgTable(
  'sf_social_groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    coverMediaId: text('cover_media_id'),
    categoryId: text('category_id').notNull(),
    /** open | closed */
    visibility: text('visibility').notNull().default('open'),
    ownerUserId: text('owner_user_id').notNull(),
    /** Optional Forms definition for closed-group join. */
    formDefinitionId: text('form_definition_id'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Hero / vertical extras — not new columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_groups_slug_uidx').on(table.slug),
    index('sf_social_groups_category_idx').on(table.categoryId),
    index('sf_social_groups_owner_idx').on(table.ownerUserId),
    index('sf_social_groups_visibility_idx').on(table.visibility),
  ],
)

/**
 * Group membership. Unique (groupId, userId) — second invite updates the row.
 * Role owner | admin | member. Status active | invited | requested.
 * Optional rankId for team/association tools.
 */
export const sfSocialGroupMembers = pgTable(
  'sf_social_group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    /** owner | admin | member */
    role: text('role').notNull().default('member'),
    /** active | invited | requested */
    status: text('status').notNull().default('active'),
    /** Inviter when status is invited. */
    invitedByUserId: text('invited_by_user_id'),
    /** Optional rank from sf_social_group_ranks (plain text id). */
    rankId: text('rank_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_group_members_group_user_uidx').on(table.groupId, table.userId),
    index('sf_social_group_members_user_idx').on(table.userId),
    index('sf_social_group_members_status_idx').on(table.status),
    index('sf_social_group_members_role_idx').on(table.role),
    index('sf_social_group_members_rank_idx').on(table.rankId),
  ],
)

/**
 * Team / association rank. Flags add actions for a member; they do not write Core ACL.
 * A rank cannot remove the owner or an admin.
 */
export const sfSocialGroupRanks = pgTable(
  'sf_social_group_ranks',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    canAnnounce: boolean('can_announce').notNull().default(false),
    canManageDocuments: boolean('can_manage_documents').notNull().default(false),
    canManageCalendar: boolean('can_manage_calendar').notNull().default(false),
    canManageMembers: boolean('can_manage_members').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_group_ranks_group_idx').on(table.groupId),
    index('sf_social_group_ranks_sort_idx').on(table.groupId, table.sortOrder),
  ],
)

/**
 * Group document bind. File stays in product:media (mediaId plain text).
 */
export const sfSocialGroupDocuments = pgTable(
  'sf_social_group_documents',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    mediaId: text('media_id').notNull(),
    title: text('title').notNull().default(''),
    addedByUserId: text('added_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_group_documents_group_idx').on(table.groupId),
    index('sf_social_group_documents_media_idx').on(table.mediaId),
    index('sf_social_group_documents_added_by_idx').on(table.addedByUserId),
  ],
)

/**
 * Social page (wall for likers + admins). Optional sitePageId links an editorial
 * product:pages row (plain text id, no FK). User ids are plain text.
 */
export const sfSocialPages = pgTable(
  'sf_social_pages',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    coverMediaId: text('cover_media_id'),
    ownerUserId: text('owner_user_id').notNull(),
    /** Optional editorial page id from product:pages — plain text, no FK. */
    sitePageId: text('site_page_id'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Hero / vertical extras — not new columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_pages_slug_uidx').on(table.slug),
    index('sf_social_pages_owner_idx').on(table.ownerUserId),
    index('sf_social_pages_site_page_idx').on(table.sitePageId),
  ],
)

/**
 * Page admin. Unique (pageId, userId) — second add updates the open row.
 * Owner is seeded as admin on create. canViewPost uses isPageAdmin.
 */
export const sfSocialPageAdmins = pgTable(
  'sf_social_page_admins',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id').notNull(),
    userId: text('user_id').notNull(),
    /** Inviter / granter when added by another admin. */
    addedByUserId: text('added_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_page_admins_page_user_uidx').on(table.pageId, table.userId),
    index('sf_social_page_admins_user_idx').on(table.userId),
  ],
)

/**
 * Page like. Unique (userId, pageId) — second like updates that one row.
 * canViewPost uses isPageLiker for page posts.
 */
export const sfSocialPageLikes = pgTable(
  'sf_social_page_likes',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_page_likes_user_page_uidx').on(table.userId, table.pageId),
    index('sf_social_page_likes_page_idx').on(table.pageId),
  ],
)

/**
 * Ephemeral story (24 hours). File stays in product:media (mediaId plain text).
 * social.sweep sets expiredAt when now >= expiresAt; listing hides expired rows.
 * Hero extras stay in extensions.
 */
export const sfSocialStories = pgTable(
  'sf_social_stories',
  {
    id: text('id').primaryKey(),
    authorUserId: text('author_user_id').notNull(),
    /** Plain text media id — no FK to sf_media_*. Bytes stay in Media. */
    mediaId: text('media_id').notNull(),
    /** Snapshot at create (image/* or video/*). */
    mimeType: text('mime_type'),
    /** createdAt + 24h — hard stop for visibility. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set by social.sweep when now >= expiresAt. Null = not yet swept. */
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    /** Hero / vertical extras — not new columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_stories_author_idx').on(table.authorUserId),
    index('sf_social_stories_expires_idx').on(table.expiresAt),
    index('sf_social_stories_expired_idx').on(table.expiredAt),
    index('sf_social_stories_media_idx').on(table.mediaId),
  ],
)

/**
 * Story view. Unique (userId, storyId) — second view updates that row.
 * Author viewer list filters with canInteract (blocked viewers omitted).
 */
export const sfSocialStoryViews = pgTable(
  'sf_social_story_views',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_story_views_user_story_uidx').on(table.userId, table.storyId),
    index('sf_social_story_views_story_idx').on(table.storyId),
    index('sf_social_story_views_user_idx').on(table.userId),
  ],
)

/**
 * Named album on a member (user), group, or page.
 * Files stay in product:media — coverMediaId / item mediaId are plain text binds.
 * A multi-image post is not required to be an album.
 */
export const sfSocialAlbums = pgTable(
  'sf_social_albums',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** user | group | page */
    ownerType: text('owner_type').notNull(),
    /** userId | groupId | pageId matching ownerType. */
    ownerId: text('owner_id').notNull(),
    /** Optional cover bind — bytes stay in Media. */
    coverMediaId: text('cover_media_id'),
    createdByUserId: text('created_by_user_id').notNull(),
    /** Hero / vertical extras — not new columns. */
    extensions: jsonb('extensions').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_social_albums_owner_idx').on(table.ownerType, table.ownerId),
    index('sf_social_albums_created_by_idx').on(table.createdByUserId),
    index('sf_social_albums_cover_media_idx').on(table.coverMediaId),
  ],
)

/**
 * Media item in an album. Unique (albumId, mediaId) — second add updates that row.
 * File stays in product:media.
 */
export const sfSocialAlbumItems = pgTable(
  'sf_social_album_items',
  {
    id: text('id').primaryKey(),
    albumId: text('album_id').notNull(),
    /** Plain text media id — no FK to sf_media_*. */
    mediaId: text('media_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    addedByUserId: text('added_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_album_items_album_media_uidx').on(table.albumId, table.mediaId),
    index('sf_social_album_items_album_idx').on(table.albumId),
    index('sf_social_album_items_media_idx').on(table.mediaId),
    index('sf_social_album_items_added_by_idx').on(table.addedByUserId),
  ],
)

/**
 * Directed follow edge. Unique (followerUserId, followeeUserId) — one row per pair.
 * A second follow updates that row. User ids are plain text (no FK to auth).
 */
export const sfSocialFollows = pgTable(
  'sf_social_follows',
  {
    id: text('id').primaryKey(),
    followerUserId: text('follower_user_id').notNull(),
    followeeUserId: text('followee_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_follows_pair_uidx').on(
      table.followerUserId,
      table.followeeUserId,
    ),
    index('sf_social_follows_follower_idx').on(table.followerUserId),
    index('sf_social_follows_followee_idx').on(table.followeeUserId),
  ],
)

/**
 * Saved post bookmark. Unique (userId, postId) — second save updates that row.
 * /feed/saved lists rows the viewer may still canViewPost.
 */
export const sfSocialSaves = pgTable(
  'sf_social_saves',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    postId: text('post_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_saves_user_post_uidx').on(table.userId, table.postId),
    index('sf_social_saves_user_idx').on(table.userId),
    index('sf_social_saves_post_idx').on(table.postId),
  ],
)

/**
 * Hashtag on a post. Unique (postId, tag). Tags do not fork Media tags.
 * /feed/tag/[tag] queries this, then canViewPost.
 */
export const sfSocialPostTags = pgTable(
  'sf_social_post_tags',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    /** Normalized lowercase tag without leading #. */
    tag: text('tag').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_post_tags_post_tag_uidx').on(table.postId, table.tag),
    index('sf_social_post_tags_tag_idx').on(table.tag),
    index('sf_social_post_tags_post_idx').on(table.postId),
  ],
)

/**
 * @mention on a post. Unique (postId, mentionedUserId).
 * Notify uses canInteract — blocked members are not notified.
 */
export const sfSocialMentions = pgTable(
  'sf_social_mentions',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    mentionedUserId: text('mentioned_user_id').notNull(),
    /** Handle snapshot at write time. */
    handle: text('handle').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_mentions_post_user_uidx').on(
      table.postId,
      table.mentionedUserId,
    ),
    index('sf_social_mentions_mentioned_idx').on(table.mentionedUserId),
    index('sf_social_mentions_post_idx').on(table.postId),
  ],
)

/**
 * Poll vote. Unique (postId, userId) — one vote per person; second vote updates optionId.
 * Not a reaction row. Changeable until the author closes the poll.
 */
export const sfSocialPollVotes = pgTable(
  'sf_social_poll_votes',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    /** Option id from the post’s pollOptions list. */
    optionId: text('option_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_social_poll_votes_post_user_uidx').on(table.postId, table.userId),
    index('sf_social_poll_votes_post_idx').on(table.postId),
    index('sf_social_poll_votes_user_idx').on(table.userId),
    index('sf_social_poll_votes_option_idx').on(table.optionId),
  ],
)
