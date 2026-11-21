import React from 'react'
import Link from 'next/link'

import { getAccessViewer, viewerMayAccessAdminResource } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { withLocalePrefix } from '@/core/i18n'
import { RichContent } from '@/modules/rich-editor/api'
import type { Persona } from '@/modules/profiles/api'
import { getPersonas } from '@/modules/profiles/api.server'

import { listCommentsForPosts } from '../comments-store'
import {
  classifyMediaMime,
  memberFeedHref,
  permalinkHref,
  type PostRecord,
} from '../posts'
import { listFeedReactions } from '../reactions-store'
import { loadSocialModuleSettings } from '../settings'
import { PollPostActions } from './PollPostActions'
import {
  PostConversation,
  type ConversationComment,
  type ConversationReaction,
} from './PostConversation'
import { SavePostActions } from './SavePostActions'
import { SharePostActions } from './SharePostActions'

export type FeedPostListItem = {
  post: PostRecord
  author: Persona | null
}

function authorLabel(author: Persona | null, userId: string): string {
  if (author?.displayName?.trim()) return author.displayName.trim()
  if (author?.handle?.trim()) return `@${author.handle.trim()}`
  return userId
}

function authorHref(author: Persona | null, locale: string): string | null {
  if (!author) return null
  const handle = author.handle?.trim()
  if (!handle) return author.href ? withLocalePrefix(author.href, locale) : null
  return withLocalePrefix(memberFeedHref(handle), locale)
}

