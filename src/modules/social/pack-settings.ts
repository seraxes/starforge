/**
 * product:social pack settings — one document in `sf_module_settings`.
 *
 * Composer and feed (slice 15b): default audience, guest public read, feed page
 * size, composer/feature switches, activity cards, comment length, member write
 * rate limit, hold-for-review.
 * People / reactions / reports (slice 15c): friend requests, follow, ban list
 * surfaces, reaction catalog + comment/story toggles, report reasons, auto-hide,
 * word list, friend-list visibility. Groups / pages (slice 15d): creation rules,
 * categories live in `sf_social_group_categories`, verified lists, feature
 * switches. Stories / albums / media / challenge (slice 15e): lifetime, album cap,
 * images-per-post, video toggle, challenge windows and length, premium invite cap.
 *
 * Save refuses an unknown audience (`invalid_audience`). Load coerces a bad
 * stored value back to the default so the admin page still opens.
 */

import {
  CHALLENGE_LENGTH_DAYS_MAX,
  CHALLENGE_LENGTH_DAYS_MIN,
} from './challenge'
import { isPostAudience, POST_AUDIENCES, POST_MEDIA_IMAGE_MAX, type PostAudience, type PostKind } from './posts'
import {
  normalizeEnabledReactionKinds,
  type ReactionKind,
} from './reactions'
import { isReportReason, REPORT_REASONS, type ReportReason } from './reports'

export const FRIEND_LIST_VISIBILITIES = ['friends', 'only_me'] as const
export type FriendListVisibility = (typeof FRIEND_LIST_VISIBILITIES)[number]

export const SOCIAL_ACTIVITY_CARD_KINDS = ['event.published', 'page.published'] as const
export type SocialActivityCardKind = (typeof SOCIAL_ACTIVITY_CARD_KINDS)[number]

export const SOCIAL_STORY_LIFETIME_HOURS_DEFAULT = 24
export const SOCIAL_STORY_LIFETIME_HOURS_MIN = 1
export const SOCIAL_STORY_LIFETIME_HOURS_MAX = 48

export const SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT = 10
export const SOCIAL_MULTI_CHALLENGE_CAP_MIN = 1
export const SOCIAL_MULTI_CHALLENGE_CAP_MAX = 100

export const SOCIAL_FEED_PAGE_SIZE_DEFAULT = 50
export const SOCIAL_FEED_PAGE_SIZE_MIN = 1
export const SOCIAL_FEED_PAGE_SIZE_MAX = 100

export const SOCIAL_COMMENT_LENGTH_LIMIT_DEFAULT = 5000
export const SOCIAL_COMMENT_LENGTH_LIMIT_MIN = 1
export const SOCIAL_COMMENT_LENGTH_LIMIT_MAX = 20000

/** Member write flood bucket (posts, comments, reactions, requests, …). */
export const SOCIAL_WRITE_RATE_LIMIT_MAX_DEFAULT = 60
export const SOCIAL_WRITE_RATE_LIMIT_MAX_MIN = 1
export const SOCIAL_WRITE_RATE_LIMIT_MAX_MAX = 500
export const SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_DEFAULT = 60
export const SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MIN = 1
export const SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MAX = 3600

/** 0 = no pending-request cap. */
export const SOCIAL_MAX_PENDING_FRIEND_REQUESTS_DEFAULT = 50
export const SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MIN = 0
export const SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MAX = 500

/** 0 = auto-hide off. */
export const SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_DEFAULT = 0
export const SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MIN = 0
export const SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MAX = 100

/** Who may create a group or page from the member surface. */
export const SOCIAL_CREATOR_ROLES = ['members', 'staff'] as const
export type SocialCreatorRole = (typeof SOCIAL_CREATOR_ROLES)[number]

/** Default join rule for new groups (matches GroupVisibility). */
export const SOCIAL_GROUP_JOIN_RULES = ['open', 'closed'] as const
export type SocialGroupJoinRule = (typeof SOCIAL_GROUP_JOIN_RULES)[number]

/** 0 = no member cap. */
export const SOCIAL_MAX_GROUP_MEMBERS_DEFAULT = 0
export const SOCIAL_MAX_GROUP_MEMBERS_MIN = 0
export const SOCIAL_MAX_GROUP_MEMBERS_MAX = 100_000

/** Max media items in one album (slice 15e). */
export const SOCIAL_MAX_ALBUM_ITEMS_DEFAULT = 50
export const SOCIAL_MAX_ALBUM_ITEMS_MIN = 1
export const SOCIAL_MAX_ALBUM_ITEMS_MAX = 500

/** Max images on one post (slice 15e). Hard ceiling matches POST_MEDIA_IMAGE_MAX. */
export const SOCIAL_MAX_IMAGES_PER_POST_DEFAULT = POST_MEDIA_IMAGE_MAX
export const SOCIAL_MAX_IMAGES_PER_POST_MIN = 1
export const SOCIAL_MAX_IMAGES_PER_POST_MAX = POST_MEDIA_IMAGE_MAX

/** Feed photo box. Taller images are cut at the center. */
export const SOCIAL_FEED_IMAGE_MAX_WIDTH_DEFAULT = 720
export const SOCIAL_FEED_IMAGE_MAX_WIDTH_MIN = 240
export const SOCIAL_FEED_IMAGE_MAX_WIDTH_MAX = 1600
export const SOCIAL_FEED_IMAGE_MAX_HEIGHT_DEFAULT = 540
export const SOCIAL_FEED_IMAGE_MAX_HEIGHT_MIN = 180
export const SOCIAL_FEED_IMAGE_MAX_HEIGHT_MAX = 1200

