/**
 * product:social server door.
 *
 *   import { isSocialModuleEnabled, runSocialDoor } from '@/modules/social/api.server'
 *
 * When Social is off, `runSocialDoor` returns immediately (`reason: 'disabled'`).
 */

import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  exportOwnSocialRecordFromDb,
  hideOwnedSocialContentInDb,
  purgeOwnSocialRecordInDb,
} from './account-store'
import type {
  AccountExportPayload,
  AccountHideResult,
  AccountPurgeResult,
} from './account'
import { publishActivityInDb } from './activity-store'
import type {
  PublishActivityInput,
  PublishActivityResult,
} from './activity'
import type {
  CreateChallengeDecision,
  CreateChallengeInput,
  InviteChallengeDecision,
  ChallengeMultiGate,
} from './challenge'
import {
  SOCIAL_CHALLENGE_MULTI_ENTITLEMENT,
  inviteToChallengeWithMail,
} from './challenge'
import {
  createChallengeInDb,
  inviteToChallengeInDb,
} from './challenge-store'
import { emitChallengeInvitedEmail } from './email'
import type { CanInteractContext } from './interact'
import { runSocialDoor } from './door'

export { SOCIAL_MODULE_ID } from './ids'
export { runSocialDoor } from './door'
export type { SocialDoorResult } from './door'
export {
  FRIENDSHIP_STATUSES,
  areAcceptedFriends,
  friendshipPairKey,
  isBlockedBetween,
  isFriendshipStatus,
  isRecordedBlocker,
  requestFriendshipWithMail,
} from './friends'
export type {
  FriendshipMutationResult,
  FriendshipRecord,
  FriendshipRefuseReason,
  FriendshipStatus,
} from './friends'
export {
  acceptFriendship,
  areBlocked,
  areFriends,
  blockUser,
  cancelFriendship,
  declineFriendship,
  findFriendship,
  requestFriendship,
  requestFriendshipNotifying,
  unblockUser,
  unfriend,
} from './friends-store'
export {
  PEOPLE_SUGGESTION_LIMIT_DEFAULT,
  countMutualFriends,
  formatMutualFriendCount,
  isPeopleDirectoryCandidate,
  isPeopleSuggestionCandidate,
  selectPeopleDirectory,
  selectPeopleSuggestions,
} from './people'
export type {
  PeopleDirectoryCandidate,
  PeopleSuggestionCandidate,
} from './people'
export {
  countMutualFriendsBetween,
  listBlockedPeerIds,
  listIncomingFriendRequests,
  listPeopleDirectory,
  listPeopleSuggestions,
} from './people-store'
export type {
  IncomingFriendRequestItem,
  PeopleDirectoryItem,
  PeopleSuggestionItem,
} from './people-store'
export {
  SOCIAL_CHALLENGE_INVITED_TRIGGER,
  SOCIAL_FRIEND_REQUESTED_TRIGGER,
  SOCIAL_GROUP_ANNOUNCED_TRIGGER,
  SOCIAL_GROUP_INVITED_TRIGGER,
} from './triggers'
export {
  GROUP_CATEGORY_KINDS,
  GROUP_MEMBER_ROLES,
  GROUP_MEMBER_STATUSES,
  GROUP_VISIBILITIES,
  canManageGroupMembers,
  createGroupMemory,
  createGroupWallPost,
  decideAcceptGroupInvite,
  decideApproveGroupJoinRequest,
  decideCreateGroup,
  decideCreateGroupCategory,
  decideDeclineGroupJoinRequest,
  decideSetGroupVerified,
  decideInviteToGroup,
  decideJoinGroup,
  buildGroupPageShell,
  groupCoverMediaSrc,
  groupHref,
  inviteToGroupWithMail,
  isActiveGroupMember,
  isGroupCategoryKind,
  isGroupMemberForPost,
  isGroupMemberRole,
  isGroupMemberStatus,
  isGroupVisibility,
  slugifyGroupLabel,
} from './groups'
export type {
  ApproveGroupJoinInput,
  CreateGroupCategoryInput,
  CreateGroupInput,
  CreateGroupWallPostInput,
  DeclineGroupJoinInput,
  GroupBag,
  GroupCategoryKind,
  GroupCategoryMutationResult,
  GroupCategoryRecord,
  GroupMemberMutationResult,
  GroupMemberRecord,
  GroupMemberRole,
  GroupMemberStatus,
  GroupMutationResult,
  GroupRecord,
  GroupRefuseReason,
  GroupVisibility,
  InviteToGroupInput,
} from './groups'
export {
  announceGroupPostWithMail,
  categorySupportsTeamTools,
  decideAddGroupDocument,
  decideAnnounceGroupPost,
  decideAssignGroupRank,
  decideCreateGroupRank,
  decideDeleteGroup,
  decideRemoveGroupMember,
  decideSetGroupFormDefinition,
  decideSetGroupMemberRole,
  decideTransferGroup,
  resolveGroupPermissions,
} from './group-tools'
export type {
  AddGroupDocumentInput,
  AnnounceGroupPostInput,
  AssignGroupRankInput,
  CreateGroupRankInput,
  DeleteGroupInput,
  GroupAnnounceResult,
  GroupDeleteResult,
  GroupDocumentMutationResult,
  GroupDocumentRecord,
  GroupEffectivePermissions,
  GroupMemberToolsResult,
  GroupRankMutationResult,
  GroupRankRecord,
  GroupToolsRefuseReason,
  GroupTransferResult,
  RemoveGroupMemberInput,
  SetGroupFormDefinitionInput,
  SetGroupMemberRoleInput,
  TransferGroupInput,
} from './group-tools'
export {
  acceptGroupInvite,
  addGroupDocument,
  announceGroupPost,
  announceGroupPostNotifying,
  approveGroupJoinRequest,
  assignGroupRank,
  countActiveGroupMembers,
  createGroup,
  createGroupCategory,
  createGroupRank,
  createGroupWallPostInDb,
  declineGroupJoinRequest,
  deleteGroup,
  ensureDefaultGroupCategories,
  findGroup,
  findGroupBySlug,
  findGroupCategory,
  findGroupMembership,
  findGroupRank,
  inviteToGroup,
  inviteToGroupNotifying,
  isUserActiveGroupMember,
  joinGroup,
  listActiveGroupMembers,
  listActiveMemberGroupIds,
  listGroupCategories,
  listGroupDocuments,
  listGroupRanks,
  listGroupWallPosts,
  listGroupsDirectory,
  listMyGroups,
  listOwnedGroups,
  listRequestedGroupMembers,
  removeGroupMember,
  setGroupFormDefinition,
  setGroupMemberRole,
  setGroupVerified,
  transferGroup,
} from './groups-store'
export type { GroupDirectoryItem, SocialGroupListItem } from './groups-store'
export { emitGroupAnnouncedEmail, emitGroupInvitedEmail } from './email'
export {
  createPageMemory,
  createPageWallPost,
  decideAddPageAdmin,
  decideCreatePage,
  decideLikePage,
  decideSetPageVerified,
  decideUnlikePage,
  isPageAdminForPost,
  isPageAdminRow,
  isPageLikerForPost,
  pageHref,
  slugifyPageLabel,
} from './pages'
export type {
  AddPageAdminInput,
  CreatePageInput,
  CreatePageWallPostInput,
  LikePageInput,
  PageAdminMutationResult,
  PageAdminRecord,
  PageBag,
  PageLikeMutationResult,
  PageLikeRecord,
  PageMutationResult,
  PageRecord,
  PageRefuseReason,
} from './pages'
export {
  addPageAdmin,
  countPageLikes,
  createPage,
  createPageWallPostInDb,
  findPage,
  findPageAdmin,
  findPageBySlug,
  findPageLike,
  isUserPageAdmin,
  isUserPageLiker,
  likePage,
  listAdminPageIds,
  listLikedPageIds,
  listMyLikedPages,
  listPageWallPosts,
  listPagesDirectory,
  setPageVerified,
  unlikePage,
} from './pages-store'
export type { PageDirectoryItem, SocialPageListItem } from './pages-store'
export {
  STORY_TTL_MS,
  applyCreateStory,
  applyRecordStoryView,
  applyStorySweep,
  canViewStory,
  computeStoryExpiresAt,
  createStoryMemory,
  decideCreateStory,
  decideRecordStoryView,
  decideStorySweep,
  hasSeenStory,
  isStoryExpired,
  listStoryViewerIds,
  selectActiveStories,
} from './stories'
export type {
  CreateStoryInput,
  RecordStoryViewInput,
  StoryBag,
  StoryMutationResult,
  StoryRecord,
  StoryRefuseReason,
  StorySweepDecision,
  StoryViewMutationResult,
  StoryViewRecord,
} from './stories'
export {
  applyStorySweepFromDb,
  createStory,
  findStory,
  findStoryView,
  listActiveStories,
  listMyActiveStories,
  listStoryTray,
  listStoryViewersForAuthor,
  recordStoryView,
} from './stories-store'
export type { StorySweepDbResult, StoryTrayItem } from './stories-store'
export {
  ALBUM_OWNER_TYPES,
  applyAddAlbumItem,
  applyCreateAlbum,
  canManageAlbumOwner,
  canViewAlbum,
  createAlbumMemory,
  decideAddAlbumItem,
  decideCreateAlbum,
  isAlbumOwnerType,
  selectAlbumItems,
  selectAlbumsForOwner,
} from './albums'
export type {
  AddAlbumItemInput,
  AlbumBag,
  AlbumItemMutationResult,
  AlbumItemRecord,
  AlbumMutationResult,
  AlbumOwnerType,
  AlbumRecord,
  AlbumRefuseReason,
  CanViewAlbumContext,
  CreateAlbumInput,
} from './albums'
export {
  addAlbumItem,
  createAlbum,
  findAlbum,
  findAlbumItem,
  listAlbumItems,
  listAlbumsForOwner,
} from './albums-store'
export {
  applyCreateLinkPost,
  applyCreateSharePost,
  classifyLinkUrl,
  createShareLinkMemory,
  decideCreateLinkPost,
  decideCreateSharePost,
  isPrivateOrInternalHostname,
  resolveShareCard,
} from './share-links'
export type {
  CreateLinkPostInput,
  CreateSharePostInput,
  LinkPreviewSnapshot,
  ShareCard,
  ShareLinkBag,
  ShareLinkMutationResult,
  ShareLinkRefuseReason,
} from './share-links'
export {
  createLinkPost,
  createSharePost,
  fetchLinkPreview,
  getShareCard,
} from './share-links-store'
export {
  applyFollow,
  applyUnfollow,
  createFollowMemory,
  decideFollow,
  decideUnfollow,
  followPairKey,
  isFollowingFeedCandidate,
  listFolloweeIdsFromBag,
  selectFollowingFeedPage,
} from './follows'
export type {
  FollowBag,
  FollowInput,
  FollowMutationResult,
  FollowRecord,
  FollowRefuseReason,
  UnfollowMutationResult,
} from './follows'
export {
  findFollow,
  followUser,
  listFolloweeIds,
  listFollowingFeedPosts,
  unfollowUser,
} from './follows-store'
export {
  isDiscoverFeedCandidate,
  selectDiscoverFeedPage,
} from './discover'
export { listDiscoverFeedPosts } from './discover-store'
export {
  findMute,
  findPostHide,
  hidePost,
  listHiddenPostIdsForViewer,
  listMutedAuthorIdsForViewer,
  muteUser,
  unhidePost,
  unmuteUser,
} from './quiet-store'
export {
  DEFAULT_FEED_LAYOUT_MODE,
  FEED_LAYOUT_MODES,
  isFeedLayoutMode,
  isShortVideoLayoutCandidate,
  resolveFeedLayoutMode,
  selectShortVideoLayoutPage,
} from './short-video'
export type {
  FeedLayoutMode,
  FeedLayoutRefuseReason,
} from './short-video'
export { listShortVideoLayoutPosts } from './short-video-store'
export {
  POST_MENTION_MAX,
  POST_TAG_MAX,
  applySave,
  applyUnsave,
  buildMentionRows,
  buildPostTagRows,
  createMentionsTagsSavesMemory,
  decideMentionNotifications,
  decideSave,
  decideUnsave,
  extractHashtags,
  extractMentionHandles,
  listPostIdsForTag,
  listSavedPostIds,
  mentionPairKey,
  normalizeTag,
  replacePostMentions,
  replacePostTags,
  savePairKey,
  selectSavedFeedPage,
  selectTagFeedPage,
  tagPairKey,
} from './mentions-tags-saves'
export type {
  MentionNotifyDecision,
  MentionNotifySkipReason,
  MentionRecord,
  MentionsTagsSavesBag,
  PostTagRecord,
  ResolvedMention,
  SaveInput,
  SaveMutationResult,
  SaveRecord,
  SaveRefuseReason,
  UnsaveMutationResult,
} from './mentions-tags-saves'
export {
  findSave,
  listSavedFeedPosts,
  listTagFeedPosts,
  savePost,
  syncPostMentionsAndTags,
  syncPostMentionsFromBody,
  syncPostTagsFromBody,
  unsavePost,
} from './mentions-tags-saves-store'
export {
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  applyClosePoll,
  applyCreateCheckinPost,
  applyCreatePollPost,
  applyEditPollPost,
  applyVotePoll,
  buildPollOptions,
  createPollsCheckinMemory,
  decideClosePoll,
  decideCreateCheckinPost,
  decideCreatePollPost,
  decideEditPollPost,
  decideVotePoll,
  isPollClosed,
  pollVotePairKey,
} from './polls-checkin'
export type {
  ClosePollInput,
  CreateCheckinPostInput,
  CreatePollPostInput,
  EditPollPostInput,
  MapsPinResolve,
  MapsPinResolveResult,
  PollCheckinBag,
  PollCheckinMutationResult,
  PollCheckinRefuseReason,
  PollVoteMutationResult,
  PollVoteRecord,
  VotePollInput,
} from './polls-checkin'
export {
  closePoll,
  countPollVotesByOption,
  createCheckinPost,
  createPollPost,
  editPollPost,
  findPollVote,
  resolveMapsCheckInPin,
  votePoll,
} from './polls-checkin-store'
export {
  canViewPostContextFromFeedFacts,
  isHomeFeedCandidate,
  loadThenFilterHomeFeedPage,
  matchesCanViewPostPredicate,
  matchesHomeFeedVisibilityPredicate,
  paginateFeedPosts,
  selectHomeFeedPageByPredicate,
  selectHomeFeedPosts,
  selectMemberFeedPosts,
  selectVisibleFeedPosts,
} from './feed'
export type { HomeFeedVisibilityFacts } from './feed'
export {
  countIncomingFriendRequests,
  listAcceptedFriendIds,
  listAcceptedFriends,
  listHomeFeedPosts,
  listMemberFeedPosts,
} from './feed-store'
export type { SocialFriendListItem } from './feed-store'
export {
  POST_AUDIENCES,
  POST_KINDS,
  POST_MEDIA_IMAGE_MAX,
  POST_MEDIA_ROLES,
  RESERVED_FEED_HANDLES,
  canViewBoundMedia,
  canViewPost,
  classifyMediaMime,
  createPostRecord,
  decideApprovePendingPost,
  decideDeletePost,
  decideEditPost,
  decidePostAttachments,
  decideRejectPendingPost,
  decideStaffHidePost,
  emptyPollCheckinFields,
  emptyShareLinkFields,
  mediaBindIsRestricted,
  narrowerBoundMediaOwner,
  resolveMediaForMember,
  isEmptyPostBody,
  isPostAudience,
  isPostKind,
  isPostMediaRole,
  isReservedFeedHandle,
  memberFeedHref,
  normalizeMediaIds,
  normalizePollOptions,
  permalinkHref,
  resolvePostPermalink,
  toPostRecord,
} from './posts'
export type {
  BoundMediaOwner,
  CanViewPostContext,
  CreatePostInput,
  DeletePostInput,
  EditPostInput,
  MediaResolveResult,
  PermalinkResult,
  PollOption,
  PostAudience,
  PostDeleteResult,
  PostKind,
  PostMediaAttachment,
  PostMediaRole,
  PostMutationResult,
  PostRecord,
  PostRefuseReason,
  ReviewPendingPostInput,
  StaffHidePostInput,
} from './posts'
export {
  decideSocialMediaServeAccess,
  findNarrowestSocialMediaBind,
} from './media-serve-store'
export type { SocialMediaServeDecision } from './media-serve-store'
export {
  approvePendingPost,
  canViewerSeePost,
  createPost,
  deletePost,
  editPost,
  findPost,
  getPostPermalink,
  hydratePostsMedia,
  listPendingReviewPosts,
  listStaffHiddenPosts,
  rejectPendingPost,
  setPostStaffHidden,
} from './posts-store'
export { canInteract, isSocialBanned } from './interact'
export type { CanInteractContext } from './interact'
export {
  createMemberMemory,
  decideBanMember,
  decideUnbanMember,
  isSocialAccountHidden,
} from './members'
export type {
  BanMemberInput,
  MemberMutationResult,
  MemberRecord,
  MemberRefuseReason,
  UnbanMemberInput,
} from './members'
export {
  banMember,
  findMember,
  getMemberBannedAt,
  getMemberHiddenAt,
  isMemberAccountHidden,
  listBannedMembers,
  listSocialBannedUserIds,
  listSocialHiddenUserIds,
  setMemberHiddenAt,
  unbanMember,
} from './members-store'
export {
  DEFAULT_ENABLED_REACTION_KINDS,
  DEFAULT_REACTION_ICON_COLORS,
  DEFAULT_REACTION_ICONS,
  REACTION_KINDS,
  REACTION_TARGET_TYPES,
  decidePostLike,
  isReactionKind,
  isReactionKindEnabled,
  isReactionTargetType,
  normalizeEnabledReactionKinds,
  normalizeReactionIconColors,
  normalizeReactionIconMediaIds,
  normalizeReactionIcons,
  sanitizeReactionIconClass,
  sanitizeReactionIconColor,
  sanitizeReactionIconMediaId,
  setPostLikeWithGates,
} from './reactions'
export type {
  ReactionIconColors,
  ReactionIconImageUrls,
  ReactionIconMediaIds,
  ReactionIcons,
  ReactionKind,
  ReactionMutationResult,
  ReactionRecord,
  ReactionRefuseReason,
  ReactionTargetType,
  SetPostLikeInput,
} from './reactions'
export {
  canActorInteractWith,
  findReaction,
  likePost,
} from './reactions-store'
export {
  canViewComment,
  createCommentWithGates,
  decideCreateComment,
  decideDeleteComment,
  decideEditComment,
  decideStaffHideComment,
} from './comments'
export type {
  CommentDeleteResult,
  CommentMutationResult,
  CommentRecord,
  CommentRefuseReason,
  CreateCommentInput,
  DeleteCommentInput,
  EditCommentInput,
  StaffHideCommentInput,
} from './comments'
export {
  createComment,
  deleteComment,
  editComment,
  findComment,
  listCommentsForPost,
  setCommentStaffHidden,
} from './comments-store'
export {
  REPORT_REASONS,
  REPORT_STATUSES,
  createReportWithGates,
  decideCreateReport,
  decideResolveReport,
  isReportReason,
  isReportStatus,
} from './reports'
export type {
  CreateReportInput,
  ReportDecision,
  ReportMutationResult,
  ReportReason,
  ReportRecord,
  ReportRefuseReason,
  ReportStatus,
  ResolveReportDecision,
  ResolveReportInput,
} from './reports'
export {
  countOpenReportsForPost,
  createReport,
  findOpenReport,
  findReport,
  listOpenReports,
  resolveReport,
} from './reports-store'
export {
  requestFriendshipWithInteract,
} from './friends'
export {
  SOCIAL_ACCOUNT_REGISTRY,
  SOCIAL_ACCOUNT_TABLE_NAMES,
  createAccountMemory,
  exportOwnSocialRecord as exportOwnSocialRecordPure,
  hideOwnedSocialContent as hideOwnedSocialContentPure,
  listRegisteredSocialAccountTables,
  listSfSocialTablesFromSchemaSource,
  purgeOwnSocialRecord as purgeOwnSocialRecordPure,
} from './account'
export type {
  AccountExportPayload,
  AccountHideResult,
  AccountPurgeResult,
  SocialAccountBag,
  SocialAccountTableName,
} from './account'
export {
  exportOwnSocialRecordFromDb,
  hideOwnedSocialContentInDb,
  purgeOwnSocialRecordInDb,
} from './account-store'
export {
  applyPublishActivity,
  createActivityMemory,
  decidePublishActivity,
  publishActivityThroughDoor,
} from './activity'
export type {
  ActivityBag,
  ActivityRecord,
  ActivityRefuseReason,
  ActivitySnapshot,
  PublishActivityDecision,
  PublishActivityInput,
  PublishActivityResult,
} from './activity'
export {
  findActivityByKey,
  publishActivityInDb,
} from './activity-store'
export {
  CHALLENGE_ACCEPT_WINDOW_HOURS,
  CHALLENGE_ENTRY_STATUSES,
  CHALLENGE_LENGTH_DAYS_MAX,
  CHALLENGE_LENGTH_DAYS_MIN,
  CHALLENGE_OUTCOMES,
  SOCIAL_CHALLENGE_MULTI_ENTITLEMENT,
  applyChallengeLike,
  applyChallengeSweep,
  applyCreateChallenge,
  applyInviteToChallenge,
  challengePhaseDeadline,
  computeAcceptDeadline,
  computeChallengeEndsAt,
  computeUploadDeadline,
  createChallengeMemory,
  decideChallengeLike,
  decideChallengeMultiInvite,
  decideChallengeSweep,
  decideCreateChallenge,
  decideInviteToChallenge,
  inviteToChallengeWithMail,
  isChallengeAcceptWindowHours,
  isChallengeEntryStatus,
  isChallengeOutcome,
  isChallengeShareForbidden,
  isValidChallengeTiming,
} from './challenge'
export type {
  ChallengeAcceptWindowHours,
  ChallengeBag,
  ChallengeEntryRecord,
  ChallengeEntryStatus,
  ChallengeLikeRecord,
  ChallengeMultiDecision,
  ChallengeMultiGate,
  ChallengeOutcome,
  ChallengeRecord,
  ChallengeRefuseReason,
  ChallengeSweepDecision,
  CreateChallengeDecision,
  CreateChallengeInput,
  InviteChallengeDecision,
  InviteToChallengeInput,
} from './challenge'
export {
  applyChallengeSweepFromDb,
  createChallengeInDb,
  findChallengeById,
  inviteToChallengeInDb,
  setChallengeLikeInDb,
} from './challenge-store'
export {
  COMPOSER_POST_KIND_SWITCHES,
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  FRIEND_LIST_VISIBILITIES,
  SOCIAL_ACTIVITY_CARD_KINDS,
  SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_DEFAULT,
  SOCIAL_COMMENT_LENGTH_LIMIT_DEFAULT,
  SOCIAL_FEED_PAGE_SIZE_DEFAULT,
  SOCIAL_MAX_ALBUM_ITEMS_DEFAULT,
  SOCIAL_MAX_IMAGES_PER_POST_DEFAULT,
  SOCIAL_MAX_PENDING_FRIEND_REQUESTS_DEFAULT,
  SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT,
  SOCIAL_PACK_DISABLED_NOTICE,
  SOCIAL_STORY_LIFETIME_HOURS_DEFAULT,
  SOCIAL_STORY_LIFETIME_HOURS_MAX,
  SOCIAL_STORY_LIFETIME_HOURS_MIN,
  bodyContainsBlockedWord,
  decideSocialPackSettings,
  isActivityCardEnabled,
  isAlbumAtItemCap,
  isChallengeAcceptWindowAllowed,
  isChallengeLengthDaysAllowed,
  isComposerPostKindEnabled,
  isReportReasonEnabled,
  normalizeBlockedWords,
  normalizeEnabledReportReasons,
  normalizeSocialModuleSettings,
  shouldAutoHideFromOpenReports,
  socialComposerSettingsFromForm,
  socialMediaSettingsFromForm,
  socialPackAdminPage,
  socialPackSettingsError,
  socialPeopleSettingsFromForm,
  storyLifetimeMs,
} from './pack-settings'
export type {
  ComposerPostKindSwitch,
  FriendListVisibility,
  SocialActivityCardKind,
  SocialModuleSettings,
  SocialPackAdminPage,
  SocialPackSettingsDecision,
  SocialPackSettingsRefuseReason,
} from './pack-settings'
export { loadSocialModuleSettings, saveSocialModuleSettings } from './settings'
export {
  SOCIAL_SWEEP_JOB,
  SOCIAL_SWEEP_MS,
  ensureSocialSweep,
  runSocialChallengeSweep,
  runSocialStorySweep,
  runSocialSweep,
} from './sweep'
export { emitChallengeInvitedEmail }

