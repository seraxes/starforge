'use server'

import { headers } from 'next/headers'

import { revalidatePath } from '@/core/content/defer-revalidate'
import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { memberOwnsMedia } from '@/modules/media/api.server'
import { sanitizeRichHtml } from '@/modules/rich-editor/api.server'

import {
  checkSocialWriteRateLimit,
  SOCIAL_WRITE_RATE_LIMITED_MESSAGE,
} from './rate-limit'

import {
  acceptFriendship,
  blockUser,
  declineFriendship,
  requestFriendshipNotifying,
} from './friends-store'
import {
  acceptGroupInvite,
  addGroupDocument,
  announceGroupPostNotifying,
  assignGroupRank,
  createGroup,
  createGroupCategory,
  createGroupRank,
  createGroupWallPostInDb,
  deleteGroup,
  inviteToGroupNotifying,
  isUserActiveGroupMember,
  joinGroup,
  listOwnedGroups,
  removeGroupMember,
  setGroupFormDefinition,
  setGroupMemberRole,
  setGroupVerified,
  transferGroup,
} from './groups-store'
import { banMember, unbanMember } from './members-store'
import { viewerMayModerateSocialContent } from './staff-grant'
import {
  addPageAdmin,
  createPage,
  createPageWallPostInDb,
  isUserPageAdmin,
  likePage,
  setPageVerified,
  unlikePage,
} from './pages-store'
import { createPost, setPostStaffHidden } from './posts-store'
import { addAlbumItem, createAlbum, findAlbum } from './albums-store'
import { isAlbumOwnerType } from './albums'
import { createLinkPost, createSharePost } from './share-links-store'
import { followUser, unfollowUser } from './follows-store'
import { savePost, unsavePost } from './mentions-tags-saves-store'
import {
  closePoll,
  createCheckinPost,
  createPollPost,
  editPollPost,
  votePoll,
} from './polls-checkin-store'
import { POLL_OPTIONS_MAX, POLL_OPTIONS_MIN } from './polls-checkin'
import { splitPollOptionInput } from './stage'
import { createStory, recordStoryView } from './stories-store'
import { resolveReport } from './reports-store'
import {
  normalizeMediaIds,
  POST_MEDIA_IMAGE_MAX,
  isPostAudience,
  type PostAudience,
} from './posts'

export type SocialFeedActionState = {
  error?: string
  ok?: boolean
  postId?: string
}

const COMPOSER_AUDIENCES: readonly PostAudience[] = [
  'only_me',
  'friends',
  'public',
  'group',
]

function parseMediaIdsJson(raw: FormDataEntryValue | null): string[] | { error: string } {
  if (raw == null || raw === '') return []
  const text = String(raw).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return { error: 'Choose valid media.' }
    const ids = normalizeMediaIds(
      parsed.filter((v): v is string => typeof v === 'string'),
    )
    if (ids.length > POST_MEDIA_IMAGE_MAX) {
      return { error: `You can attach up to ${POST_MEDIA_IMAGE_MAX} images, or one video.` }
    }
    return ids
  } catch {
    return { error: 'Choose valid media.' }
  }
}

/**
 * Composer on /feed. Empty body refused unless media is attached.
 * Unknown mediaId refused. Group audience lists groups the author owns.
 */
