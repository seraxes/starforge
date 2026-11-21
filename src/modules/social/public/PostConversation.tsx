'use client'

import React, { useActionState, useState } from 'react'
import Link from 'next/link'

import {
  createCommentAction,
  deleteCommentAction,
  editCommentAction,
  setReactionAction,
  type SocialCommentActionState,
} from '../actions'
import type { ReactionKind } from '../reactions'

const initial: SocialCommentActionState = {}

const REACTION_LABEL: Record<ReactionKind, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
}

export type ConversationComment = {
  id: string
  postId: string
  authorUserId: string
  authorName: string
  authorHref: string | null
  body: string
  parentCommentId: string | null
  createdAt: string
  editedAt: string | null
}

export type ConversationReaction = {
  actorUserId: string
  targetType: 'post' | 'comment'
  targetId: string
  kind: ReactionKind
}

function ReactionButton({
  targetType,
  targetId,
  kind,
  count,
  pressed,
}: {
  targetType: 'post' | 'comment'
  targetId: string
  kind: ReactionKind
  count: number
  pressed: boolean
}) {
  const [state, formAction, pending] = useActionState(setReactionAction, initial)
  return (
    <form action={formAction}>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        className={pressed ? 'secondary' : 'ghost'}
        aria-pressed={pressed}
        disabled={pending}
      >
        {REACTION_LABEL[kind]}
        {count > 0 ? ` ${count}` : ''}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function ReactionBar({
  targetType,
  targetId,
  kinds,
  reactions,
  viewerUserId,
  label,
}: {
  targetType: 'post' | 'comment'
  targetId: string
  kinds: ReactionKind[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  label: string
}) {
  const mine = reactions.find(
    (row) =>
      row.targetType === targetType &&
      row.targetId === targetId &&
      row.actorUserId === viewerUserId,
  )
  return (
    <div className="sf-social-reactions" role="group" aria-label={label}>
      {kinds.map((kind) => {
        const count = reactions.filter(
          (row) => row.targetType === targetType && row.targetId === targetId && row.kind === kind,
        ).length
        const pressed = mine?.kind === kind
        if (!viewerUserId) {
          return count > 0 ? (
            <span key={kind} className="sf-social-reaction-count">
              {REACTION_LABEL[kind]} {count}
            </span>
          ) : null
        }
        return (
          <ReactionButton
            key={kind}
            targetType={targetType}
            targetId={targetId}
            kind={kind}
            count={count}
            pressed={pressed}
          />
        )
      })}
    </div>
  )
}

function CommentForm({
  postId,
  parentCommentId,
  placeholder,
  submitLabel,
  maxLength,
}: {
  postId: string
  parentCommentId?: string
  placeholder: string
  submitLabel: string
  maxLength: number
}) {
  const [state, formAction, pending] = useActionState(createCommentAction, initial)
  return (
    <form action={formAction} className="sf-social-comment-form">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentCommentId" value={parentCommentId ?? ''} />
      <input
        type="text"
        name="body"
        className="sf-social-comment-input"
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={pending}
        required
      />
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Posting…' : submitLabel}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function CommentManage({
  comment,
  canManage,
  commentLengthLimit,
}: {
  comment: ConversationComment
  canManage: boolean
  commentLengthLimit: number
}) {
  const [editing, setEditing] = useState(false)
  const [editState, editAction, editPending] = useActionState(editCommentAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCommentAction,
    initial,
  )
  if (!canManage) return null

  return (
    <div className="sf-social-comment-manage">
      {editing ? (
        <form action={editAction} className="sf-social-comment-form">
          <input type="hidden" name="commentId" value={comment.id} />
          <input
            type="text"
            name="body"
            className="sf-social-comment-input"
            defaultValue={comment.body}
            maxLength={commentLengthLimit}
            disabled={editPending}
            required
            aria-label="Edit comment"
          />
          <button type="submit" className="secondary" disabled={editPending}>
            {editPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={editPending}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          {editState.error ? (
            <p className="admin-inline-error" role="alert">
              {editState.error}
            </p>
          ) : null}
        </form>
      ) : (
        <>
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="commentId" value={comment.id} />
            <button type="submit" className="ghost" disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </button>
          </form>
          {deleteState.error ? (
            <p className="admin-inline-error" role="alert">
              {deleteState.error}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

function CommentItem({
  comment,
  depth,
  replyToName,
  repliesOf,
  viewerUserId,
  canModerate,
  reactionKinds,
  reactions,
  allowCommentReactions,
  allowReplies,
  commentLengthLimit,
}: {
  comment: ConversationComment
  /** 0 = comment on the post, 1 = reply, 2 = reply to that reply. */
  depth: 0 | 1 | 2
  replyToName: string | null
  repliesOf: (id: string) => ConversationComment[]
  viewerUserId: string | null
  canModerate: boolean
  reactionKinds: ReactionKind[]
  reactions: ConversationReaction[]
  allowCommentReactions: boolean
  allowReplies: boolean
  commentLengthLimit: number
}) {
  const [replying, setReplying] = useState(false)
  const children = depth < 2 ? repliesOf(comment.id) : []
  const canReply = allowReplies && depth < 2 && Boolean(viewerUserId)
  const canManage =
    Boolean(viewerUserId) &&
    (canModerate || comment.authorUserId === viewerUserId)
  return (
    <li className={`sf-social-comment sf-social-comment-depth-${depth}`}>
      {replyToName ? (
        <p className="sf-social-reply-to">Reply to {replyToName}</p>
      ) : null}
      <p className="sf-social-comment-head">
        {comment.authorHref ? (
          <Link href={comment.authorHref}>{comment.authorName}</Link>
        ) : (
          <span>{comment.authorName}</span>
        )}
        <time className="layout-muted" dateTime={comment.createdAt}>
          {comment.createdAt.slice(0, 16).replace('T', ' ')}
        </time>
        {comment.editedAt ? (
          <span className="layout-muted"> · edited</span>
        ) : null}
      </p>
      <p className="sf-social-comment-body">{comment.body}</p>
      {allowCommentReactions ? (
        <ReactionBar
          targetType="comment"
          targetId={comment.id}
          kinds={reactionKinds}
          reactions={reactions}
          viewerUserId={viewerUserId}
          label={`Reactions on ${comment.authorName}'s comment`}
        />
      ) : null}
      <div className="sf-social-comment-actions">
        {canReply ? (
          <button type="button" className="ghost" onClick={() => setReplying((open) => !open)}>
            {replying ? 'Cancel reply' : 'Reply'}
          </button>
        ) : null}
        <CommentManage
          comment={comment}
          canManage={canManage}
          commentLengthLimit={commentLengthLimit}
        />
      </div>
      {replying ? (
        <CommentForm
          postId={comment.postId}
          parentCommentId={comment.id}
          placeholder={`Reply to ${comment.authorName}…`}
          submitLabel="Reply"
          maxLength={commentLengthLimit}
        />
      ) : null}
      {children.length > 0 ? (
        <ul className="sf-social-replies">
          {children.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={(depth + 1) as 1 | 2}
              replyToName={comment.authorName}
              repliesOf={repliesOf}
              viewerUserId={viewerUserId}
              canModerate={canModerate}
              reactionKinds={reactionKinds}
              reactions={reactions}
              allowCommentReactions={allowCommentReactions}
              allowReplies={allowReplies}
              commentLengthLimit={commentLengthLimit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Comments and reactions under one post. Two reply levels, then it stops. */
export function PostConversation({
  postId,
  comments,
  reactions,
  viewerUserId,
  canModerate = false,
  reactionKinds,
  allowComments,
  allowCommentReactions,
  commentLengthLimit,
}: {
  postId: string
  comments: ConversationComment[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  /** Social staff may edit/delete any comment. */
  canModerate?: boolean
  reactionKinds: ReactionKind[]
  allowComments: boolean
  allowCommentReactions: boolean
  commentLengthLimit: number
}) {
  const tops = comments.filter((comment) => !comment.parentCommentId)
  const repliesOf = (id: string) =>
    comments.filter((comment) => comment.parentCommentId === id)

  return (
    <section className="sf-social-conversation" aria-label="Comments">
      {reactionKinds.length > 0 ? (
        <ReactionBar
          targetType="post"
          targetId={postId}
          kinds={reactionKinds}
          reactions={reactions}
          viewerUserId={viewerUserId}
          label="Reactions"
        />
      ) : null}
      {tops.length > 0 ? (
        <ul className="sf-social-comments">
          {tops.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              replyToName={null}
              repliesOf={repliesOf}
              viewerUserId={viewerUserId}
              canModerate={canModerate}
              reactionKinds={reactionKinds}
              reactions={reactions}
              allowCommentReactions={allowCommentReactions}
              allowReplies={allowComments}
              commentLengthLimit={commentLengthLimit}
            />
          ))}
        </ul>
      ) : null}
      {allowComments && viewerUserId ? (
        <CommentForm
          postId={postId}
          placeholder="Write a comment…"
          submitLabel="Comment"
          maxLength={commentLengthLimit}
        />
      ) : null}
    </section>
  )
}
