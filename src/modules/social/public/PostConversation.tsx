'use client'

import React, { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createCommentAction,
  editCommentAction,
  setReactionAction,
  type SocialCommentActionState,
} from '../actions'
import { shareAudienceIsWider, type PostAudience } from '../posts'
import type {
  ReactionIconColors,
  ReactionIconImageUrls,
  ReactionIcons,
  ReactionKind,
} from '../reactions'
import { HideableShell } from './HideableShell'
import { CommentOptionsMenu } from './SocialOptionsMenu'
import { SharePostActions } from './SharePostActions'
import { SocialAvatar } from './SocialAvatar'
import { useDismissible } from './useDismissible'

const initial: SocialCommentActionState = {}

const REACTION_LABEL: Record<ReactionKind, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
}

const REACTION_ORDER: ReactionKind[] = ['like', 'love', 'haha', 'wow', 'sad', 'angry']

/** Latest top-level comments kept on a collapsed feed card. */
const COMMENT_PREVIEW = 2

export type ConversationComment = {
  id: string
  postId: string
  authorUserId: string
  authorName: string
  authorHref: string | null
  authorAvatarSrc?: string | null
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

function compactTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso.slice(0, 16).replace('T', ' ')
  const minutes = Math.floor((Date.now() - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return iso.slice(0, 10)
}

function rowsFor(
  reactions: ConversationReaction[],
  targetType: 'post' | 'comment',
  targetId: string,
): ConversationReaction[] {
  return reactions.filter((row) => row.targetType === targetType && row.targetId === targetId)
}

function peopleLabel(
  rows: ConversationReaction[],
  names: Readonly<Record<string, string>>,
): string {
  const seen = new Set<string>()
  const people: string[] = []
  for (const row of rows) {
    if (seen.has(row.actorUserId)) continue
    seen.add(row.actorUserId)
    people.push(names[row.actorUserId] || 'Someone')
  }
  if (people.length === 0) return ''
  if (people.length === 1) return people[0] ?? ''
  if (people.length === 2) return `${people[0]} and ${people[1]}`
  return `${people[0]} and ${people.length - 1} others`
}

function hasReactionVisual(
  kind: ReactionKind,
  icons: ReactionIcons | null,
  imageUrls: ReactionIconImageUrls | null | undefined,
): boolean {
  return Boolean(imageUrls?.[kind]?.trim() || icons?.[kind]?.trim())
}

function ReactionGlyph({
  kind,
  icons,
  colors,
  imageUrls,
  sizePx,
}: {
  kind: ReactionKind
  icons: ReactionIcons | null
  colors?: ReactionIconColors | null
  imageUrls?: ReactionIconImageUrls | null
  /** When set (tray popup only), overrides default glyph size. */
  sizePx?: number
}) {
  const imageUrl = imageUrls?.[kind]?.trim()
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Media library / pack icon
      <img
        className="sf-social-reaction-glyph sf-social-reaction-glyph-img"
        src={imageUrl}
        alt=""
        aria-hidden
        style={sizePx != null ? { width: sizePx, height: sizePx } : undefined}
      />
    )
  }
  const className = icons?.[kind]?.trim()
  if (!className) return null
  const color = colors?.[kind]?.trim()
  return (
    <i
      className={`sf-social-reaction-glyph ${className}`}
      aria-hidden
      style={{
        ...(color ? { color } : null),
        ...(sizePx != null ? { fontSize: `${sizePx}px` } : null),
      }}
    />
  )
}

function SummaryKinds({
  rows,
  icons,
  colors,
  imageUrls,
}: {
  rows: ConversationReaction[]
  icons: ReactionIcons | null
  colors?: ReactionIconColors | null
  imageUrls?: ReactionIconImageUrls | null
}) {
  const counts = new Map<ReactionKind, number>()
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1)
  const parts = REACTION_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0)
  if (parts.length === 0) return null
  return (
    <span className="sf-social-reaction-summary">
      {parts.map((kind, index) => (
        <span key={kind} className="sf-social-reaction-summary-part">
          {index > 0 ? <span className="sf-social-reaction-summary-sep"> · </span> : null}
          <ReactionGlyph kind={kind} icons={icons} colors={colors} imageUrls={imageUrls} />
          <span>
            {hasReactionVisual(kind, icons, imageUrls) ? '' : `${REACTION_LABEL[kind]} `}
            {counts.get(kind)}
          </span>
        </span>
      ))}
    </span>
  )
}