export async function createTextPostAction(
  _prev: SocialFeedActionState,
  formData: FormData,
): Promise<SocialFeedActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await getAppSession()
  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!userId) return { error: 'Sign in to post.' }

  const rateLimited = await socialWriteRateLimited(userId)
  if (rateLimited) return { error: rateLimited }

  const rawBody = String(formData.get('body') ?? '')
  const body = sanitizeRichHtml(rawBody).trim() || rawBody.trim()

  const audienceRaw = String(formData.get('audience') ?? 'friends').trim() || 'friends'
  if (!isPostAudience(audienceRaw) || !COMPOSER_AUDIENCES.includes(audienceRaw)) {
    return { error: 'Choose a valid audience.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim() || null
  if (audienceRaw === 'group') {
    if (!groupId) return { error: 'Choose a group you own.' }
    const owned = await listOwnedGroups(userId)
    if (!owned.some((g) => g.id === groupId)) {
      return { error: 'Choose a group you own.' }
    }
  }

  const linkUrl = String(formData.get('linkUrl') ?? '').trim()
  if (linkUrl) {
    const linkResult = await createLinkPost({
      authorUserId: userId,
      url: linkUrl,
      body,
      audience: audienceRaw,
      groupId: audienceRaw === 'group' ? groupId : null,
    })
    if (!linkResult.ok) {
      if (linkResult.reason === 'private_address') {
        return { error: 'That link points at a private or internal address.' }
      }
      if (linkResult.reason === 'invalid') return { error: 'Enter a valid http(s) link.' }
      if (linkResult.reason === 'invalid_audience') return { error: 'Choose a valid audience.' }
      if (linkResult.reason === 'group_required') return { error: 'Choose a group you own.' }
      if (linkResult.reason === 'banned') return { error: 'You cannot post while banned.' }
      return { error: 'Could not create the link post.' }
    }
    revalidatePath('/feed')
    if (groupId) revalidatePath(`/feed/g`)
    return { ok: true, postId: linkResult.post.id }
  }

  const placeLabel = String(formData.get('placeLabel') ?? '').trim()
  if (placeLabel) {
    const checkinResult = await createCheckinPost({
      authorUserId: userId,
      placeLabel,
      body,
      audience: audienceRaw,
      groupId: audienceRaw === 'group' ? groupId : null,
    })
    if (!checkinResult.ok) {
      if (checkinResult.reason === 'empty_label') {
        return { error: 'Enter a place label for the check-in.' }
      }
      if (checkinResult.reason === 'invalid_audience') {
        return { error: 'Choose a valid audience.' }
      }
      if (checkinResult.reason === 'group_required') {
        return { error: 'Choose a group you own.' }
      }
      if (checkinResult.reason === 'banned') {
        return { error: 'You cannot post while banned.' }
      }
      return { error: 'Could not create the check-in.' }
    }
    revalidatePath('/feed')
    if (groupId) revalidatePath(`/feed/g`)
    return { ok: true, postId: checkinResult.post.id }
  }

  const pollOptionsRaw = String(formData.get('pollOptions') ?? '').trim()
  if (pollOptionsRaw) {
    const options = splitPollOptionInput(pollOptionsRaw)
    if (options.length < POLL_OPTIONS_MIN || options.length > POLL_OPTIONS_MAX) {
      return {
        error: `A poll needs ${POLL_OPTIONS_MIN}–${POLL_OPTIONS_MAX} options.`,
      }
    }
    const pollResult = await createPollPost({
      authorUserId: userId,
      body,
      options,
      audience: audienceRaw,
      groupId: audienceRaw === 'group' ? groupId : null,
    })
    if (!pollResult.ok) {
      if (pollResult.reason === 'invalid') {
        return {
          error: `A poll needs ${POLL_OPTIONS_MIN}–${POLL_OPTIONS_MAX} distinct options.`,
        }
      }
      if (pollResult.reason === 'invalid_audience') {
        return { error: 'Choose a valid audience.' }
      }
      if (pollResult.reason === 'group_required') {
        return { error: 'Choose a group you own.' }
      }
      if (pollResult.reason === 'banned') {
        return { error: 'You cannot post while banned.' }
      }
      return { error: 'Could not create the poll.' }
    }
    revalidatePath('/feed')
    if (groupId) revalidatePath(`/feed/g`)
    return { ok: true, postId: pollResult.post.id }
  }

  const mediaParsed = parseMediaIdsJson(formData.get('mediaIdsJson'))
  if ('error' in mediaParsed) return { error: mediaParsed.error }
  const mediaIds = mediaParsed

  for (const mediaId of mediaIds) {
    if (!(await memberOwnsMedia(userId, mediaId))) {
      return { error: 'Choose media you uploaded yourself.' }
    }
  }

  const result = await createPost({
    authorUserId: userId,
    body,
    audience: audienceRaw,
    groupId: audienceRaw === 'group' ? groupId : null,
    mediaIds,
  })
  if (!result.ok) {
    if (result.reason === 'empty_body') return { error: 'Write something or add a photo before posting.' }
    if (result.reason === 'invalid_audience') return { error: 'Choose a valid audience.' }
    if (result.reason === 'group_required') return { error: 'Choose a group you own.' }
    if (result.reason === 'unknown_media') return { error: 'That media is missing from the library.' }
    if (result.reason === 'invalid_media_mix') {
      return { error: 'Use many images or one video — not both.' }
    }
    if (result.reason === 'audience_too_wide') {
      return { error: 'That file cannot be attached to a wider audience.' }
    }
    if (result.reason === 'banned') return { error: 'You cannot post while banned.' }
    if (result.reason === 'disabled_kind') {
      return { error: 'That post type is turned off in Social settings.' }
    }
    return { error: 'Could not create the post.' }
  }

  revalidatePath('/feed')
  if (groupId) revalidatePath(`/feed/g`)
  return { ok: true, postId: result.post.id }
}

/** Author or Social staff (admin / dev) edits a post body. */
export async function editPostAction(
  _prev: SocialFeedActionState,
  formData: FormData,
): Promise<SocialFeedActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a post.' }
  const rawBody = String(formData.get('body') ?? '')
  const body = sanitizeRichHtml(rawBody).trim() || rawBody.trim()

  const canManagePosts = await viewerMayModerateSocialContent(gate.userId)
  const { editPost } = await import('./posts-store')
  const result = await editPost(
    {
      actorUserId: gate.userId,
      postId,
      body,
    },
    { canManagePosts },
  )
  if (!result.ok) {
    if (result.reason === 'not_author') return { error: 'You can only edit your own posts.' }
    if (result.reason === 'empty_body') return { error: 'Write something first.' }
    if (result.reason === 'poll_closed') return { error: 'That poll is closed.' }
    if (result.reason === 'not_found') return { error: 'That post is no longer there.' }
    return { error: 'Could not save the post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, postId }
}

/** Author or Social staff (admin / dev) deletes a post. */
export async function deletePostAction(
  _prev: SocialFeedActionState,
  formData: FormData,
): Promise<SocialFeedActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a post.' }

  const canManagePosts = await viewerMayModerateSocialContent(gate.userId)
  const { deletePost } = await import('./posts-store')
  const result = await deletePost(
    {
      actorUserId: gate.userId,
      postId,
    },
    { canManagePosts },
  )
  if (!result.ok) {
    if (result.reason === 'not_author') return { error: 'You can only delete your own posts.' }
    if (result.reason === 'not_found') return { error: 'That post is no longer there.' }
    return { error: 'Could not delete the post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, postId }
}

/** Author or Social staff (admin / dev) changes who can see a post. */
export async function setPostAudienceAction(
  _prev: SocialFeedActionState,
  formData: FormData,
): Promise<SocialFeedActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  const audienceRaw = String(formData.get('audience') ?? '').trim()
  const groupId = String(formData.get('groupId') ?? '').trim() || null
  if (!postId) return { error: 'Choose a post.' }
  if (!isPostAudience(audienceRaw) || !COMPOSER_AUDIENCES.includes(audienceRaw)) {
    return { error: 'Choose who can see this.' }
  }

  const canManagePosts = await viewerMayModerateSocialContent(gate.userId)
  if (audienceRaw === 'group') {
    if (!groupId) return { error: 'Choose a group you own.' }
    const actorOwned = await listOwnedGroups(gate.userId)
    if (actorOwned.some((group) => group.id === groupId)) {
      /* ok — actor owns the group */
    } else if (canManagePosts) {
      const { findPost } = await import('./posts-store')
      const post = await findPost(postId)
      const authorOwned = post ? await listOwnedGroups(post.authorUserId) : []
      if (!authorOwned.some((group) => group.id === groupId)) {
        return { error: 'Choose a group you own.' }
      }
    } else {
      return { error: 'Choose a group you own.' }
    }
  }

  const { setPostAudience } = await import('./posts-store')
  const result = await setPostAudience(
    {
      actorUserId: gate.userId,
      postId,
      audience: audienceRaw,
      groupId,
    },
    { canManagePosts },
  )
  if (!result.ok) {
    if (result.reason === 'not_author') return { error: 'You can only change your own posts.' }
    if (result.reason === 'invalid_audience' || result.reason === 'group_required') {
      return { error: 'Choose who can see this.' }
    }
    if (result.reason === 'audience_too_wide') {
      return { error: 'That file cannot be attached to a wider audience.' }
    }
    return { error: 'Could not update who can see this.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, postId }
}

/** Share another post onto the feed (optional comment). */
export async function createSharePostAction(
  _prev: SocialFeedActionState,
  formData: FormData,
): Promise<SocialFeedActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await getAppSession()
  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!userId) return { error: 'Sign in to share.' }

  const rateLimited = await socialWriteRateLimited(userId)
  if (rateLimited) return { error: rateLimited }

  const sharedPostId = String(formData.get('sharedPostId') ?? '').trim()
  if (!sharedPostId) return { error: 'Choose a post to share.' }

  const rawBody = String(formData.get('body') ?? '')
  const body = sanitizeRichHtml(rawBody).trim() || rawBody.trim()
  const audienceRaw = String(formData.get('audience') ?? 'friends').trim() || 'friends'
  if (!isPostAudience(audienceRaw) || !COMPOSER_AUDIENCES.includes(audienceRaw)) {
    return { error: 'Choose a valid audience.' }
  }

  const result = await createSharePost({
    authorUserId: userId,
    sharedPostId,
    body,
    audience: audienceRaw,
  })
  if (!result.ok) {
    if (result.reason === 'share_forbidden') {
      return { error: 'Challenge posts cannot be shared.' }
    }
    if (result.reason === 'blocked' || result.reason === 'cannot_interact') {
      return { error: 'You cannot share this post.' }
    }
    if (result.reason === 'cannot_view' || result.reason === 'not_found') {
      return { error: 'That post is not available.' }
    }
    if (result.reason === 'audience_too_wide') {
      return { error: 'That share would show the post to more people than the original allows.' }
    }
    if (result.reason === 'banned') return { error: 'You cannot share while banned.' }
    return { error: 'Could not share the post.' }
  }

  revalidatePath('/feed')
  return { ok: true, postId: result.post.id }
}

export type SocialGroupActionState = {
  error?: string
  ok?: boolean
  groupId?: string
  postId?: string
  slug?: string
}

/** Create a group from `/feed/groups`. */
export async function createGroupAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const name = String(formData.get('name') ?? '').trim()
  const categoryId = String(formData.get('categoryId') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const formDefinitionId = String(formData.get('formDefinitionId') ?? '').trim() || null
  if (!name) return { error: 'Name your group.' }
  if (!categoryId) return { error: 'Choose a category.' }

  const { loadSocialModuleSettings } = await import('./settings')
  const { actorMayCreateSocialEntity } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const visibilityRaw =
    String(formData.get('visibility') ?? '').trim() ||
    pack.settings.defaultGroupJoinRule ||
    'open'
  const staff = await requireAdminArea('admin.social', 'manage')
  const canCreate = actorMayCreateSocialEntity(
    pack.settings.groupWhoCanCreate,
    Boolean(staff?.user?.id),
  )

  const result = await createGroup(
    {
      name,
      categoryId,
      visibility: visibilityRaw,
      ownerUserId: gate.userId,
      description,
      formDefinitionId,
    },
    { canCreate },
  )
  if (!result.ok) {
    if (result.reason === 'slug_taken') return { error: 'That group URL is taken.' }
    if (result.reason === 'not_found') return { error: 'Choose a valid category.' }
    if (result.reason === 'banned') return { error: 'You cannot create a group while banned.' }
    if (result.reason === 'disabled') return { error: 'Groups are turned off.' }
    if (result.reason === 'not_allowed') {
      return { error: 'Only staff can create groups.' }
    }
    return { error: 'Could not create the group.' }
  }

  revalidatePath('/feed/groups')
  return { ok: true, groupId: result.group.id, slug: result.group.slug }
}

/** Join or request join from `/feed/g/[slug]`. */
export async function joinGroupAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  if (!groupId) return { error: 'Missing group.' }

  const result = await joinGroup(groupId, gate.userId)
  if (!result.ok) {
    if (result.reason === 'already_member') return { error: 'You are already a member.' }
    if (result.reason === 'banned') return { error: 'You cannot join while banned.' }
    if (result.reason === 'disabled') return { error: 'Groups are turned off.' }
    if (result.reason === 'member_cap') return { error: 'This group is full.' }
    return { error: 'Could not join the group.' }
  }

  revalidatePath('/feed/groups')
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Accept a group invite. */
export async function acceptGroupInviteAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  if (!groupId) return { error: 'Missing group.' }

  const result = await acceptGroupInvite(groupId, gate.userId)
  if (!result.ok) {
    if (result.reason === 'not_invited') return { error: 'No invite to accept.' }
    return { error: 'Could not accept the invite.' }
  }

  revalidatePath('/feed/groups')
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Invite a member (owner/admin). Mail failure does not roll back. */
export async function inviteToGroupAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const inviteeUserId = String(formData.get('inviteeUserId') ?? '').trim()
  if (!groupId || !inviteeUserId) return { error: 'Choose a member to invite.' }

  const result = await inviteToGroupNotifying({
    groupId,
    actorUserId: gate.userId,
    inviteeUserId,
  })
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot invite this member.' }
    if (result.reason === 'cannot_interact' || result.reason === 'banned') {
      return { error: 'You cannot invite this member.' }
    }
    if (result.reason === 'already_member') return { error: 'They are already a member.' }
    if (result.reason === 'not_admin') return { error: 'Only owners and admins can invite.' }
    if (result.reason === 'self') return { error: 'You cannot invite yourself.' }
    return { error: 'Could not send the invite.' }
  }

  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Wall composer — any active member may post. */
export async function createGroupWallPostAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const groupId = String(formData.get('groupId') ?? '').trim()
  if (!groupId) return { error: 'Missing group.' }
  if (!(await isUserActiveGroupMember(gate.userId, groupId))) {
    return { error: 'Join the group to post on the wall.' }
  }

  const rawBody = String(formData.get('body') ?? '')
  const body = sanitizeRichHtml(rawBody).trim() || rawBody.trim()

  const result = await createGroupWallPostInDb({
    authorUserId: gate.userId,
    groupId,
    body,
  })
  if (!result.ok) {
    if (result.reason === 'empty_body') return { error: 'Write something before posting.' }
    if (result.reason === 'banned') return { error: 'You cannot post while banned.' }
    if (result.reason === 'disabled_kind') {
      return { error: 'That post type is turned off in Social settings.' }
    }
    return { error: 'Could not create the post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/g')
  return { ok: true, groupId, postId: result.post.id }
}

/** Owner/admin: create a team/association rank. */
export async function createGroupRankAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  if (!groupId || !name) return { error: 'Name the rank.' }

  const result = await createGroupRank({
    groupId,
    actorUserId: gate.userId,
    name,
    canAnnounce: formData.get('canAnnounce') === 'on',
    canManageDocuments: formData.get('canManageDocuments') === 'on',
    canManageCalendar: formData.get('canManageCalendar') === 'on',
    canManageMembers: formData.get('canManageMembers') === 'on',
  })
  if (!result.ok) {
    if (result.reason === 'not_team_tools') {
      return { error: 'Ranks are for team and association groups.' }
    }
    if (result.reason === 'not_admin') return { error: 'Only owners and admins can add ranks.' }
    return { error: 'Could not create the rank.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Owner/admin: assign a rank to a member. */
export async function assignGroupRankAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const targetUserId = String(formData.get('targetUserId') ?? '').trim()
  const rankId = String(formData.get('rankId') ?? '').trim() || null
  if (!groupId || !targetUserId) return { error: 'Choose a member and rank.' }

  const result = await assignGroupRank({
    groupId,
    actorUserId: gate.userId,
    targetUserId,
    rankId,
  })
  if (!result.ok) {
    if (result.reason === 'protected_member') return { error: 'Cannot assign a rank to the owner.' }
    if (result.reason === 'not_admin') return { error: 'Only owners and admins can assign ranks.' }
    return { error: 'Could not assign the rank.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Owner: promote or demote admin. */
export async function setGroupMemberRoleAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const targetUserId = String(formData.get('targetUserId') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  if (!groupId || !targetUserId || (role !== 'admin' && role !== 'member')) {
    return { error: 'Choose a member and role.' }
  }

  const result = await setGroupMemberRole({
    groupId,
    actorUserId: gate.userId,
    targetUserId,
    role,
  })
  if (!result.ok) {
    if (result.reason === 'not_owner') return { error: 'Only the owner can change admin roles.' }
    if (result.reason === 'protected_member') return { error: 'Cannot change the owner role this way.' }
    return { error: 'Could not update the role.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Remove a member (owner / admin / rank with canManageMembers). */
export async function removeGroupMemberAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const targetUserId = String(formData.get('targetUserId') ?? '').trim()
  if (!groupId || !targetUserId) return { error: 'Choose a member.' }

  const result = await removeGroupMember({
    groupId,
    actorUserId: gate.userId,
    targetUserId,
  })
  if (!result.ok) {
    if (result.reason === 'protected_member') {
      return { error: 'A rank cannot remove the owner or an admin.' }
    }
    if (result.reason === 'not_allowed') return { error: 'Not allowed to remove members.' }
    if (result.reason === 'self') return { error: 'You cannot remove yourself.' }
    return { error: 'Could not remove the member.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Add a group document (Media bind). */
export async function addGroupDocumentAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const mediaId = String(formData.get('mediaId') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!groupId || !mediaId) return { error: 'Choose a file.' }

  const result = await addGroupDocument({
    groupId,
    actorUserId: gate.userId,
    mediaId,
    title,
  })
  if (!result.ok) {
    if (result.reason === 'unknown_media') return { error: 'Choose a file you own in Media.' }
    if (result.reason === 'not_allowed') return { error: 'Not allowed to manage documents.' }
    if (result.reason === 'not_team_tools') {
      return { error: 'Documents are for team and association groups.' }
    }
    return { error: 'Could not add the document.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Pin a wall post as an announcement; mail soft-fails. */
export async function announceGroupPostAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const postId = String(formData.get('postId') ?? '').trim()
  if (!groupId || !postId) return { error: 'Choose a post.' }

  const result = await announceGroupPostNotifying({
    groupId,
    actorUserId: gate.userId,
    postId,
  })
  if (!result.ok) {
    if (result.reason === 'not_allowed') return { error: 'Not allowed to announce.' }
    if (result.reason === 'not_team_tools') {
      return { error: 'Announcements are for team and association groups.' }
    }
    return { error: 'Could not announce the post.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId, postId }
}

/** Owner/admin: bind Forms join definition. */
export async function setGroupFormDefinitionAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const formDefinitionId = String(formData.get('formDefinitionId') ?? '').trim() || null
  if (!groupId) return { error: 'Missing group.' }

  const result = await setGroupFormDefinition({
    groupId,
    actorUserId: gate.userId,
    formDefinitionId,
  })
  if (!result.ok) {
    if (result.reason === 'not_admin') return { error: 'Only owners and admins can set the join form.' }
    return { error: 'Could not update the join form.' }
  }
  revalidatePath('/feed/g')
  return { ok: true, groupId }
}

/** Only the owner transfers ownership. */
export async function transferGroupAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const newOwnerUserId = String(formData.get('newOwnerUserId') ?? '').trim()
  if (!groupId || !newOwnerUserId) return { error: 'Choose the new owner.' }

  const result = await transferGroup({
    groupId,
    actorUserId: gate.userId,
    newOwnerUserId,
  })
  if (!result.ok) {
    if (result.reason === 'not_owner') return { error: 'Only the owner can transfer the group.' }
    if (result.reason === 'blocked' || result.reason === 'cannot_interact') {
      return { error: 'You cannot transfer to this member.' }
    }
    if (result.reason === 'not_member') return { error: 'The new owner must be an active member.' }
    return { error: 'Could not transfer the group.' }
  }
  revalidatePath('/feed/g')
  revalidatePath('/feed/groups')
  return { ok: true, groupId }
}

/** Only the owner deletes the group. */
export async function deleteGroupAction(
  _prev: SocialGroupActionState,
  formData: FormData,
): Promise<SocialGroupActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const groupId = String(formData.get('groupId') ?? '').trim()
  if (!groupId) return { error: 'Missing group.' }

  const result = await deleteGroup({ groupId, actorUserId: gate.userId })
  if (!result.ok) {
    if (result.reason === 'not_owner') return { error: 'Only the owner can delete the group.' }
    return { error: 'Could not delete the group.' }
  }
  revalidatePath('/feed/groups')
  revalidatePath('/feed/g')
  revalidatePath('/feed')
  return { ok: true, groupId }
}

export type SocialPageActionState = {
  error?: string
  ok?: boolean
  pageId?: string
  postId?: string
  slug?: string
}

/** Create a page from `/feed/pages`. */
export async function createPageAction(
  _prev: SocialPageActionState,
  formData: FormData,
): Promise<SocialPageActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const sitePageId = String(formData.get('sitePageId') ?? '').trim() || null
  if (!name) return { error: 'Name your page.' }

  const { loadSocialModuleSettings } = await import('./settings')
  const { actorMayCreateSocialEntity } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const staff = await requireAdminArea('admin.social', 'manage')
  const canCreate = actorMayCreateSocialEntity(
    pack.settings.pageWhoCanCreate,
    Boolean(staff?.user?.id),
  )

  const result = await createPage(
    {
      name,
      ownerUserId: gate.userId,
      description,
      sitePageId,
    },
    { canCreate },
  )
  if (!result.ok) {
    if (result.reason === 'slug_taken') return { error: 'That page URL is taken.' }
    if (result.reason === 'banned') return { error: 'You cannot create a page while banned.' }
    if (result.reason === 'disabled') return { error: 'Pages are turned off.' }
    if (result.reason === 'not_allowed') {
      return { error: 'Only staff can create pages.' }
    }
    return { error: 'Could not create the page.' }
  }

  revalidatePath('/feed/pages')
  return { ok: true, pageId: result.page.id, slug: result.page.slug }
}

/** Like a page from `/feed/p/[slug]`. */
export async function likePageAction(
  _prev: SocialPageActionState,
  formData: FormData,
): Promise<SocialPageActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const pageId = String(formData.get('pageId') ?? '').trim()
  if (!pageId) return { error: 'Missing page.' }

  const result = await likePage({ pageId, userId: gate.userId })
  if (!result.ok) {
    if (result.reason === 'disabled') return { error: 'Page likes are turned off.' }
    if (result.reason === 'blocked') return { error: 'You cannot like this page.' }
    if (result.reason === 'cannot_interact' || result.reason === 'banned') {
      return { error: 'You cannot like this page.' }
    }
    if (result.reason === 'not_found') return { error: 'Page not found.' }
    return { error: 'Could not like the page.' }
  }

  revalidatePath('/feed/pages')
  revalidatePath('/feed/p')
  revalidatePath('/feed')
  return { ok: true, pageId }
}

/** Unlike a page. */
export async function unlikePageAction(
  _prev: SocialPageActionState,
  formData: FormData,
): Promise<SocialPageActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const pageId = String(formData.get('pageId') ?? '').trim()
  if (!pageId) return { error: 'Missing page.' }

  const result = await unlikePage(pageId, gate.userId)
  if (!result.ok) {
    if (result.reason === 'not_liked') return { error: 'You have not liked this page.' }
    return { error: 'Could not unlike the page.' }
  }

  revalidatePath('/feed/pages')
  revalidatePath('/feed/p')
  revalidatePath('/feed')
  return { ok: true, pageId }
}

/** Owner/admin: add another page admin. */
export async function addPageAdminAction(
  _prev: SocialPageActionState,
  formData: FormData,
): Promise<SocialPageActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const pageId = String(formData.get('pageId') ?? '').trim()
  const targetUserId = String(formData.get('targetUserId') ?? '').trim()
  if (!pageId || !targetUserId) return { error: 'Choose a member to make admin.' }

  const result = await addPageAdmin({
    pageId,
    actorUserId: gate.userId,
    targetUserId,
  })
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot add this member.' }
    if (result.reason === 'cannot_interact' || result.reason === 'banned') {
      return { error: 'You cannot add this member.' }
    }
    if (result.reason === 'already_admin') return { error: 'They are already an admin.' }
    if (result.reason === 'not_admin') return { error: 'Only page admins can add admins.' }
    if (result.reason === 'self') return { error: 'You cannot add yourself.' }
    return { error: 'Could not add the admin.' }
  }

  revalidatePath('/feed/p')
  return { ok: true, pageId }
}

/** Page wall composer — page admins only. */
export async function createPageWallPostAction(
  _prev: SocialPageActionState,
  formData: FormData,
): Promise<SocialPageActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const pageId = String(formData.get('pageId') ?? '').trim()
  if (!pageId) return { error: 'Missing page.' }
  if (!(await isUserPageAdmin(gate.userId, pageId))) {
    return { error: 'Only page admins can post on the wall.' }
  }

  const rawBody = String(formData.get('body') ?? '')
  const body = sanitizeRichHtml(rawBody).trim() || rawBody.trim()

  const result = await createPageWallPostInDb({
    authorUserId: gate.userId,
    pageId,
    body,
  })
  if (!result.ok) {
    if (result.reason === 'empty_body') return { error: 'Write something before posting.' }
    if (result.reason === 'banned') return { error: 'You cannot post while banned.' }
    if (result.reason === 'disabled_kind') {
      return { error: 'That post type is turned off in Social settings.' }
    }
    return { error: 'Could not create the post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/p')
  return { ok: true, pageId, postId: result.post.id }
}

export type SocialStoryActionState = {
  error?: string
  ok?: boolean
  storyId?: string
}

/** Create a 24h story from `/feed/stories`. Media file stays in product:media. */
export async function createStoryAction(
  _prev: SocialStoryActionState,
  formData: FormData,
): Promise<SocialStoryActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const mediaId = String(formData.get('mediaId') ?? '').trim()
  if (!mediaId) return { error: 'Pick a photo or video.' }
  if (!(await memberOwnsMedia(gate.userId, mediaId))) {
    return { error: 'That media is not available.' }
  }

  const result = await createStory({
    authorUserId: gate.userId,
    mediaId,
  })
  if (!result.ok) {
    if (result.reason === 'banned') return { error: 'You cannot post a story while banned.' }
    if (result.reason === 'unknown_media') return { error: 'That media is not available.' }
    if (result.reason === 'invalid_media') {
      return { error: 'Stories need one image or one video.' }
    }
    return { error: 'Could not create the story.' }
  }

  revalidatePath('/feed/stories')
  revalidatePath('/feed')
  return { ok: true, storyId: result.story.id }
}

/** Mark a story seen. Calls canInteract with the author. */
export async function recordStoryViewAction(
  _prev: SocialStoryActionState,
  formData: FormData,
): Promise<SocialStoryActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const storyId = String(formData.get('storyId') ?? '').trim()
  if (!storyId) return { error: 'Missing story.' }

  const result = await recordStoryView({
    storyId,
    userId: gate.userId,
  })
  if (!result.ok) {
    if (result.reason === 'expired') return { error: 'That story has expired.' }
    if (result.reason === 'blocked' || result.reason === 'cannot_interact') {
      return { error: 'You cannot view this story.' }
    }
    if (result.reason === 'not_found') return { error: 'Story not found.' }
    return { error: 'Could not mark the story seen.' }
  }

  revalidatePath('/feed/stories')
  return { ok: true, storyId }
}

export type SocialAlbumActionState = {
  error?: string
  ok?: boolean
  albumId?: string
  itemId?: string
}

function revalidateAlbumOwnerPaths(ownerType: string, ownerId: string) {
  if (ownerType === 'user') {
    revalidatePath('/feed')
    return
  }
  if (ownerType === 'group') {
    revalidatePath('/feed/groups')
    revalidatePath('/feed/g')
    return
  }
  if (ownerType === 'page') {
    revalidatePath('/feed/pages')
    revalidatePath('/feed/p')
  }
}

/** Create a named album on a member, group, or page. Files stay in Media. */
export async function createAlbumAction(
  _prev: SocialAlbumActionState,
  formData: FormData,
): Promise<SocialAlbumActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const title = String(formData.get('title') ?? '').trim()
  const ownerTypeRaw = String(formData.get('ownerType') ?? '').trim()
  const ownerId = String(formData.get('ownerId') ?? '').trim()
  const coverMediaId = String(formData.get('coverMediaId') ?? '').trim() || null
  if (!title || !ownerId) return { error: 'Name the album.' }
  if (!isAlbumOwnerType(ownerTypeRaw)) return { error: 'Choose where this album lives.' }

  let isGroupMember = false
  let isPageAdmin = false
  if (ownerTypeRaw === 'group') {
    isGroupMember = await isUserActiveGroupMember(ownerId, gate.userId)
    if (!isGroupMember) return { error: 'Join the group to create an album.' }
  } else if (ownerTypeRaw === 'page') {
    isPageAdmin = await isUserPageAdmin(ownerId, gate.userId)
    if (!isPageAdmin) return { error: 'Only page admins can create albums.' }
  } else if (ownerId !== gate.userId) {
    return { error: 'You can only create albums on your own profile.' }
  }

  if (coverMediaId && !(await memberOwnsMedia(gate.userId, coverMediaId))) {
    return { error: 'That media is not available.' }
  }

  const result = await createAlbum({
    title,
    ownerType: ownerTypeRaw,
    ownerId,
    createdByUserId: gate.userId,
    coverMediaId,
    isGroupMember,
    isPageAdmin,
  })
  if (!result.ok) {
    if (result.reason === 'banned') return { error: 'You cannot create albums while banned.' }
    if (result.reason === 'unknown_media') return { error: 'That media is not available.' }
    if (result.reason === 'not_allowed') return { error: 'You cannot create this album.' }
    return { error: 'Could not create the album.' }
  }

  revalidateAlbumOwnerPaths(result.album.ownerType, result.album.ownerId)
  return { ok: true, albumId: result.album.id }
}

/** Add a Media file to an album. Unknown mediaId is refused. */
export async function addAlbumItemAction(
  _prev: SocialAlbumActionState,
  formData: FormData,
): Promise<SocialAlbumActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const albumId = String(formData.get('albumId') ?? '').trim()
  const mediaId = String(formData.get('mediaId') ?? '').trim()
  if (!albumId) return { error: 'Choose an album.' }
  if (!mediaId) return { error: 'Pick a photo or video.' }
  if (!(await memberOwnsMedia(gate.userId, mediaId))) {
    return { error: 'That media is not available.' }
  }

  const album = await findAlbum(albumId)
  if (!album) return { error: 'Album not found.' }

  let isGroupMember = false
  let isPageAdmin = false
  if (album.ownerType === 'group') {
    isGroupMember = await isUserActiveGroupMember(album.ownerId, gate.userId)
  } else if (album.ownerType === 'page') {
    isPageAdmin = await isUserPageAdmin(album.ownerId, gate.userId)
  }

  const result = await addAlbumItem({
    albumId,
    mediaId,
    actorUserId: gate.userId,
    isGroupMember,
    isPageAdmin,
  })
  if (!result.ok) {
    if (result.reason === 'banned') return { error: 'You cannot add to albums while banned.' }
    if (result.reason === 'unknown_media') return { error: 'That media is not available.' }
    if (result.reason === 'not_allowed') return { error: 'You cannot add to this album.' }
    if (result.reason === 'not_found') return { error: 'Album not found.' }
    return { error: 'Could not add that file.' }
  }

  revalidateAlbumOwnerPaths(album.ownerType, album.ownerId)
  return { ok: true, albumId, itemId: result.item.id }
}

export type SocialPeopleActionState = {
  error?: string
  ok?: boolean
}

async function requireSocialMember(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { ok: false, error: 'Social is disabled.' }
  }
  const session = await getAppSession()
  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!userId) return { ok: false, error: 'Sign in to continue.' }
  return { ok: true, userId }
}