export async function isSocialModuleEnabled(): Promise<boolean> {
  try {
    const settings = await getSiteSettings()
    return isCatalogModuleEnabled(settings, MODULE_IDS.social)
  } catch {
    return false
  }
}

/**
 * Account download block for this member’s Social rows.
 * Through `loadModuleDoor('social-api-server')`. Null when Social is off or id empty.
 */
export async function exportOwnSocialRecord(
  userId: string,
): Promise<AccountExportPayload | null> {
  const id = userId.trim()
  if (!id) return null
  if (!(await isSocialModuleEnabled())) return null
  return exportOwnSocialRecordFromDb(id)
}

/**
 * Hide this member’s Social content. Keeps rows; never purges.
 * Through `loadModuleDoor('social-api-server')`. Staff accounts refused.
 */
export async function hideOwnedSocialContent(input: {
  userId: string
  isStaff?: boolean
}): Promise<AccountHideResult> {
  if (!(await isSocialModuleEnabled())) return { ok: false, reason: 'disabled' }
  return hideOwnedSocialContentInDb(input)
}

/**
 * Purge this member’s Social rows. Core retention final-delete only.
 * Through `loadModuleDoor('social-api-server')`. Not called by hide.
 */
export async function purgeOwnSocialRecord(input: {
  userId: string
}): Promise<AccountPurgeResult> {
  if (!(await isSocialModuleEnabled())) return { ok: false, reason: 'disabled' }
  return purgeOwnSocialRecordInDb(input)
}

