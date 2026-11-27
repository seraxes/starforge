/**
 * Server mount for event / CMS page conversations.
 * Social off or cannot_view → render nothing (no error).
 */

import React from 'react'

import {
  loadHostConversationSurface,
  type HostConversationSurface,
} from '../host-conversation-surface'
import type { HostConversationModule } from '../host-conversation'
import { HostConversation } from './HostConversation'
import type { ConversationComment, ConversationReaction } from './PostConversation'

function toConversationComments(
  surface: HostConversationSurface,
): ConversationComment[] {
  return surface.comments.map((comment) => ({
    id: comment.id,
    postId: surface.postId,
    authorUserId: comment.authorUserId,
    authorName: comment.authorName,
    authorHref: null,
    authorAvatarSrc: null,
    body: comment.body,
    parentCommentId: comment.parentCommentId,
    staffHidden: comment.staffHidden,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
  }))
}

function toConversationReactions(
  surface: HostConversationSurface,
): ConversationReaction[] {
  return surface.reactions.map((row) => ({
    actorUserId: row.actorUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    kind: row.kind,
  }))
}

export async function HostConversationMount(props: {
  hostModule: HostConversationModule
  hostId: string
  hostPath?: string | null
  /** Host page already gated visibility (public event/page detail). */
  viewerAlreadyCanView?: boolean
  className?: string
  heading?: string
}) {
  const result = await loadHostConversationSurface({
    hostModule: props.hostModule,
    hostId: props.hostId,
    hostPath: props.hostPath,
    viewerAlreadyCanView: props.viewerAlreadyCanView,
  })
  if (!result.ok) return null

  const { surface } = result
  if (!surface.allowComments && surface.comments.length === 0) return null

  return (
    <section
      className={props.className ?? 'sf-host-conversation'}
      aria-label={props.heading ?? 'Comments'}
    >
      {props.heading ? <h2 className="sf-host-conversation-heading">{props.heading}</h2> : null}
      <HostConversation
        postId={surface.postId}
        postAuthorUserId={surface.postAuthorUserId}
        comments={toConversationComments(surface)}
        reactions={toConversationReactions(surface)}
        viewerUserId={surface.viewerUserId}
        canModerate={surface.canModerate}
        reactorNames={surface.reactorNames}
        reactionKinds={surface.reactionKinds}
        reactionIcons={surface.reactionIcons}
        reactionIconColors={surface.reactionIconColors}
        reactionIconImageUrls={surface.reactionIconImageUrls}
        showReactionLabels={surface.showReactionLabels}
        reactionIconSizePx={surface.reactionIconSizePx}
        reactionTrayHoverSizePx={surface.reactionTrayHoverSizePx}
        reactionTrayHoverEasing={surface.reactionTrayHoverEasing}
        allowComments={surface.allowComments}
        allowCommentReactions={surface.allowCommentReactions}
        commentLengthLimit={surface.commentLengthLimit}
      />
    </section>
  )
}
