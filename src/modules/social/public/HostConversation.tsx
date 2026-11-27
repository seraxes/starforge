'use client'

/**
 * Shared comment controls for event / CMS page chrome.
 * Reuses PostConversation without Share or feed-style collapse.
 */

import React from 'react'

import type {
  ReactionIconColors,
  ReactionIconImageUrls,
  ReactionIcons,
  ReactionKind,
} from '../reactions'
import {
  PostConversation,
  type ConversationComment,
  type ConversationReaction,
} from './PostConversation'

export type HostConversationProps = {
  postId: string
  postAuthorUserId: string
  comments: ConversationComment[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  canModerate?: boolean
  reactorNames?: Readonly<Record<string, string>>
  reactionKinds: ReactionKind[]
  reactionIcons?: ReactionIcons | null
  reactionIconColors?: ReactionIconColors | null
  reactionIconImageUrls?: ReactionIconImageUrls | null
  showReactionLabels?: boolean
  reactionIconSizePx?: number
  reactionTrayHoverSizePx?: number
  reactionTrayHoverEasing?: string
  allowComments: boolean
  allowCommentReactions: boolean
  commentLengthLimit: number
}

export function HostConversation({
  postId,
  postAuthorUserId,
  comments,
  reactions,
  viewerUserId,
  canModerate = false,
  reactorNames = {},
  reactionKinds,
  reactionIcons = null,
  reactionIconColors = null,
  reactionIconImageUrls = null,
  showReactionLabels = true,
  reactionIconSizePx = 16,
  reactionTrayHoverSizePx = 28,
  reactionTrayHoverEasing = 'ease',
  allowComments,
  allowCommentReactions,
  commentLengthLimit,
}: HostConversationProps) {
  return (
    <PostConversation
      postId={postId}
      postKind="conversation"
      postAuthorUserId={postAuthorUserId}
      comments={comments}
      reactions={reactions}
      viewerUserId={viewerUserId}
      canModerate={canModerate}
      reactorNames={reactorNames}
      reactionKinds={reactionKinds}
      reactionIcons={reactionIcons}
      reactionIconColors={reactionIconColors}
      reactionIconImageUrls={reactionIconImageUrls}
      showReactionLabels={showReactionLabels}
      reactionIconSizePx={reactionIconSizePx}
      reactionTrayHoverSizePx={reactionTrayHoverSizePx}
      reactionTrayHoverEasing={reactionTrayHoverEasing}
      allowComments={allowComments}
      allowCommentReactions={allowCommentReactions}
      commentLengthLimit={commentLengthLimit}
      showShare={false}
      commentsExpanded
    />
  )
}