export const SOCIAL_CHALLENGE_MIN_LENGTH_DAYS_DEFAULT = CHALLENGE_LENGTH_DAYS_MIN
export const SOCIAL_CHALLENGE_MAX_LENGTH_DAYS_DEFAULT = CHALLENGE_LENGTH_DAYS_MAX

/** Composer post kinds that have an Admin switch (activity is system-only). */
export const COMPOSER_POST_KIND_SWITCHES = [
  'text',
  'media',
  'link',
  'share',
  'poll',
  'checkin',
  'challenge',
] as const
export type ComposerPostKindSwitch = (typeof COMPOSER_POST_KIND_SWITCHES)[number]

export const SOCIAL_PACK_DISABLED_NOTICE =
  'Social is disabled. Turn it on under Settings → Modules to edit pack settings.'

export type SocialModuleSettings = {
  defaultPostAudience: PostAudience
  friendListVisibility: FriendListVisibility
  storyLifetimeHours: number
  multiChallengeCap: number
  activityEventPublished: boolean
  activityPagePublished: boolean
  enabledReactionKinds: ReactionKind[]
  /** Guests (no viewer) may read audience=public posts. */
  guestCanReadPublic: boolean
  feedPageSize: number
  allowText: boolean
  allowMedia: boolean
  allowLink: boolean
  allowShare: boolean
  allowPoll: boolean
  allowCheckin: boolean
  allowChallenge: boolean
  allowMentions: boolean
  allowHashtags: boolean
  allowComments: boolean
  allowDiscover: boolean
  allowFollowingTab: boolean
  allowShortVideoLayout: boolean
  commentLengthLimit: number
  /** Max Social member writes per window (shared bucket). */
  writeRateLimitMax: number
  /** Window seconds for {@link writeRateLimitMax}. */
  writeRateLimitWindowSec: number
  /** When on, new posts start staff-hidden until review. Default off. */
  holdNewPostsForReview: boolean
  /** Slice 15c — people / reactions / reports. */
  allowFriendRequests: boolean
  maxPendingFriendRequests: number
  allowFollow: boolean
  allowReactionsOnComments: boolean
  allowReactionsOnStories: boolean
  enabledReportReasons: ReportReason[]
  autoHideOpenReportThreshold: number
  blockedWords: string[]
  /** Slice 15d — groups / pages. */
  allowGroups: boolean
  groupWhoCanCreate: SocialCreatorRole
  groupsNeedApproval: boolean
  defaultGroupJoinRule: SocialGroupJoinRule
  maxGroupMembers: number
  allowGroupDocuments: boolean
  allowGroupAnnouncements: boolean
  allowGroupJoinForm: boolean
  allowPages: boolean
  pageWhoCanCreate: SocialCreatorRole
  pagesNeedApproval: boolean
  allowPageLikes: boolean
  /** Slice 15e — stories / albums / media / challenge. */
  allowStories: boolean
  allowAlbums: boolean
  maxAlbumItems: number
  maxImagesPerPost: number
  /** Pixel cap for a feed photo. The center is kept; the rest is cut. */
  feedImageMaxWidthPx: number
  feedImageMaxHeightPx: number
  allowPostVideo: boolean
  allowChallengeWindow24: boolean
  allowChallengeWindow48: boolean
  challengeMinLengthDays: number
  challengeMaxLengthDays: number
}

export const DEFAULT_SOCIAL_MODULE_SETTINGS: SocialModuleSettings = {
  defaultPostAudience: 'friends',
  friendListVisibility: 'friends',
  storyLifetimeHours: SOCIAL_STORY_LIFETIME_HOURS_DEFAULT,
  multiChallengeCap: SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT,
  activityEventPublished: true,
  activityPagePublished: true,
  enabledReactionKinds: ['like'],
  guestCanReadPublic: true,
  feedPageSize: SOCIAL_FEED_PAGE_SIZE_DEFAULT,
  allowText: true,
  allowMedia: true,
  allowLink: true,
  allowShare: true,
  allowPoll: true,
  allowCheckin: true,
  allowChallenge: true,
  allowMentions: true,
  allowHashtags: true,
  allowComments: true,
  allowDiscover: true,
  allowFollowingTab: true,
  allowShortVideoLayout: true,
  commentLengthLimit: SOCIAL_COMMENT_LENGTH_LIMIT_DEFAULT,
  writeRateLimitMax: SOCIAL_WRITE_RATE_LIMIT_MAX_DEFAULT,
  writeRateLimitWindowSec: SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_DEFAULT,
  holdNewPostsForReview: false,
  allowFriendRequests: true,
  maxPendingFriendRequests: SOCIAL_MAX_PENDING_FRIEND_REQUESTS_DEFAULT,
  allowFollow: true,
  allowReactionsOnComments: true,
  allowReactionsOnStories: false,
  enabledReportReasons: [...REPORT_REASONS],
  autoHideOpenReportThreshold: SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_DEFAULT,
  blockedWords: [],
  allowGroups: true,
  groupWhoCanCreate: 'members',
  groupsNeedApproval: false,
  defaultGroupJoinRule: 'open',
  maxGroupMembers: SOCIAL_MAX_GROUP_MEMBERS_DEFAULT,
  allowGroupDocuments: true,
  allowGroupAnnouncements: true,
  allowGroupJoinForm: true,
  allowPages: true,
  pageWhoCanCreate: 'members',
  pagesNeedApproval: false,
  allowPageLikes: true,
  allowStories: true,
  allowAlbums: true,
  maxAlbumItems: SOCIAL_MAX_ALBUM_ITEMS_DEFAULT,
  maxImagesPerPost: SOCIAL_MAX_IMAGES_PER_POST_DEFAULT,
  feedImageMaxWidthPx: SOCIAL_FEED_IMAGE_MAX_WIDTH_DEFAULT,
  feedImageMaxHeightPx: SOCIAL_FEED_IMAGE_MAX_HEIGHT_DEFAULT,
  allowPostVideo: true,
  allowChallengeWindow24: true,
  allowChallengeWindow48: true,
  challengeMinLengthDays: SOCIAL_CHALLENGE_MIN_LENGTH_DAYS_DEFAULT,
  challengeMaxLengthDays: SOCIAL_CHALLENGE_MAX_LENGTH_DAYS_DEFAULT,
}