/** After member gate; before create / mail writes. Staff are not exempt. */
async function socialWriteRateLimited(userId: string): Promise<string | null> {
  const limited = await checkSocialWriteRateLimit(userId, await headers())
  if (!limited.ok) return SOCIAL_WRITE_RATE_LIMITED_MESSAGE
  return null
}

export type SocialCommentActionState = {
  error?: string
  ok?: boolean
  /** Set on a successful create / edit so the client can refresh once per write. */
  commentId?: string
}

/** Comment on a post, or reply to any comment in the thread. */
export async function createCommentAction(
  _prev: SocialCommentActionState,
  formData: FormData,
): Promise<SocialCommentActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const postId = String(formData.get('postId') ?? '').trim()
  const parentCommentId = String(formData.get('parentCommentId') ?? '').trim() || null
  const body = String(formData.get('body') ?? '').trim()
  if (!postId) return { error: 'Choose a post.' }
  if (!body) return { error: 'Write a comment first.' }

  const { createComment } = await import('./comments-store')
  const result = await createComment({
    authorUserId: gate.userId,
    postId,
    parentCommentId,
    body,
  })
  if (!result.ok) {
    if (result.reason === 'empty_body') return { error: 'Write a comment first.' }
    if (result.reason === 'parent_not_found') return { error: 'That comment is no longer there.' }
    if (result.reason === 'cannot_view') return { error: 'You cannot comment on this post.' }
    if (result.reason === 'cannot_interact') return { error: 'You cannot comment on this post.' }
    if (result.reason === 'disabled') return { error: 'Comments are turned off.' }
    if (result.reason === 'too_long') return { error: 'That comment is too long.' }
    if (result.reason === 'blocked_word') return { error: 'That comment is not allowed.' }
    return { error: 'Could not post the comment.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, commentId: result.comment.id }
}

/** Edit a comment. Author, or Social staff with admin.social edit. */
export async function editCommentAction(
  _prev: SocialCommentActionState,
  formData: FormData,
): Promise<SocialCommentActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const commentId = String(formData.get('commentId') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!commentId) return { error: 'Choose a comment.' }
  if (!body) return { error: 'Write a comment first.' }

  const canManagePosts = await viewerMayModerateSocialContent(gate.userId)
  const { editComment } = await import('./comments-store')
  const result = await editComment(
    { actorUserId: gate.userId, commentId, body },
    { canManagePosts },
  )
  if (!result.ok) {
    if (result.reason === 'empty_body') return { error: 'Write a comment first.' }
    if (result.reason === 'not_author') return { error: 'You can only edit your own comments.' }
    if (result.reason === 'not_found') return { error: 'That comment is no longer there.' }
    return { error: 'Could not save the comment.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, commentId }
}

/** Delete a comment. Author, or Social staff with admin.social edit. */
export async function deleteCommentAction(
  _prev: SocialCommentActionState,
  formData: FormData,
): Promise<SocialCommentActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const commentId = String(formData.get('commentId') ?? '').trim()
  if (!commentId) return { error: 'Choose a comment.' }

  const canManagePosts = await viewerMayModerateSocialContent(gate.userId)
  const { deleteComment } = await import('./comments-store')
  const result = await deleteComment(
    { actorUserId: gate.userId, commentId },
    { canManagePosts },
  )
  if (!result.ok) {
    if (result.reason === 'not_author') return { error: 'You cannot delete that comment.' }
    if (result.reason === 'not_found') return { error: 'That comment is no longer there.' }
    return { error: 'Could not delete the comment.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, commentId }
}

/** Set the viewer's reaction on a post or a comment. One row per person per target. */
export async function setReactionAction(
  _prev: SocialCommentActionState,
  formData: FormData,
): Promise<SocialCommentActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const targetType = String(formData.get('targetType') ?? '').trim()
  const targetId = String(formData.get('targetId') ?? '').trim()
  const kind = String(formData.get('kind') ?? '').trim()
  const remove = String(formData.get('remove') ?? '').trim() === '1'
  if (!targetId || (targetType !== 'post' && targetType !== 'comment')) {
    return { error: 'Choose a post or a comment.' }
  }

  if (remove) {
    const { clearReaction } = await import('./reactions-store')
    const cleared = await clearReaction({
      actorUserId: gate.userId,
      targetType,
      targetId,
    })
    if (!cleared.ok) {
      if (cleared.reason === 'cannot_view' || cleared.reason === 'cannot_interact') {
        return { error: 'You cannot react to that.' }
      }
      return { error: 'Could not save the reaction.' }
    }
    revalidatePath('/feed')
    revalidatePath('/feed/post')
    return { ok: true, commentId: `${targetType}:${targetId}:clear` }
  }

  const { likeComment, likePost } = await import('./reactions-store')
  const result =
    targetType === 'comment'
      ? await likeComment({ actorUserId: gate.userId, commentId: targetId, kind })
      : await likePost({ actorUserId: gate.userId, postId: targetId, kind })
  if (!result.ok) {
    if (result.reason === 'disabled_kind') return { error: 'That reaction is turned off.' }
    if (result.reason === 'invalid_kind') return { error: 'Choose a reaction.' }
    if (result.reason === 'cannot_view' || result.reason === 'cannot_interact') {
      return { error: 'You cannot react to that.' }
    }
    return { error: 'Could not save the reaction.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true, commentId: `${targetType}:${targetId}:${result.reaction.kind}` }
}

/** Send a friend request from /feed/people. Mail failure does not roll back. */
export async function requestFriendAction(
  _prev: SocialPeopleActionState,
  formData: FormData,
): Promise<SocialPeopleActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }

  const result = await requestFriendshipNotifying(gate.userId, otherId)
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot request this member.' }
    if (result.reason === 'banned') return { error: 'You cannot request this member.' }
    if (result.reason === 'already_friends') return { error: 'You are already friends.' }
    if (result.reason === 'self') return { error: 'You cannot request yourself.' }
    return { error: 'Could not send the request.' }
  }

  revalidatePath('/feed/people')
  revalidatePath('/feed/requests')
  return { ok: true }
}

/** Accept an incoming friend request. */
export async function acceptFriendAction(
  _prev: SocialPeopleActionState,
  formData: FormData,
): Promise<SocialPeopleActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }

  const result = await acceptFriendship(gate.userId, otherId)
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot accept this request.' }
    return { error: 'Could not accept the request.' }
  }

  revalidatePath('/feed/people')
  revalidatePath('/feed/requests')
  revalidatePath('/feed')
  return { ok: true }
}