/**
 * Convenience wrapper: resolve the live Modules toggle, then run or bail.
 * Off → returns immediately without calling `work`.
 */
export async function withSocialEnabled<T>(
  work: () => T | Promise<T>,
): Promise<Awaited<ReturnType<typeof runSocialDoor<T>>>> {
  return runSocialDoor(isSocialModuleEnabled, work)
}

/**
 * Cross-pack activity card. Unique (sourceModule, sourceId, activityKind).
 * Off → `{ ok: false, reason: 'disabled' }` with no write.
 * Never throws — a Social failure returns `failed` so Events / Pages publish
 * is not taken down (callers stay in their own chats).
 */
export async function publishActivity(
  input: PublishActivityInput,
): Promise<PublishActivityResult> {
  try {
    if (!(await isSocialModuleEnabled())) {
      return { ok: false, reason: 'disabled' }
    }
    return await publishActivityInDb(input)
  } catch (error) {
    console.error('[social] publishActivity failed', error)
    return { ok: false, reason: 'failed' }
  }
}

/**
 * Ensure a host conversation anchor (event / CMS page) + linked post.
 * Off → `{ ok: false, reason: 'disabled' }` with no write.
 */
export async function ensureHostConversation(
  input: import('./host-conversation').EnsureHostConversationInput,
): Promise<import('./host-conversation').EnsureHostConversationResult> {
  try {
    if (!(await isSocialModuleEnabled())) {
      return { ok: false, reason: 'disabled' }
    }
    const { ensureHostConversationInDb } = await import('./host-conversation-store')
    return await ensureHostConversationInDb(input)
  } catch (error) {
    console.error('[social] ensureHostConversation failed', error)
    return { ok: false, reason: 'failed' }
  }
}