/** Chronological post cards for home feed and member walls. */
export async function FeedPostList({
  items,
  locale,
  emptyMessage = 'No posts yet.',
  showShare = false,
  showSave = false,
  savedPostIds,
  viewerUserId = null,
  pollVotesByPostId,
}: {
  items: FeedPostListItem[]
  locale: string
  emptyMessage?: string
  /** Member feed surfaces that allow reshare. */
  showShare?: boolean
  /** Show Save / Unsave when the viewer is signed in. */
  showSave?: boolean
  /** Post ids already saved by the viewer (Unsave label). */
  savedPostIds?: ReadonlySet<string>
  /** Signed-in viewer (poll author / vote highlight). */
  viewerUserId?: string | null
  /** Viewer’s selected option id per poll post. */
  pollVotesByPostId?: ReadonlyMap<string, string>
}) {
  if (items.length === 0) {
    return <p className="layout-muted sf-social-feed-empty">{emptyMessage}</p>
  }

  const pack = await loadSocialModuleSettings()
  const session = await getAppSession()
  const sessionUserId = session?.user?.id ? String(session.user.id).trim() : ''
  const viewerId = viewerUserId?.trim() || sessionUserId || null
  const storedComments = await listCommentsForPosts(items.map((item) => item.post.id))
  const visibleComments = storedComments.filter(
    (comment) => !comment.staffHidden || comment.authorUserId === viewerId,
  )
  const reactionRows = await listFeedReactions(
    items.map((item) => item.post.id),
    visibleComments.map((comment) => comment.id),
  )
  const viewer = await getAccessViewer()
  const canModerateComments = Boolean(
    viewerId &&
      viewer.userId === viewerId &&
      (await viewerMayAccessAdminResource(viewer, 'admin.social', 'edit')),
  )
  const commentAuthors = await getPersonas(
    [...new Set(visibleComments.map((comment) => comment.authorUserId))],
    viewer,
  )
  const commentsByPost = new Map<string, ConversationComment[]>()
  for (const comment of visibleComments) {
    const author = commentAuthors.get(comment.authorUserId) ?? null
    const name = authorLabel(author, comment.authorUserId)
    const row: ConversationComment = {
      id: comment.id,
      postId: comment.postId,
      authorUserId: comment.authorUserId,
      authorName: name,
      authorHref: authorHref(author, locale),
      body: comment.body,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt.toISOString(),
      editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
    }
    const list = commentsByPost.get(comment.postId) ?? []
    list.push(row)
    commentsByPost.set(comment.postId, list)
  }
  const reactions: ConversationReaction[] = reactionRows.map((row) => ({
    actorUserId: row.actorUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    kind: row.kind,
  }))
  const mediaStyle = {
    '--sf-social-media-max-width': `${pack.settings.feedImageMaxWidthPx}px`,
    '--sf-social-media-max-height': `${pack.settings.feedImageMaxHeightPx}px`,
  } as React.CSSProperties

  return (
    <ul className="sf-social-feed-list" style={mediaStyle}>
      {items.map(({ post, author }) => {
        const name = authorLabel(author, post.authorUserId)
        const profileHref = authorHref(author, locale)
        const postHref = withLocalePrefix(permalinkHref(post.id), locale)
        return (
          <li key={post.id} className="sf-social-feed-item">
            <header className="sf-social-feed-item-head">
              {profileHref ? (
                <Link href={profileHref}>{name}</Link>
              ) : (
                <span>{name}</span>
              )}
              <span className="layout-muted sf-social-feed-meta">
                {post.audience}
                {' · '}
                <Link href={postHref}>
                  <time dateTime={post.createdAt.toISOString()}>
                    {post.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </time>
                </Link>
              </span>
            </header>
            <div className="sf-social-feed-body">
              {post.body.trim() ? <RichContent html={post.body} /> : null}
              {post.kind === 'link' && post.linkUrl ? (
                <p className="sf-social-feed-link">
                  <a href={post.linkUrl} rel="noopener noreferrer" target="_blank">
                    {post.linkTitle?.trim() || post.linkUrl}
                  </a>
                  {post.linkDescription?.trim() ? (
                    <span className="layout-muted"> — {post.linkDescription.trim()}</span>
                  ) : null}
                </p>
              ) : null}
              {post.kind === 'share' && post.sharedPostId ? (
                <p className="layout-muted sf-social-feed-share">
                  Shared{' '}
                  <Link
                    href={withLocalePrefix(
                      permalinkHref(post.sharedPostId),
                      locale,
                    )}
                  >
                    a post
                  </Link>
                </p>
              ) : null}
              {post.kind === 'poll' && post.pollOptions.length > 0 ? (
                <PollPostActions
                  postId={post.id}
                  options={post.pollOptions}
                  closed={Boolean(post.pollClosedAt)}
                  isAuthor={Boolean(viewerUserId && viewerUserId === post.authorUserId)}
                  viewerOptionId={pollVotesByPostId?.get(post.id) ?? null}
                />
              ) : null}
              {post.kind === 'checkin' && post.placeLabel ? (
                <p className="sf-social-feed-checkin">
                  <span className="layout-muted">Checked in at </span>
                  <strong>{post.placeLabel}</strong>
                  {post.mapsPinId ? (
                    <span className="layout-muted"> · map pin</span>
                  ) : null}
                </p>
              ) : null}
              {post.media.length > 0 ? (
                <ul className="sf-social-feed-media">
                  {post.media.map((item) => {
                    const src = `/api/media/${encodeURIComponent(item.mediaId)}`
                    const kind = classifyMediaMime(item.mimeType)
                    return (
                      <li
                        key={`${post.id}-${item.mediaId}`}
                        className="sf-social-feed-media-item"
                      >
                        {kind === 'video' ? (
                          <video src={src} controls playsInline preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                          <img src={src} alt="" />
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <PostConversation
                postId={post.id}
                comments={commentsByPost.get(post.id) ?? []}
                reactions={reactions.filter(
                  (row) =>
                    (row.targetType === 'post' && row.targetId === post.id) ||
                    (row.targetType === 'comment' &&
                      (commentsByPost.get(post.id) ?? []).some((comment) => comment.id === row.targetId)),
                )}
                viewerUserId={viewerId}
                canModerate={canModerateComments}
                reactionKinds={pack.settings.enabledReactionKinds}
                allowComments={pack.settings.allowComments}
                allowCommentReactions={pack.settings.allowReactionsOnComments}
                commentLengthLimit={pack.settings.commentLengthLimit}
              />
              {showShare ? (
                <SharePostActions postId={post.id} postKind={post.kind} />
              ) : null}
              {showSave ? (
                <SavePostActions
                  postId={post.id}
                  saved={Boolean(savedPostIds?.has(post.id))}
                />
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
