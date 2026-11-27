import React from 'react'
import Link from 'next/link'

import { getAccessViewer, viewerMayAccessAdminResource } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { withLocalePrefix } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { RichContent } from '@/modules/rich-editor/api'
import type { Persona } from '@/modules/profiles/api'
import { getPersonas, personaMediaSrc } from '@/modules/profiles/api.server'

import { listCommentsForPosts } from '../comments-store'
import { canViewerSeePost, findPost } from '../posts-store'
import { listMutedAuthorIdsForViewer } from '../quiet-store'
import {
  memberFeedHref,
  permalinkHref,
  type PostRecord,
} from '../posts'
import { resolveReactionIconImageUrls } from '../reaction-icons-resolve'
import { listFeedReactions } from '../reactions-store'
import { loadSocialModuleSettings } from '../settings'
import { FeedPostMedia } from './FeedPostMedia'
import { QuietPostShell } from './QuietPostShell'
import { PollPostActions } from './PollPostActions'
import { PostAudienceControl, type AudienceGroup } from './PostAudienceControl'
import {
  PostManageBody,
  PostManageProvider,
  PostManageTools,
} from './PostManageMenu'
import {
  PostConversation,
  type ConversationComment,
  type ConversationReaction,
} from './PostConversation'
import { SavePostActions } from './SavePostActions'
import { SocialAvatar } from './SocialAvatar'

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

const AUDIENCE_LABEL: Record<PostRecord['audience'], string> = {
  only_me: 'Only me',
  friends: 'Friends',
  group: 'Group',
  public: 'Public',
}