export type SocialPackSettingsRefuseReason =
  | 'invalid_audience'
  | 'invalid_friend_list_visibility'
  | 'invalid_story_lifetime'
  | 'invalid_multi_cap'
  | 'invalid_feed_page_size'
  | 'invalid_comment_length'
  | 'invalid_write_rate_limit'
  | 'invalid_max_pending'
  | 'invalid_auto_hide_threshold'
  | 'invalid_group_creator'
  | 'invalid_page_creator'
  | 'invalid_group_join_rule'
  | 'invalid_max_group_members'
  | 'invalid_max_album_items'
  | 'invalid_max_images_per_post'
  | 'invalid_feed_image_size'
  | 'invalid_challenge_length'

export type SocialPackSettingsDecision =
  | { ok: true; settings: SocialModuleSettings }
  | { ok: false; reason: SocialPackSettingsRefuseReason }

export type SocialPackAdminPage =
  | { mode: 'disabled-notice'; notice: string }
  | { mode: 'pack' }

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

function readChoice<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
  mode: 'coerce' | 'strict',
): T | 'invalid' {
  if (raw == null) return fallback
  const value = String(raw).trim()
  if (!value) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  return mode === 'strict' ? 'invalid' : fallback
}

function readBoundedInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
  mode: 'coerce' | 'strict',
): number | 'invalid' {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isInteger(n) || n < min || n > max) {
    return mode === 'strict' ? 'invalid' : fallback
  }
  return n
}

function readFlag(raw: unknown, fallback: boolean): boolean {
  if (raw === true || raw === 1 || raw === '1' || raw === 'true' || raw === 'on') return true
  if (raw === false || raw === 0 || raw === '0' || raw === 'false' || raw === 'off') return false
  return fallback
}

