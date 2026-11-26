'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

import { RichContent } from '@/modules/rich-editor/api'

import { classifyMediaMime, type PostAudience, type PostMediaAttachment } from '../posts'
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
import { SocialAvatar } from './SocialAvatar'

export type FeedPostMediaItem = {
  mediaId: string
  mimeType: string | null
}

function mediaSrc(mediaId: string): string {
  return `/api/media/${encodeURIComponent(mediaId)}`
}

function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

type TheaterProps = {
  items: FeedPostMediaItem[]
  index: number
  onClose: () => void
  onIndexChange: (next: number) => void
  authorName: string
  authorHref: string | null
  authorAvatarSrc: string | null
  createdAtLabel: string
  createdAtIso: string
  postHref: string
  bodyHtml: string
  postId: string
  postKind: string
  sharedPostId: string | null
  postAudience: PostAudience
  postGroupId: string | null
  postAuthorUserId: string
  reactorNames: Readonly<Record<string, string>>
  comments: ConversationComment[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  canModerate: boolean
  reactionKinds: ReactionKind[]
  reactionIcons: ReactionIcons | null
  reactionIconColors: ReactionIconColors | null
  reactionIconImageUrls: ReactionIconImageUrls | null
  showReactionLabels: boolean
  reactionIconSizePx: number
  reactionTrayHoverSizePx: number
  reactionTrayHoverEasing: string
  allowComments: boolean
  allowCommentReactions: boolean
  commentLengthLimit: number
  showShare: boolean
}

/**
 * Full-screen media + conversation theater.
 * Same fullscreen popup on every viewport (media + conversation panes).
 */
function SocialMediaTheater({
  items,
  index,
  onClose,
  onIndexChange,
  authorName,
  authorHref,
  authorAvatarSrc,
  createdAtLabel,
  createdAtIso,
  postHref,
  bodyHtml,
  postId,
  postKind,
  sharedPostId,
  postAudience,
  postGroupId,
  postAuthorUserId,
  reactorNames,
  comments,
  reactions,
  viewerUserId,
  canModerate,
  reactionKinds,
  reactionIcons,
  reactionIconColors,
  reactionIconImageUrls,
  showReactionLabels,
  reactionIconSizePx,
  reactionTrayHoverSizePx,
  reactionTrayHoverEasing,
  allowComments,
  allowCommentReactions,
  commentLengthLimit,
  showShare,
}: TheaterProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const safeIndex = items.length === 0 ? -1 : Math.min(Math.max(index, 0), items.length - 1)
  const current = safeIndex >= 0 ? items[safeIndex] : null
  const canPrev = safeIndex > 0
  const canNext = safeIndex >= 0 && safeIndex < items.length - 1

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [current?.mediaId])

  useEffect(() => {
    if (!current) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (isFormField(event.target)) return
      if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault()
        onIndexChange(safeIndex - 1)
        return
      }
      if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault()
        onIndexChange(safeIndex + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, canPrev, canNext, onClose, onIndexChange, safeIndex])

  if (!current) return null

  const src = mediaSrc(current.mediaId)
  const kind = classifyMediaMime(current.mimeType)

  const dialog = (
    <div className="sf-social-media-theater" role="presentation">
      <div
        className="sf-social-media-theater-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className="sf-social-media-theater-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="sf-social-media-theater-stage">
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="sf-social-media-theater-nav is-prev"
                aria-label="Previous"
                disabled={!canPrev}
                onClick={() => canPrev && onIndexChange(safeIndex - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="sf-social-media-theater-nav is-next"
                aria-label="Next"
                disabled={!canNext}
                onClick={() => canNext && onIndexChange(safeIndex + 1)}
              >
                ›
              </button>
            </>
          ) : null}
          {kind === 'video' ? (
            <video
              key={current.mediaId}
              src={src}
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="sf-social-media-theater-asset"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
            <img
              key={current.mediaId}
              src={src}
              alt=""
              className="sf-social-media-theater-asset"
            />
          )}
          {items.length > 1 ? (
            <p className="sf-social-media-theater-count" id={titleId}>
              {safeIndex + 1} / {items.length}
            </p>
          ) : (
            <span id={titleId} className="sf-social-media-theater-sr">
              Media
            </span>
          )}
        </div>
        <aside className="sf-social-media-theater-panel">
          <header className="sf-social-feed-item-head sf-social-media-theater-head">
            <SocialAvatar
              src={authorAvatarSrc}
              href={authorHref}
              size={40}
              label={authorName}
            />
            <div className="sf-social-feed-author">
              {authorHref ? (
                <Link href={authorHref}>{authorName}</Link>
              ) : (
                <span>{authorName}</span>
              )}
              <span className="layout-muted sf-social-feed-meta">
                <Link href={postHref}>
                  <time dateTime={createdAtIso} title={createdAtIso.slice(0, 16).replace('T', ' ')}>
                    {createdAtLabel}
                  </time>
                </Link>
              </span>
            </div>
          </header>
          {bodyHtml.trim() ? (
            <div className="sf-social-media-theater-body">
              <RichContent html={bodyHtml} />
            </div>
          ) : null}
          <PostConversation
            postId={postId}
            postKind={postKind}
            sharedPostId={sharedPostId}
            postAudience={postAudience}
            postGroupId={postGroupId}
            postAuthorUserId={postAuthorUserId}
            reactorNames={reactorNames}
            comments={comments}
            reactions={reactions}
            viewerUserId={viewerUserId}
            canModerate={canModerate}
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
            showShare={showShare}
            commentsExpanded
          />
        </aside>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}

/**
 * Feed / wall media grid — click opens the full-screen theater (same popup
 * on desktop and mobile).
 */
export function FeedPostMedia({
  media,
  authorName,
  authorHref,
  authorAvatarSrc,
  createdAtLabel,
  createdAtIso,
  postHref,
  bodyHtml,
  postId,
  postKind,
  sharedPostId = null,
  postAudience,
  postGroupId = null,
  postAuthorUserId,
  reactorNames,
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
  reactionTrayHoverSizePx = 28,
  reactionTrayHoverEasing = 'ease',
  allowComments,
  allowCommentReactions,
  commentLengthLimit,
  showShare = false,
}: {
  media: PostMediaAttachment[] | FeedPostMediaItem[]
  authorName: string
  authorHref: string | null
  authorAvatarSrc: string | null
  createdAtLabel: string
  createdAtIso: string
  postHref: string
  bodyHtml: string
  postId: string
  postKind: string
  sharedPostId?: string | null
  postAudience: PostAudience
  postGroupId?: string | null
  postAuthorUserId: string
  reactorNames: Readonly<Record<string, string>>
  comments: ConversationComment[]
  reactions: ConversationReaction[]
  viewerUserId: string | null
  canModerate?: boolean
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
  showShare?: boolean
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const items: FeedPostMediaItem[] = media.map((item) => ({
    mediaId: item.mediaId,
    mimeType: item.mimeType ?? null,
  }))

  const close = useCallback(() => setOpenIndex(null), [])

  if (items.length === 0) return null

  return (
    <>
      <ul className="sf-social-feed-media">
        {items.map((item, index) => {
          const src = mediaSrc(item.mediaId)
          const kind = classifyMediaMime(item.mimeType)
          return (
            <li key={`${postId}-${item.mediaId}`} className="sf-social-feed-media-item">
              <button
                type="button"
                className="sf-social-feed-media-open"
                aria-label={kind === 'video' ? 'Open video' : 'Open photo'}
                onClick={() => setOpenIndex(index)}
              >
                {kind === 'video' ? (
                  <video src={src} playsInline preload="metadata" muted tabIndex={-1} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                  <img src={src} alt="" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {openIndex !== null ? (
        <SocialMediaTheater
          items={items}
          index={openIndex}
          onClose={close}
          onIndexChange={setOpenIndex}
          authorName={authorName}
          authorHref={authorHref}
          authorAvatarSrc={authorAvatarSrc}
          createdAtLabel={createdAtLabel}
          createdAtIso={createdAtIso}
          postHref={postHref}
          bodyHtml={bodyHtml}
          postId={postId}
          postKind={postKind}
          sharedPostId={sharedPostId}
          postAudience={postAudience}
          postGroupId={postGroupId}
          postAuthorUserId={postAuthorUserId}
          reactorNames={reactorNames}
          comments={comments}
          reactions={reactions}
          viewerUserId={viewerUserId}
          canModerate={canModerate}
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
          showShare={showShare}
        />
      ) : null}
    </>
  )
}