/** Decline an incoming friend request. */
export async function declineFriendAction(
  _prev: SocialPeopleActionState,
  formData: FormData,
): Promise<SocialPeopleActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }

  const result = await declineFriendship(gate.userId, otherId)
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot decline this request.' }
    return { error: 'Could not decline the request.' }
  }

  revalidatePath('/feed/people')
  revalidatePath('/feed/requests')
  return { ok: true }
}

/** Block a member from a post/comment ··· menu. */
export async function blockUserAction(
  _prev: SocialPeopleActionState,
  formData: FormData,
): Promise<SocialPeopleActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }
  if (otherId === gate.userId) return { error: 'You cannot block yourself.' }

  const result = await blockUser(gate.userId, otherId)
  if (!result.ok) {
    if (result.reason === 'self') return { error: 'You cannot block yourself.' }
    return { error: 'Could not block this member.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/people')
  revalidatePath('/feed/following')
  revalidatePath('/feed/post')
  revalidatePath('/feed/u')
  return { ok: true }
}

export type SocialModerationActionState = {
  error?: string
  ok?: boolean
}

/** Review queue: dismiss or hide an open report. */
export async function resolveSocialReportAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const reportId = String(formData.get('reportId') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!reportId) return { error: 'Missing report.' }
  if (status !== 'hidden' && status !== 'dismissed') {
    return { error: 'Choose Hide or Dismiss.' }
  }

  const result = await resolveReport(
    { actorUserId, reportId, status },
    { canManageReports: true, canManagePosts: true },
  )
  if (!result.ok) {
    if (result.reason === 'not_found') return { error: 'Report not found.' }
    if (result.reason === 'not_open') return { error: 'Report is already resolved.' }
    return { error: 'Could not resolve the report.' }
  }

  revalidatePath('/admin/social/reports')
  revalidatePath('/feed')
  return { ok: true }
}