function readSettings(
  raw: unknown,
  mode: 'coerce' | 'strict',
): SocialModuleSettings | SocialPackSettingsRefuseReason {
  const obj = asRecord(raw)
  const audience = readChoice(
    obj.defaultPostAudience,
    POST_AUDIENCES,
    DEFAULT_SOCIAL_MODULE_SETTINGS.defaultPostAudience,
    mode,
  )
  if (audience === 'invalid') return 'invalid_audience'

  const friendList = readChoice(
    obj.friendListVisibility,
    FRIEND_LIST_VISIBILITIES,
    DEFAULT_SOCIAL_MODULE_SETTINGS.friendListVisibility,
    mode,
  )
  if (friendList === 'invalid') return 'invalid_friend_list_visibility'

  const storyLifetimeHours = readBoundedInt(
    obj.storyLifetimeHours,
    DEFAULT_SOCIAL_MODULE_SETTINGS.storyLifetimeHours,
    SOCIAL_STORY_LIFETIME_HOURS_MIN,
    SOCIAL_STORY_LIFETIME_HOURS_MAX,
    mode,
  )
  if (storyLifetimeHours === 'invalid') return 'invalid_story_lifetime'

  const multiChallengeCap = readBoundedInt(
    obj.multiChallengeCap,
    DEFAULT_SOCIAL_MODULE_SETTINGS.multiChallengeCap,
    SOCIAL_MULTI_CHALLENGE_CAP_MIN,
    SOCIAL_MULTI_CHALLENGE_CAP_MAX,
    mode,
  )
  if (multiChallengeCap === 'invalid') return 'invalid_multi_cap'

  const feedPageSize = readBoundedInt(
    obj.feedPageSize,
    DEFAULT_SOCIAL_MODULE_SETTINGS.feedPageSize,
    SOCIAL_FEED_PAGE_SIZE_MIN,
    SOCIAL_FEED_PAGE_SIZE_MAX,
    mode,
  )
  if (feedPageSize === 'invalid') return 'invalid_feed_page_size'

  const commentLengthLimit = readBoundedInt(
    obj.commentLengthLimit,
    DEFAULT_SOCIAL_MODULE_SETTINGS.commentLengthLimit,
    SOCIAL_COMMENT_LENGTH_LIMIT_MIN,
    SOCIAL_COMMENT_LENGTH_LIMIT_MAX,
    mode,
  )
  if (commentLengthLimit === 'invalid') return 'invalid_comment_length'

  const writeRateLimitMax = readBoundedInt(
    obj.writeRateLimitMax,
    DEFAULT_SOCIAL_MODULE_SETTINGS.writeRateLimitMax,
    SOCIAL_WRITE_RATE_LIMIT_MAX_MIN,
    SOCIAL_WRITE_RATE_LIMIT_MAX_MAX,
    mode,
  )
  if (writeRateLimitMax === 'invalid') return 'invalid_write_rate_limit'

  const writeRateLimitWindowSec = readBoundedInt(
    obj.writeRateLimitWindowSec,
    DEFAULT_SOCIAL_MODULE_SETTINGS.writeRateLimitWindowSec,
    SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MIN,
    SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MAX,
    mode,
  )
  if (writeRateLimitWindowSec === 'invalid') return 'invalid_write_rate_limit'

  const maxPendingFriendRequests = readBoundedInt(
    obj.maxPendingFriendRequests,
    DEFAULT_SOCIAL_MODULE_SETTINGS.maxPendingFriendRequests,
    SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MIN,
    SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MAX,
    mode,
  )
  if (maxPendingFriendRequests === 'invalid') return 'invalid_max_pending'

  const autoHideOpenReportThreshold = readBoundedInt(
    obj.autoHideOpenReportThreshold,
    DEFAULT_SOCIAL_MODULE_SETTINGS.autoHideOpenReportThreshold,
    SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MIN,
    SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MAX,
    mode,
  )
  if (autoHideOpenReportThreshold === 'invalid') return 'invalid_auto_hide_threshold'

  const groupWhoCanCreate = readChoice(
    obj.groupWhoCanCreate,
    SOCIAL_CREATOR_ROLES,
    DEFAULT_SOCIAL_MODULE_SETTINGS.groupWhoCanCreate,
    mode,
  )
  if (groupWhoCanCreate === 'invalid') return 'invalid_group_creator'

  const pageWhoCanCreate = readChoice(
    obj.pageWhoCanCreate,
    SOCIAL_CREATOR_ROLES,
    DEFAULT_SOCIAL_MODULE_SETTINGS.pageWhoCanCreate,
    mode,
  )
  if (pageWhoCanCreate === 'invalid') return 'invalid_page_creator'

  const defaultGroupJoinRule = readChoice(
    obj.defaultGroupJoinRule,
    SOCIAL_GROUP_JOIN_RULES,
    DEFAULT_SOCIAL_MODULE_SETTINGS.defaultGroupJoinRule,
    mode,
  )
  if (defaultGroupJoinRule === 'invalid') return 'invalid_group_join_rule'

  const maxGroupMembers = readBoundedInt(
    obj.maxGroupMembers,
    DEFAULT_SOCIAL_MODULE_SETTINGS.maxGroupMembers,
    SOCIAL_MAX_GROUP_MEMBERS_MIN,
    SOCIAL_MAX_GROUP_MEMBERS_MAX,
    mode,
  )
  if (maxGroupMembers === 'invalid') return 'invalid_max_group_members'

  const maxAlbumItems = readBoundedInt(
    obj.maxAlbumItems,
    DEFAULT_SOCIAL_MODULE_SETTINGS.maxAlbumItems,
    SOCIAL_MAX_ALBUM_ITEMS_MIN,
    SOCIAL_MAX_ALBUM_ITEMS_MAX,
    mode,
  )
  if (maxAlbumItems === 'invalid') return 'invalid_max_album_items'

  const maxImagesPerPost = readBoundedInt(
    obj.maxImagesPerPost,
    DEFAULT_SOCIAL_MODULE_SETTINGS.maxImagesPerPost,
    SOCIAL_MAX_IMAGES_PER_POST_MIN,
    SOCIAL_MAX_IMAGES_PER_POST_MAX,
    mode,
  )
  if (maxImagesPerPost === 'invalid') return 'invalid_max_images_per_post'

  const feedImageMaxWidthPx = readBoundedInt(
    obj.feedImageMaxWidthPx,
    DEFAULT_SOCIAL_MODULE_SETTINGS.feedImageMaxWidthPx,
    SOCIAL_FEED_IMAGE_MAX_WIDTH_MIN,
    SOCIAL_FEED_IMAGE_MAX_WIDTH_MAX,
    mode,
  )
  if (feedImageMaxWidthPx === 'invalid') return 'invalid_feed_image_size'

  const feedImageMaxHeightPx = readBoundedInt(
    obj.feedImageMaxHeightPx,
    DEFAULT_SOCIAL_MODULE_SETTINGS.feedImageMaxHeightPx,
    SOCIAL_FEED_IMAGE_MAX_HEIGHT_MIN,
    SOCIAL_FEED_IMAGE_MAX_HEIGHT_MAX,
    mode,
  )
  if (feedImageMaxHeightPx === 'invalid') return 'invalid_feed_image_size'

  let challengeMinLengthDays = readBoundedInt(
    obj.challengeMinLengthDays,
    DEFAULT_SOCIAL_MODULE_SETTINGS.challengeMinLengthDays,
    CHALLENGE_LENGTH_DAYS_MIN,
    CHALLENGE_LENGTH_DAYS_MAX,
    mode,
  )
  if (challengeMinLengthDays === 'invalid') return 'invalid_challenge_length'

  let challengeMaxLengthDays = readBoundedInt(
    obj.challengeMaxLengthDays,
    DEFAULT_SOCIAL_MODULE_SETTINGS.challengeMaxLengthDays,
    CHALLENGE_LENGTH_DAYS_MIN,
    CHALLENGE_LENGTH_DAYS_MAX,
    mode,
  )
  if (challengeMaxLengthDays === 'invalid') return 'invalid_challenge_length'

  if (challengeMinLengthDays > challengeMaxLengthDays) {
    if (mode === 'strict') return 'invalid_challenge_length'
    challengeMinLengthDays = DEFAULT_SOCIAL_MODULE_SETTINGS.challengeMinLengthDays
    challengeMaxLengthDays = DEFAULT_SOCIAL_MODULE_SETTINGS.challengeMaxLengthDays
  }

  return {
    defaultPostAudience: audience,
    friendListVisibility: friendList,
    storyLifetimeHours,
    multiChallengeCap,
    activityEventPublished: readFlag(
      obj.activityEventPublished,
      DEFAULT_SOCIAL_MODULE_SETTINGS.activityEventPublished,
    ),
    activityPagePublished: readFlag(
      obj.activityPagePublished,
      DEFAULT_SOCIAL_MODULE_SETTINGS.activityPagePublished,
    ),
    enabledReactionKinds: normalizeEnabledReactionKinds(obj.enabledReactionKinds),
    guestCanReadPublic: readFlag(
      obj.guestCanReadPublic,
      DEFAULT_SOCIAL_MODULE_SETTINGS.guestCanReadPublic,
    ),
    feedPageSize,
    allowText: readFlag(obj.allowText, DEFAULT_SOCIAL_MODULE_SETTINGS.allowText),
    allowMedia: readFlag(obj.allowMedia, DEFAULT_SOCIAL_MODULE_SETTINGS.allowMedia),
    allowLink: readFlag(obj.allowLink, DEFAULT_SOCIAL_MODULE_SETTINGS.allowLink),
    allowShare: readFlag(obj.allowShare, DEFAULT_SOCIAL_MODULE_SETTINGS.allowShare),
    allowPoll: readFlag(obj.allowPoll, DEFAULT_SOCIAL_MODULE_SETTINGS.allowPoll),
    allowCheckin: readFlag(obj.allowCheckin, DEFAULT_SOCIAL_MODULE_SETTINGS.allowCheckin),
    allowChallenge: readFlag(obj.allowChallenge, DEFAULT_SOCIAL_MODULE_SETTINGS.allowChallenge),
    allowMentions: readFlag(obj.allowMentions, DEFAULT_SOCIAL_MODULE_SETTINGS.allowMentions),
    allowHashtags: readFlag(obj.allowHashtags, DEFAULT_SOCIAL_MODULE_SETTINGS.allowHashtags),
    allowComments: readFlag(obj.allowComments, DEFAULT_SOCIAL_MODULE_SETTINGS.allowComments),
    allowDiscover: readFlag(obj.allowDiscover, DEFAULT_SOCIAL_MODULE_SETTINGS.allowDiscover),
    allowFollowingTab: readFlag(
      obj.allowFollowingTab,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowFollowingTab,
    ),
    allowShortVideoLayout: readFlag(
      obj.allowShortVideoLayout,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowShortVideoLayout,
    ),
    commentLengthLimit,
    writeRateLimitMax,
    writeRateLimitWindowSec,
    holdNewPostsForReview: readFlag(
      obj.holdNewPostsForReview,
      DEFAULT_SOCIAL_MODULE_SETTINGS.holdNewPostsForReview,
    ),
    allowFriendRequests: readFlag(
      obj.allowFriendRequests,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowFriendRequests,
    ),
    maxPendingFriendRequests,
    allowFollow: readFlag(obj.allowFollow, DEFAULT_SOCIAL_MODULE_SETTINGS.allowFollow),
    allowReactionsOnComments: readFlag(
      obj.allowReactionsOnComments,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowReactionsOnComments,
    ),
    allowReactionsOnStories: readFlag(
      obj.allowReactionsOnStories,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowReactionsOnStories,
    ),
    enabledReportReasons: normalizeEnabledReportReasons(obj.enabledReportReasons),
    autoHideOpenReportThreshold,
    blockedWords: normalizeBlockedWords(obj.blockedWords),
    allowGroups: readFlag(obj.allowGroups, DEFAULT_SOCIAL_MODULE_SETTINGS.allowGroups),
    groupWhoCanCreate,
    groupsNeedApproval: readFlag(
      obj.groupsNeedApproval,
      DEFAULT_SOCIAL_MODULE_SETTINGS.groupsNeedApproval,
    ),
    defaultGroupJoinRule,
    maxGroupMembers,
    allowGroupDocuments: readFlag(
      obj.allowGroupDocuments,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowGroupDocuments,
    ),
    allowGroupAnnouncements: readFlag(
      obj.allowGroupAnnouncements,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowGroupAnnouncements,
    ),
    allowGroupJoinForm: readFlag(
      obj.allowGroupJoinForm,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowGroupJoinForm,
    ),
    allowPages: readFlag(obj.allowPages, DEFAULT_SOCIAL_MODULE_SETTINGS.allowPages),
    pageWhoCanCreate,
    pagesNeedApproval: readFlag(
      obj.pagesNeedApproval,
      DEFAULT_SOCIAL_MODULE_SETTINGS.pagesNeedApproval,
    ),
    allowPageLikes: readFlag(
      obj.allowPageLikes,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowPageLikes,
    ),
    allowStories: readFlag(obj.allowStories, DEFAULT_SOCIAL_MODULE_SETTINGS.allowStories),
    allowAlbums: readFlag(obj.allowAlbums, DEFAULT_SOCIAL_MODULE_SETTINGS.allowAlbums),
    maxAlbumItems,
    maxImagesPerPost,
    feedImageMaxWidthPx,
    feedImageMaxHeightPx,
    allowPostVideo: readFlag(
      obj.allowPostVideo,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowPostVideo,
    ),
    allowChallengeWindow24: readFlag(
      obj.allowChallengeWindow24,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowChallengeWindow24,
    ),
    allowChallengeWindow48: readFlag(
      obj.allowChallengeWindow48,
      DEFAULT_SOCIAL_MODULE_SETTINGS.allowChallengeWindow48,
    ),
    challengeMinLengthDays,
    challengeMaxLengthDays,
  }
}