function ReactionSubmit({
  targetType,
  targetId,
  kind,
  remove,
  className,
  pressed,
  pendingLabel,
  children,
  onPointerDown,
  onPointerUp,
  onClick,
  onSuccess,
}: {
  targetType: 'post' | 'comment'
  targetId: string
  kind: ReactionKind
  remove: boolean
  className?: string
  pressed?: boolean
  pendingLabel?: string
  children: React.ReactNode
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(setReactionAction, initial)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (!state.ok) return
    onSuccessRef.current?.()
    router.refresh()
  }, [state, router])
  return (
    <form action={formAction} className="sf-social-react-form">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      {remove ? (
        <input type="hidden" name="remove" value="1" />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      <button
        type="submit"
        className={className}
        aria-pressed={pressed}
        disabled={pending}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        {pending ? pendingLabel ?? '…' : children}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

/** One Like control. Hover, keyboard focus, or a touch hold opens the other kinds. */
function ReactionControl({
  targetType,
  targetId,
  kinds,
  reactions,
  reactionIcons,
  reactionIconColors,
  reactionIconImageUrls,
  showReactionLabels,
  reactionIconSizePx,
  viewerUserId,
  layout,
}: {
  targetType: 'post' | 'comment'
  targetId: string
  kinds: ReactionKind[]
  reactions: ConversationReaction[]
  reactionIcons: ReactionIcons | null
  reactionIconColors?: ReactionIconColors | null
  reactionIconImageUrls?: ReactionIconImageUrls | null
  showReactionLabels: boolean
  reactionIconSizePx: number
  viewerUserId: string | null
  layout: 'bar' | 'inline'
}) {
  const [open, setOpen] = useState(false)
  const trayRef = useDismissible<HTMLDivElement>(open, () => setOpen(false))
  const holdTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const rows = rowsFor(reactions, targetType, targetId)
  const mine = viewerUserId
    ? rows.find((row) => row.actorUserId === viewerUserId) ?? null
    : null
  const total = rows.length
  const showTray = kinds.length > 1
  const label = mine ? REACTION_LABEL[mine.kind] : 'Like'

  function clearHold() {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function clearClose() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function openTray() {
    clearClose()
    if (showTray) setOpen(true)
  }

  function scheduleCloseTray() {
    clearHold()
    clearClose()
    // Brief delay so the pointer can cross the gap into the tray.
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setOpen(false)
    }, 220)
  }

  useEffect(() => {
    return () => {
      clearHold()
      clearClose()
    }
  }, [])

  if (!viewerUserId) {
    if (total === 0) return null
    return (
      <span className="sf-social-reaction-count">
        <SummaryKinds
          rows={rows}
          icons={reactionIcons}
          colors={reactionIconColors}
          imageUrls={reactionIconImageUrls}
        />
      </span>
    )
  }

  const mainKind = mine?.kind ?? 'like'
  const mainWord = mine?.kind === 'like' ? 'Liked' : label
  const hasIcon = hasReactionVisual(mainKind, reactionIcons, reactionIconImageUrls)
  const showMainLabel = showReactionLabels || !hasIcon

  return (
    <div
      ref={trayRef}
      className={open ? `sf-social-react is-open sf-social-react-${layout}` : `sf-social-react sf-social-react-${layout}`}
      onMouseEnter={openTray}
      onMouseLeave={scheduleCloseTray}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        clearClose()
        setOpen(false)
      }}
    >
      <ReactionSubmit
        targetType={targetType}
        targetId={targetId}
        kind={mainKind}
        remove={Boolean(mine)}
        pressed={Boolean(mine)}
        className={mine ? 'is-selected' : undefined}
        pendingLabel={mine ? 'Removing…' : 'Liking…'}
        onSuccess={() => setOpen(false)}
        onPointerDown={(event) => {
          if (!showTray || event.pointerType === 'mouse') return
          suppressClick.current = false
          clearHold()
          holdTimer.current = window.setTimeout(() => {
            suppressClick.current = true
            setOpen(true)
          }, 450)
        }}
        onPointerUp={clearHold}
        onClick={(event) => {
          if (!suppressClick.current) return
          event.preventDefault()
          suppressClick.current = false
        }}
      >
        <ReactionGlyph
          kind={mainKind}
          icons={reactionIcons}
          colors={reactionIconColors}
          imageUrls={reactionIconImageUrls}
        />
        {showMainLabel ? <span>{mainWord}</span> : <span className="sr-only">{mainWord}</span>}
        {layout === 'inline' && total > 0 ? <span className="sf-social-reaction-count"> {total}</span> : null}
      </ReactionSubmit>
      {showTray && open ? (
        <div className="sf-social-react-tray" role="group" aria-label="Reactions">
          {kinds.map((kind) => {
            const choiceHasIcon = hasReactionVisual(kind, reactionIcons, reactionIconImageUrls)
            const showChoiceLabel = showReactionLabels || !choiceHasIcon
            return (
              <ReactionSubmit
                key={kind}
                targetType={targetType}
                targetId={targetId}
                kind={kind}
                remove={mine?.kind === kind}
                pressed={mine?.kind === kind}
                className={mine?.kind === kind ? 'sf-social-react-choice is-selected' : 'sf-social-react-choice'}
                onSuccess={() => setOpen(false)}
              >
                <ReactionGlyph
                  kind={kind}
                  icons={reactionIcons}
                  colors={reactionIconColors}
                  imageUrls={reactionIconImageUrls}
                  sizePx={reactionIconSizePx}
                />
                {showChoiceLabel ? (
                  <span>{REACTION_LABEL[kind]}</span>
                ) : (
                  <span className="sr-only">{REACTION_LABEL[kind]}</span>
                )}
              </ReactionSubmit>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function CommentForm({
  postId,
  parentCommentId,
  placeholder,
  submitLabel,
  maxLength,
  focusKey,
  onSuccess,
}: {
  postId: string
  parentCommentId?: string
  placeholder: string
  submitLabel: string
  maxLength: number
  focusKey?: number
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createCommentAction, initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (focusKey && focusKey > 0) inputRef.current?.focus()
  }, [focusKey])
  useEffect(() => {
    if (!state.ok) return
    if (inputRef.current) inputRef.current.value = ''
    onSuccessRef.current?.()
    router.refresh()
  }, [state, router])
  return (
    <form action={formAction} className="sf-social-comment-form">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentCommentId" value={parentCommentId ?? ''} />
      <input
        ref={inputRef}
        type="text"
        name="body"
        className="sf-social-comment-input"
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={pending}
        required
        aria-label={placeholder}
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

function CommentEditForm({
  comment,
  commentLengthLimit,
  onCancel,
}: {
  comment: ConversationComment
  commentLengthLimit: number
  onCancel: () => void
}) {
  const router = useRouter()
  const [editState, editAction, editPending] = useActionState(editCommentAction, initial)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  useEffect(() => {
    if (!editState.ok) return
    onCancelRef.current()
    router.refresh()
  }, [editState, router])
  return (
    <form action={editAction} className="sf-social-comment-form sf-social-comment-edit">
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
        onClick={onCancel}
      >
        Cancel
      </button>
      {editState.error ? (
        <p className="admin-inline-error" role="alert">
          {editState.error}
        </p>
      ) : null}
    </form>
  )
}

function CommentRow({
  comment,
  replyToName,
  viewerUserId,
  canModerate,
  reactionKinds,
  reactions,
  reactionIcons,
  reactionIconColors,
  reactionIconImageUrls,
  showReactionLabels,
  reactionIconSizePx,
  allowCommentReactions,
  canReply,
  onReply,
  commentLengthLimit,
  postAuthorUserId,
}: {
  comment: ConversationComment
  replyToName: string | null
  viewerUserId: string | null
  canModerate: boolean
  reactionKinds: ReactionKind[]
  reactions: ConversationReaction[]
  reactionIcons: ReactionIcons | null
  reactionIconColors?: ReactionIconColors | null
  reactionIconImageUrls?: ReactionIconImageUrls | null
  showReactionLabels: boolean
  reactionIconSizePx: number
  allowCommentReactions: boolean
  canReply: boolean
  onReply: () => void
  commentLengthLimit: number
  postAuthorUserId: string
}) {
  const [editing, setEditing] = useState(false)
  const isCommentAuthor = Boolean(viewerUserId) && comment.authorUserId === viewerUserId
  const isPostAuthor = Boolean(viewerUserId) && postAuthorUserId === viewerUserId
  const canEdit = Boolean(viewerUserId) && (canModerate || isCommentAuthor)
  const canDelete = Boolean(viewerUserId) && (canModerate || isCommentAuthor || isPostAuthor)
  const showOptions = Boolean(viewerUserId) && (canEdit || canDelete || !isCommentAuthor)

  const main = (
    <div className="sf-social-comment-row">
      <SocialAvatar
        src={comment.authorAvatarSrc}
        href={comment.authorHref}
        size={32}
        label={comment.authorName}
      />
      <div className="sf-social-comment-main">
        {editing && canEdit ? (
          <CommentEditForm
            comment={comment}
            commentLengthLimit={commentLengthLimit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="sf-social-comment-bubble">
            <p className="sf-social-comment-head">
              {comment.authorHref ? (
                <Link href={comment.authorHref}>{comment.authorName}</Link>
              ) : (
                <span>{comment.authorName}</span>
              )}
            </p>
            <p className="sf-social-comment-body">
              {replyToName ? <span className="sf-social-reply-to">{replyToName} </span> : null}
              {comment.body}
            </p>
          </div>
        )}
        <div className="sf-social-comment-meta">
          <time dateTime={comment.createdAt} title={comment.createdAt} suppressHydrationWarning>
            {compactTime(comment.createdAt)}
          </time>
          {comment.editedAt ? <span>Edited</span> : null}
          {allowCommentReactions && reactionKinds.length > 0 ? (
            <ReactionControl
              targetType="comment"
              targetId={comment.id}
              kinds={reactionKinds}
              reactions={reactions}
              reactionIcons={reactionIcons}
              reactionIconColors={reactionIconColors}
              reactionIconImageUrls={reactionIconImageUrls}
              showReactionLabels={showReactionLabels}
              reactionIconSizePx={reactionIconSizePx}
              viewerUserId={viewerUserId}
              layout="inline"
            />
          ) : null}
          {canReply ? (
            <button type="button" className="ghost" onClick={onReply}>
              Reply
            </button>
          ) : null}
        </div>
      </div>
      {showOptions ? (
        <CommentOptionsMenu
          commentId={comment.id}
          authorUserId={comment.authorUserId}
          authorName={comment.authorName}
          viewerUserId={viewerUserId}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => setEditing(true)}
        />
      ) : null}
    </div>
  )

  if (!viewerUserId || isCommentAuthor) return main

  return <HideableShell itemKey={`comment:${comment.id}`}>{main}</HideableShell>
}

function depthOf(
  comment: ConversationComment,
  byId: Map<string, ConversationComment>,
): 0 | 1 | 2 {
  if (!comment.parentCommentId) return 0
  const parent = byId.get(comment.parentCommentId)
  if (!parent?.parentCommentId) return 1
  return 2
}

function TopComment({
  comment,
  descendants,
  byId,
  viewerUserId,
  canModerate,
  reactionKinds,
  reactions,
  reactionIcons,
  reactionIconColors,
  reactionIconImageUrls,
  showReactionLabels,
  reactionIconSizePx,
  allowCommentReactions,
  allowReplies,
  commentLengthLimit,
  postAuthorUserId,
}: {
  comment: ConversationComment
  descendants: ConversationComment[]
  byId: Map<string, ConversationComment>
  viewerUserId: string | null
  canModerate: boolean
  reactionKinds: ReactionKind[]
  reactions: ConversationReaction[]
  reactionIcons: ReactionIcons | null
  reactionIconColors?: ReactionIconColors | null
  reactionIconImageUrls?: ReactionIconImageUrls | null
  showReactionLabels: boolean
  reactionIconSizePx: number
  allowCommentReactions: boolean
  allowReplies: boolean
  commentLengthLimit: number
  postAuthorUserId: string
}) {
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const replyCount = descendants.length
  const replyLabel =
    replyCount === 1 ? 'View 1 reply' : `View ${replyCount} replies`

  function replyTarget(id: string) {
    setRepliesOpen(true)
    setReplyingTo((current) => (current === id ? null : id))
  }

  return (
    <li className="sf-social-comment">
      <CommentRow
        comment={comment}
        replyToName={null}
        viewerUserId={viewerUserId}
        canModerate={canModerate}
        reactionKinds={reactionKinds}
        reactions={reactions}
        reactionIcons={reactionIcons}
        reactionIconColors={reactionIconColors}
        reactionIconImageUrls={reactionIconImageUrls}
        showReactionLabels={showReactionLabels}
        reactionIconSizePx={reactionIconSizePx}
        allowCommentReactions={allowCommentReactions}
        canReply={allowReplies && Boolean(viewerUserId)}
        onReply={() => replyTarget(comment.id)}
        commentLengthLimit={commentLengthLimit}
        postAuthorUserId={postAuthorUserId}
      />
      {replyingTo === comment.id ? (
        <CommentForm
          postId={comment.postId}
          parentCommentId={comment.id}
          placeholder={`Reply to ${comment.authorName}…`}
          submitLabel="Reply"
          maxLength={commentLengthLimit}
          focusKey={1}
          onSuccess={() => setReplyingTo(null)}
        />
      ) : null}
      {replyCount > 0 ? (
        <button
          type="button"
          className="ghost sf-social-view-replies"
          aria-expanded={repliesOpen}
          onClick={() => setRepliesOpen((open) => !open)}
        >
          {repliesOpen ? 'Hide replies' : replyLabel}
        </button>
      ) : null}
      {repliesOpen ? (
        <ul className="sf-social-replies">
          {descendants.map((reply) => {
            const depth = depthOf(reply, byId)
            const parent = reply.parentCommentId ? byId.get(reply.parentCommentId) : null
            return (
              <li key={reply.id} className="sf-social-comment">
                <CommentRow
                  comment={reply}
                  replyToName={depth >= 2 ? parent?.authorName ?? null : null}
                  viewerUserId={viewerUserId}
                  canModerate={canModerate}
                  reactionKinds={reactionKinds}
                  reactions={reactions}
                  reactionIcons={reactionIcons}
                  reactionIconColors={reactionIconColors}
                  reactionIconImageUrls={reactionIconImageUrls}
                  showReactionLabels={showReactionLabels}
                  reactionIconSizePx={reactionIconSizePx}
                  allowCommentReactions={allowCommentReactions}
                  canReply={allowReplies && Boolean(viewerUserId)}
                  onReply={() => replyTarget(reply.id)}
                  commentLengthLimit={commentLengthLimit}
                  postAuthorUserId={postAuthorUserId}
                />
                {replyingTo === reply.id ? (
                  <CommentForm
                    postId={reply.postId}
                    parentCommentId={reply.id}
                    placeholder={`Reply to ${reply.authorName}…`}
                    submitLabel="Reply"
                    maxLength={commentLengthLimit}
                    focusKey={1}
                    onSuccess={() => setReplyingTo(null)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * Post actions and the comment thread.
 * Like is one control: click sets Like, click again clears it, and the tray
 * switches kind. Replies sit one step under the comment. A reply to a reply
 * stays on that step and names who it answers. Reply stays available on every
 * comment; deeper answers keep the same visual step.
 */
export function PostConversation({
  postId,
  postKind,
  sharedPostId = null,
  postAudience = 'friends',
  postGroupId = null,
  postAuthorUserId,
  reactorNames = {},
  comments,
  reactions,
  viewerUserId,
  canModerate = false,
  reactionKinds,
  reactionIcons = null,
  reactionIconColors = null,
  reactionIconImageUrls = null,
  showReactionLabels = true,
  reactionIconSizePx = 16,
  allowComments,
  allowCommentReactions,
  commentLengthLimit,
  showShare = false,
  commentsExpanded = false,
}: {
  postId: string
  postKind: string
  /** When this card is a share, Share points at the original. */
  sharedPostId?: string | null
  postAudience?: PostAudience
  postGroupId?: string | null
  postAuthorUserId: string
  reactorNames?: Readonly<Record<string, string>>
  comments: ConversationComment[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  /** Social staff may edit/delete any comment. */
  canModerate?: boolean
  reactionKinds: ReactionKind[]
  /** FA class map when site Font Awesome is on; null → text-only for FA. */
  reactionIcons?: ReactionIcons | null
  /** FA tint per kind (ignored when that kind uses an image). */
  reactionIconColors?: ReactionIconColors | null
  /** Resolved Media URLs per kind; image wins over FA. */
  reactionIconImageUrls?: ReactionIconImageUrls | null
  showReactionLabels?: boolean
  /** Tray popup glyph/image size only. */
  reactionIconSizePx?: number
  allowComments: boolean
  allowCommentReactions: boolean
  commentLengthLimit: number
  showShare?: boolean
  /** Permalink opens the full thread. The feed keeps a short preview. */
  commentsExpanded?: boolean
}) {
  const [threadOpen, setThreadOpen] = useState(commentsExpanded)
  const [shareOpen, setShareOpen] = useState(false)
  const [whoOpen, setWhoOpen] = useState(false)
  const whoRef = useDismissible<HTMLDivElement>(whoOpen, () => setWhoOpen(false))
  const shareRef = useDismissible<HTMLDivElement>(shareOpen, () => setShareOpen(false))
  const [composerFocusKey, setComposerFocusKey] = useState(0)
  const byId = new Map(comments.map((comment) => [comment.id, comment]))
  const tops = comments
    .filter((comment) => !comment.parentCommentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const descendantsOf = (id: string) => {
    const out: ConversationComment[] = []
    const walk = (parentId: string) => {
      for (const child of comments) {
        if (child.parentCommentId !== parentId) continue
        out.push(child)
        walk(child.id)
      }
    }
    walk(id)
    out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return out
  }
  const visibleTops =
    threadOpen || tops.length <= COMMENT_PREVIEW ? tops : tops.slice(-COMMENT_PREVIEW)
  const earlierCount = tops.length - visibleTops.length
  const postReactions = rowsFor(reactions, 'post', postId)
  const commentCount = comments.length
  const friendsShareWidens = shareAudienceIsWider(postAudience, 'friends', {
    originalGroupId: postGroupId,
    nextGroupId: null,
  })
  // Share stays on a share card and points at the original, like Facebook.
  const shareTargetId =
    postKind === 'share' && sharedPostId?.trim() ? sharedPostId.trim() : postId
  const canShare = showShare && postKind !== 'challenge' && !friendsShareWidens
  const who = peopleLabel(postReactions, reactorNames)
  const actionCount = (reactionKinds.length > 0 ? 1 : 0) + (allowComments ? 1 : 0) + (canShare ? 1 : 0)

  function openThreadAndFocus() {
    setThreadOpen(true)
    setComposerFocusKey((key) => key + 1)
  }

  return (
    <section className="sf-social-conversation" aria-label="Comments">
      {postReactions.length > 0 || commentCount > 0 ? (
        <div className="sf-social-engagement-summary" ref={whoRef}>
          {postReactions.length > 0 ? (
            <button
              type="button"
              className="ghost sf-social-reaction-count"
              aria-expanded={whoOpen}
              onClick={() => setWhoOpen((open) => !open)}
            >
              <SummaryKinds
                rows={postReactions}
                icons={reactionIcons}
                colors={reactionIconColors}
                imageUrls={reactionIconImageUrls}
              />
              {who ? <span> · {who}</span> : null}
            </button>
          ) : (
            <span />
          )}
          {commentCount > 0 ? (
            <button type="button" className="ghost" onClick={() => setThreadOpen(true)}>
              {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
            </button>
          ) : null}
          {whoOpen && postReactions.length > 0 ? (
            <ul className="sf-social-reactors">
              {postReactions.map((row) => (
                <li key={row.actorUserId}>
                  {reactorNames[row.actorUserId] || 'Someone'}
                  {' · '}
                  <ReactionGlyph
                    kind={row.kind}
                    icons={reactionIcons}
                    colors={reactionIconColors}
                    imageUrls={reactionIconImageUrls}
                  />
                  {showReactionLabels ||
                  !hasReactionVisual(row.kind, reactionIcons, reactionIconImageUrls)
                    ? REACTION_LABEL[row.kind]
                    : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {viewerUserId && actionCount > 0 ? (
        <div ref={shareRef}>
          <div
            className="sf-social-action-bar"
            style={{ gridTemplateColumns: `repeat(${actionCount}, minmax(0, 1fr))` }}
          >
            {reactionKinds.length > 0 ? (
              <ReactionControl
                targetType="post"
                targetId={postId}
                kinds={reactionKinds}
                reactions={reactions}
                reactionIcons={reactionIcons}
                reactionIconColors={reactionIconColors}
                reactionIconImageUrls={reactionIconImageUrls}
                showReactionLabels={showReactionLabels}
                reactionIconSizePx={reactionIconSizePx}
                viewerUserId={viewerUserId}
                layout="bar"
              />
            ) : null}
            {allowComments ? (
              <button type="button" className="sf-social-action" onClick={openThreadAndFocus}>
                Comment
              </button>
            ) : null}
            {canShare ? (
              <button
                type="button"
                className={shareOpen ? 'sf-social-action is-selected' : 'sf-social-action'}
                aria-expanded={shareOpen}
                onClick={() => setShareOpen((open) => !open)}
              >
                Share
              </button>
            ) : null}
          </div>
          {shareOpen && canShare ? (
            <SharePostActions postId={shareTargetId} noteOnly />
          ) : null}
        </div>
      ) : null}
      {earlierCount > 0 ? (
        <button
          type="button"
          className="ghost sf-social-view-earlier"
          onClick={() => setThreadOpen(true)}
        >
          {earlierCount === 1 ? 'View 1 earlier comment' : `View ${earlierCount} earlier comments`}
        </button>
      ) : null}
      {visibleTops.length > 0 ? (
        <ul className="sf-social-comments">
          {visibleTops.map((comment) => (
            <TopComment
              key={comment.id}
              comment={comment}
              descendants={descendantsOf(comment.id)}
              byId={byId}
              viewerUserId={viewerUserId}
              canModerate={canModerate}
              reactionKinds={reactionKinds}
              reactions={reactions}
              reactionIcons={reactionIcons}
              reactionIconColors={reactionIconColors}
              reactionIconImageUrls={reactionIconImageUrls}
              showReactionLabels={showReactionLabels}
              reactionIconSizePx={reactionIconSizePx}
              allowCommentReactions={allowCommentReactions}
              allowReplies={allowComments}
              commentLengthLimit={commentLengthLimit}
              postAuthorUserId={postAuthorUserId}
            />
          ))}
        </ul>
      ) : null}
      {allowComments && viewerUserId ? (
        <CommentForm
          postId={postId}
          placeholder="Write a comment…"
          submitLabel="Post"
          maxLength={commentLengthLimit}
          focusKey={composerFocusKey}
          onSuccess={() => setThreadOpen(true)}
        />
      ) : null}
    </section>
  )
}