export type SocialFollowActionState = {
  error?: string
  ok?: boolean
}

/** Follow a member. Refused when canInteract fails (block / hidden / banned). */
export async function followUserAction(
  _prev: SocialFollowActionState,
  formData: FormData,
): Promise<SocialFollowActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }

  const result = await followUser({
    followerUserId: gate.userId,
    followeeUserId: otherId,
  })
  if (!result.ok) {
    if (result.reason === 'blocked') return { error: 'You cannot follow this member.' }
    if (result.reason === 'cannot_interact' || result.reason === 'banned') {
      return { error: 'You cannot follow this member.' }
    }
    if (result.reason === 'self') return { error: 'You cannot follow yourself.' }
    return { error: 'Could not follow this member.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/following')
  revalidatePath('/feed/u')
  return { ok: true }
}

/** Unfollow a member. */
export async function unfollowUserAction(
  _prev: SocialFollowActionState,
  formData: FormData,
): Promise<SocialFollowActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const otherId = String(formData.get('userId') ?? '').trim()
  if (!otherId) return { error: 'Choose a member.' }

  const result = await unfollowUser(gate.userId, otherId)
  if (!result.ok) {
    if (result.reason === 'not_following') return { error: 'You are not following them.' }
    return { error: 'Could not unfollow this member.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/following')
  revalidatePath('/feed/u')
  return { ok: true }
}