/** Load path. Unknown audience becomes `friends`. */
export function normalizeSocialModuleSettings(raw: unknown): SocialModuleSettings {
  const read = readSettings(raw, 'coerce')
  if (typeof read === 'string') return { ...DEFAULT_SOCIAL_MODULE_SETTINGS }
  return read
}

/**
 * Save path. An unknown post audience is refused (`invalid_audience`).
 * A blank audience keeps the default `friends`.
 */
export function decideSocialPackSettings(raw: unknown): SocialPackSettingsDecision {
  const read = readSettings(raw, 'strict')
  if (typeof read === 'string') return { ok: false, reason: read }
  if (!isPostAudience(read.defaultPostAudience)) {
    return { ok: false, reason: 'invalid_audience' }
  }
  return { ok: true, settings: read }
}

export function socialPackSettingsError(reason: SocialPackSettingsRefuseReason): string {
  switch (reason) {
    case 'invalid_audience':
      return 'Unknown post audience.'
    case 'invalid_friend_list_visibility':
      return 'Friend-list visibility must be friends or only me.'
    case 'invalid_story_lifetime':
      return 'Story lifetime hours must be a whole number from 1 to 48.'
    case 'invalid_multi_cap':
      return 'Multi-challenge cap must be a whole number from 1 to 100.'
    case 'invalid_feed_page_size':
      return 'Feed page size must be a whole number from 1 to 100.'
    case 'invalid_comment_length':
      return 'Comment length limit must be a whole number from 1 to 20000.'
    case 'invalid_write_rate_limit':
      return `Write rate limit must be a whole number from ${SOCIAL_WRITE_RATE_LIMIT_MAX_MIN} to ${SOCIAL_WRITE_RATE_LIMIT_MAX_MAX} actions per ${SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MIN}–${SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MAX} seconds.`
    case 'invalid_max_pending':
      return 'Max pending friend requests must be a whole number from 0 to 500.'
    case 'invalid_auto_hide_threshold':
      return 'Auto-hide open-report threshold must be a whole number from 0 to 100.'
    case 'invalid_group_creator':
      return 'Group creators must be members or staff.'
    case 'invalid_page_creator':
      return 'Page creators must be members or staff.'
    case 'invalid_group_join_rule':
      return 'Default group join rule must be open or closed.'
    case 'invalid_max_group_members':
      return 'Max group members must be a whole number from 0 to 100000.'
    case 'invalid_max_album_items':
      return 'Max album items must be a whole number from 1 to 500.'
    case 'invalid_max_images_per_post':
      return `Max images per post must be a whole number from 1 to ${SOCIAL_MAX_IMAGES_PER_POST_MAX}.`
    case 'invalid_feed_image_size':
      return `Feed image size must be a whole number from ${SOCIAL_FEED_IMAGE_MAX_WIDTH_MIN} to ${SOCIAL_FEED_IMAGE_MAX_WIDTH_MAX} wide and ${SOCIAL_FEED_IMAGE_MAX_HEIGHT_MIN} to ${SOCIAL_FEED_IMAGE_MAX_HEIGHT_MAX} tall.`
    case 'invalid_challenge_length':
      return `Challenge length days must be whole numbers from ${CHALLENGE_LENGTH_DAYS_MIN} to ${CHALLENGE_LENGTH_DAYS_MAX}, with min ≤ max.`
  }
}

