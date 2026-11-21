/**
 * product:social → Email Manager emits (emitEmailTrigger only).
 * Never call getMailer() here. Soft-fail so friendship / challenge writes stay.
 */

import 'server-only'

import {
  SOCIAL_CHALLENGE_INVITED_TRIGGER,
  SOCIAL_FRIEND_REQUESTED_TRIGGER,
  SOCIAL_GROUP_ANNOUNCED_TRIGGER,
  SOCIAL_GROUP_INVITED_TRIGGER,
} from './triggers'

export {
  SOCIAL_CHALLENGE_INVITED_TRIGGER,
  SOCIAL_FRIEND_REQUESTED_TRIGGER,
  SOCIAL_GROUP_ANNOUNCED_TRIGGER,
  SOCIAL_GROUP_INVITED_TRIGGER,
}

export async function emitFriendRequestedEmail(payload: {
  requesterId: string
  addresseeId: string
  friendshipId: string
  addresseeEmail?: string
}): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({
      triggerKey: SOCIAL_FRIEND_REQUESTED_TRIGGER,
      payload: {
        requesterId: payload.requesterId,
        addresseeId: payload.addresseeId,
        friendshipId: payload.friendshipId,
        addresseeEmail: payload.addresseeEmail ?? '',
      },
    })
  } catch {
    // Soft-fail — request must not depend on mail.
  }
}

export async function emitChallengeInvitedEmail(payload: {
  challengeId: string
  entryId: string
  creatorUserId: string
  inviteeUserId: string
  inviteeEmail?: string
}): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({
      triggerKey: SOCIAL_CHALLENGE_INVITED_TRIGGER,
      payload: {
        challengeId: payload.challengeId,
        entryId: payload.entryId,
        creatorUserId: payload.creatorUserId,
        inviteeUserId: payload.inviteeUserId,
        inviteeEmail: payload.inviteeEmail ?? '',
      },
    })
  } catch {
    // Soft-fail — invite must not depend on mail.
  }
}

export async function emitGroupInvitedEmail(payload: {
  groupId: string
  membershipId: string
  inviterUserId: string
  inviteeUserId: string
  inviteeEmail?: string
}): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({
      triggerKey: SOCIAL_GROUP_INVITED_TRIGGER,
      payload: {
        groupId: payload.groupId,
        membershipId: payload.membershipId,
        inviterUserId: payload.inviterUserId,
        inviteeUserId: payload.inviteeUserId,
        inviteeEmail: payload.inviteeEmail ?? '',
      },
    })
  } catch {
    // Soft-fail — invite must not depend on mail.
  }
}

export async function emitGroupAnnouncedEmail(payload: {
  groupId: string
  postId: string
  actorUserId: string
}): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({
      triggerKey: SOCIAL_GROUP_ANNOUNCED_TRIGGER,
      payload: {
        groupId: payload.groupId,
        postId: payload.postId,
        actorUserId: payload.actorUserId,
      },
    })
  } catch {
    // Soft-fail — the announcement pin must not depend on mail.
  }
}