export type SocialSaveActionState = {
  error?: string
  ok?: boolean
}

/** Save a post. Refused when canViewPost denies. */
export async function savePostAction(
  _prev: SocialSaveActionState,
  formData: FormData,
): Promise<SocialSaveActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a post.' }

  const result = await savePost({ userId: gate.userId, postId })
  if (!result.ok) {
    if (result.reason === 'cannot_view') {
      return { error: 'You cannot save a post you cannot see.' }
    }
    if (result.reason === 'banned') return { error: 'You cannot save posts right now.' }
    return { error: 'Could not save this post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/saved')
  revalidatePath('/feed/post')
  return { ok: true }
}

/** Remove a saved post bookmark. */
export async function unsavePostAction(
  _prev: SocialSaveActionState,
  formData: FormData,
): Promise<SocialSaveActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a post.' }

  const result = await unsavePost(gate.userId, postId)
  if (!result.ok) {
    if (result.reason === 'not_saved') return { error: 'This post is not saved.' }
    return { error: 'Could not unsave this post.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/saved')
  revalidatePath('/feed/post')
  return { ok: true }
}

export type SocialPollActionState = {
  error?: string
  ok?: boolean
}

/** Vote on a poll. Unique (postId, userId); refused when closed or blocked. */
export async function votePollAction(
  _prev: SocialPollActionState,
  formData: FormData,
): Promise<SocialPollActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }
  const rateLimited = await socialWriteRateLimited(gate.userId)
  if (rateLimited) return { error: rateLimited }

  const postId = String(formData.get('postId') ?? '').trim()
  const optionId = String(formData.get('optionId') ?? '').trim()
  if (!postId || !optionId) return { error: 'Choose a poll option.' }

  const result = await votePoll({
    userId: gate.userId,
    postId,
    optionId,
  })
  if (!result.ok) {
    if (result.reason === 'closed') return { error: 'This poll is closed.' }
    if (result.reason === 'blocked' || result.reason === 'cannot_interact') {
      return { error: 'You cannot vote on this poll.' }
    }
    if (result.reason === 'cannot_view' || result.reason === 'not_found') {
      return { error: 'That poll is not available.' }
    }
    if (result.reason === 'invalid_option') return { error: 'Choose a valid option.' }
    if (result.reason === 'banned') return { error: 'You cannot vote while banned.' }
    return { error: 'Could not record your vote.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true }
}

/** Author closes a poll — further edits are refused. */
export async function closePollAction(
  _prev: SocialPollActionState,
  formData: FormData,
): Promise<SocialPollActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a poll.' }

  const result = await closePoll({
    actorUserId: gate.userId,
    postId,
  })
  if (!result.ok) {
    if (result.reason === 'not_author') return { error: 'Only the author can close this poll.' }
    if (result.reason === 'not_found' || result.reason === 'not_poll') {
      return { error: 'That poll is not available.' }
    }
    return { error: 'Could not close this poll.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true }
}

/** Author edits an open poll. Closed polls are refused. */
export async function editPollAction(
  _prev: SocialPollActionState,
  formData: FormData,
): Promise<SocialPollActionState> {
  const gate = await requireSocialMember()
  if (!gate.ok) return { error: gate.error }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Choose a poll.' }

  const bodyRaw = formData.get('body')
  const body =
    bodyRaw == null ? undefined : sanitizeRichHtml(String(bodyRaw)).trim() || String(bodyRaw).trim()
  const pollOptionsRaw = String(formData.get('pollOptions') ?? '').trim()
  const options = pollOptionsRaw ? splitPollOptionInput(pollOptionsRaw) : undefined

  const result = await editPollPost({
    actorUserId: gate.userId,
    postId,
    body,
    options,
  })
  if (!result.ok) {
    if (result.reason === 'closed') {
      return { error: 'A closed poll cannot be edited.' }
    }
    if (result.reason === 'not_author') return { error: 'Only the author can edit this poll.' }
    if (result.reason === 'invalid') {
      return {
        error: `A poll needs ${POLL_OPTIONS_MIN}–${POLL_OPTIONS_MAX} distinct options.`,
      }
    }
    if (result.reason === 'not_found' || result.reason === 'not_poll') {
      return { error: 'That poll is not available.' }
    }
    return { error: 'Could not edit this poll.' }
  }

  revalidatePath('/feed')
  revalidatePath('/feed/post')
  return { ok: true }
}

/** Ban a member inside Social (sets bannedAt). */
export async function banSocialMemberAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing member.' }

  const result = await banMember(
    { actorUserId, userId },
    { canManageReports: true },
  )
  if (!result.ok) {
    if (result.reason === 'cannot_manage') return { error: 'Not allowed.' }
    return { error: 'Could not ban the member.' }
  }

  revalidatePath('/admin/social/reports')
  revalidatePath('/admin/social/people')
  return { ok: true }
}

/** Clear Social bannedAt for a member. */
export async function unbanSocialMemberAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing member.' }

  const result = await unbanMember(
    { actorUserId, userId },
    { canManageReports: true },
  )
  if (!result.ok) {
    if (result.reason === 'cannot_manage') return { error: 'Not allowed.' }
    if (result.reason === 'not_banned') return { error: 'That member is not banned.' }
    if (result.reason === 'not_found') return { error: 'Member not found.' }
    return { error: 'Could not unban the member.' }
  }

  revalidatePath('/admin/social/people')
  revalidatePath('/admin/social/reports')
  return { ok: true }
}