/**
 * Catalog report reasons kept for the pack. Empty / missing → all catalog reasons.
 * Unknown strings are dropped. Order follows REPORT_REASONS.
 */
export function normalizeEnabledReportReasons(raw: unknown): ReportReason[] {
  const list = Array.isArray(raw)
    ? raw.map((value) => String(value ?? '').trim()).filter(Boolean)
    : typeof raw === 'string'
      ? raw
          .split(/[\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  if (list.length === 0) return [...REPORT_REASONS]
  const seen = new Set<string>()
  const out: ReportReason[] = []
  for (const reason of REPORT_REASONS) {
    if (!list.includes(reason) || seen.has(reason)) continue
    seen.add(reason)
    out.push(reason)
  }
  return out.length > 0 ? out : [...REPORT_REASONS]
}

/** Trim, lowercase, dedupe blocked words. Empty entries dropped. */
export function normalizeBlockedWords(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((value) => String(value ?? ''))
    : typeof raw === 'string'
      ? raw.split(/[\n,]+/)
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of list) {
    const word = entry.trim().toLowerCase()
    if (!word || seen.has(word)) continue
    seen.add(word)
    out.push(word)
  }
  return out
}

/** Case-insensitive substring match against the blocked-word list. */
export function bodyContainsBlockedWord(
  body: string,
  words: readonly string[],
): boolean {
  if (!words.length) return false
  const hay = body.toLowerCase()
  for (const word of words) {
    const needle = word.trim().toLowerCase()
    if (needle && hay.includes(needle)) return true
  }
  return false
}

/** True when open-report count reaches the threshold (0 = off). */
export function shouldAutoHideFromOpenReports(
  openCount: number,
  threshold: number,
): boolean {
  if (!Number.isInteger(threshold) || threshold <= 0) return false
  if (!Number.isInteger(openCount) || openCount < 0) return false
  return openCount >= threshold
}

/** True when a report reason is enabled in pack settings. */
export function isReportReasonEnabled(
  reason: string,
  enabledReasons: readonly string[] = REPORT_REASONS,
): boolean {
  if (!isReportReason(reason)) return false
  return (enabledReasons as readonly string[]).includes(reason)
}

/**
 * Composer / feed form fields only (slice 15b).
 * Stories / albums / media / challenge windows save from `/admin/social/media`.
 */
export function socialComposerSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    defaultPostAudience: formData.get('defaultPostAudience'),
    activityEventPublished: formData.get('activityEventPublished') === '1',
    activityPagePublished: formData.get('activityPagePublished') === '1',
    guestCanReadPublic: formData.get('guestCanReadPublic') === '1',
    feedPageSize: formData.get('feedPageSize'),
    allowText: formData.get('allowText') === '1',
    allowMedia: formData.get('allowMedia') === '1',
    allowLink: formData.get('allowLink') === '1',
    allowShare: formData.get('allowShare') === '1',
    allowPoll: formData.get('allowPoll') === '1',
    allowCheckin: formData.get('allowCheckin') === '1',
    allowChallenge: formData.get('allowChallenge') === '1',
    allowMentions: formData.get('allowMentions') === '1',
    allowHashtags: formData.get('allowHashtags') === '1',
    allowComments: formData.get('allowComments') === '1',
    allowDiscover: formData.get('allowDiscover') === '1',
    allowFollowingTab: formData.get('allowFollowingTab') === '1',
    allowShortVideoLayout: formData.get('allowShortVideoLayout') === '1',
    commentLengthLimit: formData.get('commentLengthLimit'),
    writeRateLimitMax: formData.get('writeRateLimitMax'),
    writeRateLimitWindowSec: formData.get('writeRateLimitWindowSec'),
    holdNewPostsForReview: formData.get('holdNewPostsForReview') === '1',
  }
}