function compactTime(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toISOString().slice(0, 10)
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
  commentsExpanded = false,
  ownedGroups = [],
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
  /** Permalink shows every top-level comment. The feed keeps a short preview. */
  commentsExpanded?: boolean
  /** Groups the viewer owns, so they can move their own post into one. */
  ownedGroups?: AudienceGroup[]
}) {
  if (items.length === 0) {
    return <p className="layout-muted sf-social-feed-empty">{emptyMessage}</p>
  }

  const pack = await loadSocialModuleSettings()
  const site = await getSiteSettings()
  const reactionIcons = isCatalogModuleEnabled(site, MODULE_IDS.fontAwesome)
    ? pack.settings.reactionIcons
    : null
  const reactionIconColors = reactionIcons ? pack.settings.reactionIconColors : null
  const reactionIconImageUrls = await resolveReactionIconImageUrls(
    pack.settings.reactionIconMediaIds,
  )
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
  const canModerateContent = Boolean(
    viewerId &&
      viewer.userId === viewerId &&
      (await viewerMayAccessAdminResource(viewer, 'admin.social', 'edit')),
  )
  const mutedAuthorIds = viewerId
    ? await listMutedAuthorIdsForViewer(viewerId)
    : new Set<string>()
  const commentAuthors = await getPersonas(
    [
      ...new Set([
        ...visibleComments.map((comment) => comment.authorUserId),
        ...reactionRows.map((row) => row.actorUserId),
      ]),
    ],
    viewer,
  )
  const reactorNames: Record<string, string> = {}
  for (const row of reactionRows) {
    if (reactorNames[row.actorUserId]) continue
    const persona = commentAuthors.get(row.actorUserId) ?? null
    reactorNames[row.actorUserId] = authorLabel(persona, row.actorUserId)
  }
  const shareTargetIds = [
    ...new Set(
      items
        .filter((item) => item.post.kind === 'share' && item.post.sharedPostId)
        .map((item) => item.post.sharedPostId as string),
    ),
  ]
  const shareTargets = await Promise.all(shareTargetIds.map((id) => findPost(id)))
  const shareVisible = new Map<string, boolean>()
  await Promise.all(
    items.map(async (item) => {
      if (item.post.kind !== 'share' || !item.post.sharedPostId) return
      const target = shareTargets[shareTargetIds.indexOf(item.post.sharedPostId)] ?? null
      shareVisible.set(
        item.post.id,
        Boolean(target && (await canViewerSeePost(viewerId, target))),
      )
    }),
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
      authorAvatarSrc: personaMediaSrc(author?.avatarMediaId) || null,
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
        const isAuthor = viewerId === post.authorUserId
        const avatarSrc = personaMediaSrc(author?.avatarMediaId) || null
        const showOptions = Boolean(viewerId)
        const card = (
          <>
            <header className="sf-social-feed-item-head">
              <SocialAvatar src={avatarSrc} href={profileHref} size={40} label={name} />
              <div className="sf-social-feed-author">
                {profileHref ? (
                  <Link href={profileHref}>{name}</Link>
                ) : (
                  <span>{name}</span>
                )}
                <span className="layout-muted sf-social-feed-meta">
                  <Link href={postHref}>
                    <time
                      dateTime={post.createdAt.toISOString()}
                      title={post.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    >
                      {compactTime(post.createdAt)}
                    </time>
                  </Link>
                </span>
              </div>
              <div className="sf-social-feed-item-tools">
                {showSave ? (
                  <SavePostActions
                    postId={post.id}
                    saved={Boolean(savedPostIds?.has(post.id))}
                  />
                ) : null}
                {isAuthor || canModerateContent ? (
                  <PostAudienceControl
                    postId={post.id}
                    audience={post.audience}
                    groupId={post.groupId}
                    ownedGroups={ownedGroups}
                  />
                ) : (
                  <span className="layout-muted sf-social-feed-audience">
                    {AUDIENCE_LABEL[post.audience]}
                  </span>
                )}
                {showOptions ? <PostManageTools /> : null}
              </div>
            </header>
            <div className="sf-social-feed-body">
              {post.pendingReview && (isAuthor || canModerateContent) ? (
                <p className="layout-muted sf-social-pending-review-notice">
                  {isAuthor
                    ? 'Waiting for staff review. Only you and moderators can see this post until it is approved.'
                    : 'Pending staff review — withheld from the audience until approved.'}
                </p>
              ) : null}
              {showOptions ? (
                <PostManageBody>
                  {post.body.trim() ? <RichContent html={post.body} /> : null}
                </PostManageBody>
              ) : post.body.trim() ? (
                <RichContent html={post.body} />
              ) : null}
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
                shareVisible.get(post.id) ? (
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
                ) : (
                  <p className="layout-muted sf-social-feed-share">
                    This content isn’t available.
                  </p>
                )
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
                <FeedPostMedia
                  media={post.media}
                  authorName={name}
                  authorHref={profileHref}
                  authorAvatarSrc={avatarSrc}
                  createdAtLabel={compactTime(post.createdAt)}
                  createdAtIso={post.createdAt.toISOString()}
                  postHref={postHref}
                  bodyHtml={post.body}
                  postId={post.id}
                  postKind={post.kind}
                  sharedPostId={post.sharedPostId}
                  postAudience={post.audience}
                  postGroupId={post.groupId}
                  postAuthorUserId={post.authorUserId}
                  reactorNames={reactorNames}
                  comments={commentsByPost.get(post.id) ?? []}
                  reactions={reactions.filter(
                    (row) =>
                      (row.targetType === 'post' && row.targetId === post.id) ||
                      (row.targetType === 'comment' &&
                        (commentsByPost.get(post.id) ?? []).some(
                          (comment) => comment.id === row.targetId,
                        )),
                  )}
                  viewerUserId={viewerId}
                  canModerate={canModerateContent}
                  mutedAuthorIds={mutedAuthorIds}
                  reactionKinds={pack.settings.enabledReactionKinds}
                  reactionIcons={reactionIcons}
                  reactionIconColors={reactionIconColors}
                  reactionIconImageUrls={reactionIconImageUrls}
                  showReactionLabels={pack.settings.showReactionLabels}
                  reactionIconSizePx={pack.settings.reactionIconSizePx}
                  reactionTrayHoverSizePx={pack.settings.reactionTrayHoverSizePx}
                  reactionTrayHoverEasing={pack.settings.reactionTrayHoverEasing}
                  allowComments={pack.settings.allowComments}
                  allowCommentReactions={pack.settings.allowReactionsOnComments}
                  commentLengthLimit={pack.settings.commentLengthLimit}
                  showShare={showShare}
                />
              ) : null}
              <PostConversation
                postId={post.id}
                postKind={post.kind}
                sharedPostId={post.sharedPostId}
                postAudience={post.audience}
                postGroupId={post.groupId}
                postAuthorUserId={post.authorUserId}
                reactorNames={reactorNames}
                comments={commentsByPost.get(post.id) ?? []}
                reactions={reactions.filter(
                  (row) =>
                    (row.targetType === 'post' && row.targetId === post.id) ||
                    (row.targetType === 'comment' &&
                      (commentsByPost.get(post.id) ?? []).some((comment) => comment.id === row.targetId)),
                )}
                viewerUserId={viewerId}
                canModerate={canModerateContent}
                mutedAuthorIds={mutedAuthorIds}
                reactionKinds={pack.settings.enabledReactionKinds}
                reactionIcons={reactionIcons}
                reactionIconColors={reactionIconColors}
                reactionIconImageUrls={reactionIconImageUrls}
                showReactionLabels={pack.settings.showReactionLabels}
                reactionIconSizePx={pack.settings.reactionIconSizePx}
                reactionTrayHoverSizePx={pack.settings.reactionTrayHoverSizePx}
                reactionTrayHoverEasing={pack.settings.reactionTrayHoverEasing}
                allowComments={pack.settings.allowComments}
                allowCommentReactions={pack.settings.allowReactionsOnComments}
                commentLengthLimit={pack.settings.commentLengthLimit}
                showShare={showShare}
                commentsExpanded={commentsExpanded}
              />
            </div>
          </>
        )
        const managed = showOptions && viewerId ? (
          <PostManageProvider
            postId={post.id}
            body={post.body}
            viewerUserId={viewerId}
            authorUserId={post.authorUserId}
            authorName={name}
            canModerate={canModerateContent}
            isMuted={mutedAuthorIds.has(post.authorUserId)}
          >
            {card}
          </PostManageProvider>
        ) : (
          card
        )
        return (
          <li key={post.id} className="sf-social-feed-item">
            {showOptions ? (
              <QuietPostShell postId={post.id}>{managed}</QuietPostShell>
            ) : (
              managed
            )}
          </li>
        )
      })}
    </ul>
  )
}