/** Staff hide or restore a post from the People admin list. */
export async function setSocialPostStaffHiddenAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) return { error: 'Missing post.' }
  const staffHidden = String(formData.get('staffHidden') ?? '') === '1'

  const result = await setPostStaffHidden(
    { actorUserId, postId, staffHidden },
    { canManagePosts: true },
  )
  if (!result.ok) {
    if (result.reason === 'cannot_manage') return { error: 'Not allowed.' }
    if (result.reason === 'not_found') return { error: 'Post not found.' }
    return { error: 'Could not update the post.' }
  }

  revalidatePath('/admin/social/people')
  revalidatePath('/admin/social/reports')
  revalidatePath('/feed')
  revalidatePath(`/feed/post/${postId}`)
  return { ok: true }
}

export type SocialSettingsActionState = {
  error?: string
  ok?: boolean
  message?: string
}

/** Save composer/feed fields. Merges onto the loaded document (does not wipe 15c). */
export async function saveSocialSettingsAction(
  _prev: SocialSettingsActionState,
  formData: FormData,
): Promise<SocialSettingsActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const {
    decideSocialPackSettings,
    socialPackSettingsError,
    socialComposerSettingsFromForm,
  } = await import('./pack-settings')
  const { loadSocialModuleSettings, saveSocialModuleSettings } = await import('./settings')
  const loaded = await loadSocialModuleSettings()
  const decision = decideSocialPackSettings({
    ...loaded.settings,
    ...socialComposerSettingsFromForm(formData),
  })
  if (!decision.ok) return { error: socialPackSettingsError(decision.reason) }

  try {
    const saved = await saveSocialModuleSettings(decision.settings)
    revalidatePath('/admin/social')
    revalidatePath('/admin/social/settings')
    revalidatePath('/admin/social/people')
    revalidatePath('/admin/social/groups')
    revalidatePath('/admin/social/pages')
    revalidatePath('/admin/social/media')
    revalidatePath('/feed')
    return {
      ok: true,
      message: `Social settings saved (default audience ${saved.defaultPostAudience}).`,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save Social settings.',
    }
  }
}