/** People / reactions / reports form fields (slice 15c). */
export function socialPeopleSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    friendListVisibility: formData.get('friendListVisibility'),
    enabledReactionKinds: formData.getAll('reactionKind').map((value) => String(value)),
    allowFriendRequests: formData.get('allowFriendRequests') === '1',
    maxPendingFriendRequests: formData.get('maxPendingFriendRequests'),
    allowFollow: formData.get('allowFollow') === '1',
    allowReactionsOnComments: formData.get('allowReactionsOnComments') === '1',
    allowReactionsOnStories: formData.get('allowReactionsOnStories') === '1',
    enabledReportReasons: formData.getAll('reportReason').map((value) => String(value)),
    autoHideOpenReportThreshold: formData.get('autoHideOpenReportThreshold'),
    blockedWords: String(formData.get('blockedWords') ?? ''),
  }
}

/** Groups pack form fields (slice 15d). Categories and verified list are separate actions. */
export function socialGroupsSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    allowGroups: formData.get('allowGroups') === '1',
    groupWhoCanCreate: formData.get('groupWhoCanCreate'),
    groupsNeedApproval: formData.get('groupsNeedApproval') === '1',
    defaultGroupJoinRule: formData.get('defaultGroupJoinRule'),
    maxGroupMembers: formData.get('maxGroupMembers'),
    allowGroupDocuments: formData.get('allowGroupDocuments') === '1',
    allowGroupAnnouncements: formData.get('allowGroupAnnouncements') === '1',
    allowGroupJoinForm: formData.get('allowGroupJoinForm') === '1',
  }
}

/** Pages pack form fields (slice 15d). Verified list is a separate action. */
export function socialPagesSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    allowPages: formData.get('allowPages') === '1',
    pageWhoCanCreate: formData.get('pageWhoCanCreate'),
    pagesNeedApproval: formData.get('pagesNeedApproval') === '1',
    allowPageLikes: formData.get('allowPageLikes') === '1',
  }
}