/**
 * Load props for the shared HostConversation UI on an event / CMS page.
 * Off / cannot_view → not-ok; callers render nothing.
 */
export async function loadHostConversationSurface(
  input: import('./host-conversation').EnsureHostConversationInput & {
    viewerAlreadyCanView?: boolean
  },
): Promise<import('./host-conversation-surface').LoadHostConversationSurfaceResult> {
  try {
    if (!(await isSocialModuleEnabled())) {
      return { ok: false, reason: 'disabled' }
    }
    const { loadHostConversationSurface: load } = await import(
      './host-conversation-surface'
    )
    return await load(input)
  } catch (error) {
    console.error('[social] loadHostConversationSurface failed', error)
    return { ok: false, reason: 'failed' }
  }
}

/** Server mount for event / CMS page comment threads. Soft-fails when Social is off. */
export { HostConversationMount } from './public/HostConversationMount'

async function resolveChallengeMultiGate(userId: string): Promise<ChallengeMultiGate> {
  try {
    const settings = await getSiteSettings()
    const subscriptionsEnabled = isCatalogModuleEnabled(
      settings,
      MODULE_IDS.subscriptions,
    )
    if (!subscriptionsEnabled) {
      return { subscriptionsEnabled: false, hasMultiEntitlement: false }
    }
    // Advanced must not import advanced — use Core’s member-audience slot
    // (Subscriptions boot registers the resolver; empty when off / not booted).
    const { resolveMemberAudience } = await import('@/core/modules/member-audience')
    const audience = await resolveMemberAudience(userId)
    return {
      subscriptionsEnabled: true,
      hasMultiEntitlement: audience.entitlementKeys.includes(
        SOCIAL_CHALLENGE_MULTI_ENTITLEMENT,
      ),
    }
  } catch {
    return { subscriptionsEnabled: false, hasMultiEntitlement: false }
  }
}