/** Save people / reactions / reports fields. Merges onto the loaded document. */
export async function saveSocialPeopleSettingsAction(
  _prev: SocialSettingsActionState,
  formData: FormData,
): Promise<SocialSettingsActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const {
    decideSocialPackSettings,
    socialPackSettingsError,
    socialPeopleSettingsFromForm,
  } = await import('./pack-settings')
  const { loadSocialModuleSettings, saveSocialModuleSettings } = await import('./settings')
  const loaded = await loadSocialModuleSettings()
  const decision = decideSocialPackSettings({
    ...loaded.settings,
    ...socialPeopleSettingsFromForm(formData),
  })
  if (!decision.ok) return { error: socialPackSettingsError(decision.reason) }

  try {
    await saveSocialModuleSettings(decision.settings)
    revalidatePath('/admin/social')
    revalidatePath('/admin/social/people')
    revalidatePath('/admin/social/groups')
    revalidatePath('/admin/social/pages')
    revalidatePath('/admin/social/media')
    revalidatePath('/feed')
    return { ok: true, message: 'People and reactions settings saved.' }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save people settings.',
    }
  }
}

/** Save groups pack fields. Merges onto the loaded document. */
export async function saveSocialGroupsSettingsAction(
  _prev: SocialSettingsActionState,
  formData: FormData,
): Promise<SocialSettingsActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const {
    decideSocialPackSettings,
    socialPackSettingsError,
    socialGroupsSettingsFromForm,
  } = await import('./pack-settings')
  const { loadSocialModuleSettings, saveSocialModuleSettings } = await import('./settings')
  const loaded = await loadSocialModuleSettings()
  const decision = decideSocialPackSettings({
    ...loaded.settings,
    ...socialGroupsSettingsFromForm(formData),
  })
  if (!decision.ok) return { error: socialPackSettingsError(decision.reason) }

  try {
    await saveSocialModuleSettings(decision.settings)
    revalidatePath('/admin/social')
    revalidatePath('/admin/social/groups')
    revalidatePath('/admin/social/pages')
    revalidatePath('/admin/social/media')
    revalidatePath('/feed/groups')
    return { ok: true, message: 'Groups settings saved.' }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save groups settings.',
    }
  }
}

/** Save pages pack fields. Merges onto the loaded document. */
export async function saveSocialPagesSettingsAction(
  _prev: SocialSettingsActionState,
  formData: FormData,
): Promise<SocialSettingsActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const {
    decideSocialPackSettings,
    socialPackSettingsError,
    socialPagesSettingsFromForm,
  } = await import('./pack-settings')
  const { loadSocialModuleSettings, saveSocialModuleSettings } = await import('./settings')
  const loaded = await loadSocialModuleSettings()
  const decision = decideSocialPackSettings({
    ...loaded.settings,
    ...socialPagesSettingsFromForm(formData),
  })
  if (!decision.ok) return { error: socialPackSettingsError(decision.reason) }

  try {
    await saveSocialModuleSettings(decision.settings)
    revalidatePath('/admin/social')
    revalidatePath('/admin/social/groups')
    revalidatePath('/admin/social/pages')
    revalidatePath('/admin/social/media')
    revalidatePath('/feed/pages')
    return { ok: true, message: 'Pages settings saved.' }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save pages settings.',
    }
  }
}

/** Save stories / albums / media / challenge fields. Merges onto the loaded document. */
export async function saveSocialMediaSettingsAction(
  _prev: SocialSettingsActionState,
  formData: FormData,
): Promise<SocialSettingsActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const {
    decideSocialPackSettings,
    socialPackSettingsError,
    socialMediaSettingsFromForm,
  } = await import('./pack-settings')
  const { loadSocialModuleSettings, saveSocialModuleSettings } = await import('./settings')
  const loaded = await loadSocialModuleSettings()
  const decision = decideSocialPackSettings({
    ...loaded.settings,
    ...socialMediaSettingsFromForm(formData),
  })
  if (!decision.ok) return { error: socialPackSettingsError(decision.reason) }

  try {
    await saveSocialModuleSettings(decision.settings)
    revalidatePath('/admin/social')
    revalidatePath('/admin/social/media')
    revalidatePath('/admin/social/groups')
    revalidatePath('/admin/social/pages')
    revalidatePath('/feed')
    revalidatePath('/feed/stories')
    return { ok: true, message: 'Stories, albums, media, and challenge settings saved.' }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save media settings.',
    }
  }
}

/** Create a group category from `/admin/social/groups`. */
export async function createSocialGroupCategoryAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim() || undefined
  const kind = String(formData.get('kind') ?? '').trim()
  if (!name) return { error: 'Name the category.' }
  if (!kind) return { error: 'Choose a category kind.' }

  const result = await createGroupCategory({ name, slug, kind })
  if (!result.ok) {
    if (result.reason === 'invalid_kind') {
      return { error: 'Category kind must be general, team, or association.' }
    }
    if (result.reason === 'slug_taken') return { error: 'That category slug is taken.' }
    return { error: 'Could not create the category.' }
  }

  revalidatePath('/admin/social/groups')
  revalidatePath('/feed/groups')
  return { ok: true }
}

/** Verify or clear verifiedAt on a group. */
export async function setSocialGroupVerifiedAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  if (!groupId) return { error: 'Missing group.' }
  const verified = String(formData.get('verified') ?? '') === '1'

  const result = await setGroupVerified(groupId, verified)
  if (!result.ok) {
    if (result.reason === 'not_found') return { error: 'Group not found.' }
    return { error: 'Could not update the group.' }
  }

  revalidatePath('/admin/social/groups')
  revalidatePath('/feed/groups')
  revalidatePath('/feed/g')
  return { ok: true }
}

/** Verify or clear verifiedAt on a page. */
export async function setSocialPageVerifiedAction(
  _prev: SocialModerationActionState,
  formData: FormData,
): Promise<SocialModerationActionState> {
  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.social)) {
    return { error: 'Social is disabled.' }
  }

  const session = await requireAdminArea('admin.social', 'manage')
  const actorUserId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!actorUserId) {
    return { error: 'Sign in with Social admin access (Users → ACL) or as an app admin.' }
  }

  const pageId = String(formData.get('pageId') ?? '').trim()
  if (!pageId) return { error: 'Missing page.' }
  const verified = String(formData.get('verified') ?? '') === '1'

  const result = await setPageVerified(pageId, verified)
  if (!result.ok) {
    if (result.reason === 'not_found') return { error: 'Page not found.' }
    return { error: 'Could not update the page.' }
  }

  revalidatePath('/admin/social/pages')
  revalidatePath('/feed/pages')
  revalidatePath('/feed/p')
  return { ok: true }
}