/** Stories / albums / media / challenge form fields (slice 15e). */
export function socialMediaSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    allowStories: formData.get('allowStories') === '1',
    storyLifetimeHours: formData.get('storyLifetimeHours'),
    allowAlbums: formData.get('allowAlbums') === '1',
    maxAlbumItems: formData.get('maxAlbumItems'),
    maxImagesPerPost: formData.get('maxImagesPerPost'),
    feedImageMaxWidthPx: formData.get('feedImageMaxWidthPx'),
    feedImageMaxHeightPx: formData.get('feedImageMaxHeightPx'),
    allowPostVideo: formData.get('allowPostVideo') === '1',
    allowChallenge: formData.get('allowChallenge') === '1',
    allowChallengeWindow24: formData.get('allowChallengeWindow24') === '1',
    allowChallengeWindow48: formData.get('allowChallengeWindow48') === '1',
    challengeMinLengthDays: formData.get('challengeMinLengthDays'),
    challengeMaxLengthDays: formData.get('challengeMaxLengthDays'),
    multiChallengeCap: formData.get('multiChallengeCap'),
  }
}

/**
 * Full-document FormData parser (tests / legacy). Prefer the composer / people /
 * groups / pages / media parsers and merge onto the loaded document when saving
 * one page.
 */
export function socialPackSettingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    ...socialComposerSettingsFromForm(formData),
    ...socialPeopleSettingsFromForm(formData),
    ...socialGroupsSettingsFromForm(formData),
    ...socialPagesSettingsFromForm(formData),
    ...socialMediaSettingsFromForm(formData),
  }
}

/**
 * True when the actor may create a group or page under the pack creator rule.
 * `members` allows any signed-in member; `staff` requires Social admin manage.
 */
export function actorMayCreateSocialEntity(
  whoCanCreate: SocialCreatorRole,
  actorIsStaff: boolean,
): boolean {
  if (whoCanCreate === 'members') return true
  return Boolean(actorIsStaff)
}

/** True when max members is set (> 0) and the next join would exceed it. */
export function isGroupAtMemberCap(
  activeMemberCount: number,
  maxGroupMembers: number,
): boolean {
  if (!Number.isInteger(maxGroupMembers) || maxGroupMembers <= 0) return false
  if (!Number.isInteger(activeMemberCount) || activeMemberCount < 0) return false
  return activeMemberCount >= maxGroupMembers
}

/**
 * Pack admin page. Social off → disabled notice and no settings editor.
 */
export function socialPackAdminPage(socialEnabled: boolean): SocialPackAdminPage {
  if (!socialEnabled) {
    return { mode: 'disabled-notice', notice: SOCIAL_PACK_DISABLED_NOTICE }
  }
  return { mode: 'pack' }
}

/** True when that activity card kind is switched on. Other kinds stay allowed. */
export function isActivityCardEnabled(
  activityKind: string,
  settings: SocialModuleSettings,
): boolean {
  const kind = activityKind.trim()
  if (kind === 'event.published') return settings.activityEventPublished
  if (kind === 'page.published') return settings.activityPagePublished
  return true
}

/**
 * Composer / challenge create gate. `activity` is system-published and stays on.
 * Unknown kinds are treated as allowed so older callers are not blocked.
 */
export function isComposerPostKindEnabled(
  kind: string,
  settings: Pick<
    SocialModuleSettings,
    | 'allowText'
    | 'allowMedia'
    | 'allowLink'
    | 'allowShare'
    | 'allowPoll'
    | 'allowCheckin'
    | 'allowChallenge'
  >,
): boolean {
  switch (kind.trim() as PostKind | string) {
    case 'text':
      return settings.allowText
    case 'media':
      return settings.allowMedia
    case 'link':
      return settings.allowLink
    case 'share':
      return settings.allowShare
    case 'poll':
      return settings.allowPoll
    case 'checkin':
      return settings.allowCheckin
    case 'challenge':
      return settings.allowChallenge
    default:
      return true
  }
}

/** Story row lifetime from the pack hours setting. */
export function storyLifetimeMs(hours: number): number {
  const n = Number.isInteger(hours) ? hours : SOCIAL_STORY_LIFETIME_HOURS_DEFAULT
  const bounded = Math.min(
    SOCIAL_STORY_LIFETIME_HOURS_MAX,
    Math.max(SOCIAL_STORY_LIFETIME_HOURS_MIN, n),
  )
  return bounded * 60 * 60 * 1000
}

/** True when the accept window hours are switched on in pack settings. */
export function isChallengeAcceptWindowAllowed(
  hours: number,
  settings: Pick<
    SocialModuleSettings,
    'allowChallengeWindow24' | 'allowChallengeWindow48'
  >,
): boolean {
  if (hours === 24) return settings.allowChallengeWindow24
  if (hours === 48) return settings.allowChallengeWindow48
  return false
}

/** True when lengthDays sits inside the pack min/max range. */
export function isChallengeLengthDaysAllowed(
  lengthDays: number,
  settings: Pick<
    SocialModuleSettings,
    'challengeMinLengthDays' | 'challengeMaxLengthDays'
  >,
): boolean {
  if (!Number.isInteger(lengthDays)) return false
  return (
    lengthDays >= settings.challengeMinLengthDays &&
    lengthDays <= settings.challengeMaxLengthDays
  )
}

/** True when the album already has maxAlbumItems distinct media binds. */
export function isAlbumAtItemCap(
  currentItemCount: number,
  maxAlbumItems: number,
): boolean {
  if (!Number.isInteger(maxAlbumItems) || maxAlbumItems <= 0) return false
  if (!Number.isInteger(currentItemCount) || currentItemCount < 0) return false
  return currentItemCount >= maxAlbumItems
}