/**
 * Create a challenge post + creator entry. Off → disabled.
 * Timing refuse is invalid_timing (48h needs lengthDays ≥ 2).
 */
export async function createChallenge(
  input: CreateChallengeInput,
): Promise<CreateChallengeDecision> {
  if (!(await isSocialModuleEnabled())) {
    return { ok: false, reason: 'disabled' }
  }
  return createChallengeInDb(input)
}

/**
 * Invite an accepted friend. Second+ invite checks social.challenge.multi.
 * Mail failure does not roll back the invite row.
 */
export async function inviteToChallengeNotifying(input: {
  challengeId: string
  actorUserId: string
  inviteeUserId: string
  areFriends: boolean
  interact: CanInteractContext
}): Promise<InviteChallengeDecision> {
  if (!(await isSocialModuleEnabled())) {
    return { ok: false, reason: 'disabled' }
  }
  const multi = await resolveChallengeMultiGate(input.actorUserId)
  return inviteToChallengeWithMail(
    () =>
      inviteToChallengeInDb({
        ...input,
        multi,
      }),
    async (entry) => {
      await emitChallengeInvitedEmail({
        challengeId: entry.challengeId,
        entryId: entry.id,
        creatorUserId: input.actorUserId,
        inviteeUserId: entry.userId,
      })
    },
  )
}
