/**
 * Load the host conversation surface for Events / Pages.
 * Social off → disabled (callers render nothing). Never throws to the host pack.
 */

import 'server-only'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getPersonas } from '@/modules/profiles/api.server'

import { canViewComment } from './comments'
import { listCommentsForPost } from './comments-store'
import type { EnsureHostConversationInput } from './host-conversation'
import { ensureHostConversationInDb } from './host-conversation-store'
import {
  resolveHostConversationCanModerate,
  resolveHostConversationCanView,
} from './host-resolve'
import { resolveReactionIconImageUrls } from './reaction-icons-resolve'
import type {
  ReactionIconColors,
  ReactionIconImageUrls,
  ReactionIcons,
  ReactionKind,
} from './reactions'
import { listFeedReactions } from './reactions-store'
import { loadSocialModuleSettings } from './settings'
import { viewerMayModerateSocialContent } from './staff-grant'

export type HostConversationSurfaceComment = {
  id: string
  authorUserId: string
  authorName: string
  body: string
  parentCommentId: string | null
  staffHidden: boolean
  editedAt: string | null
  createdAt: string
}

export type HostConversationSurfaceReaction = {
  actorUserId: string
  targetType: 'post' | 'comment'
  targetId: string
  kind: ReactionKind
}

export type HostConversationSurface = {
  postId: string
  postAuthorUserId: string
  hostModule: string
  hostId: string
  viewerUserId: string | null
  canModerate: boolean
  canWrite: boolean
  comments: HostConversationSurfaceComment[]
  reactions: HostConversationSurfaceReaction[]
  reactorNames: Record<string, string>
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
}

export type LoadHostConversationSurfaceResult =
  | { ok: true; surface: HostConversationSurface }
  | { ok: false; reason: 'disabled' | 'cannot_view' | 'invalid' | 'failed' }

function authorLabel(
  persona: { displayName?: string | null; handle?: string | null } | null | undefined,
  userId: string,
): string {
  const name = persona?.displayName?.trim()
  if (name) return name
  const handle = persona?.handle?.trim()
  if (handle) return handle
  return 'Member'
}

/**
 * Ensure the conversation anchor, then return props for HostConversation.
 * Callers already know the viewer can open the host page; this still re-checks
 * the host door so a forged write path stays fail-closed.
 */
export async function loadHostConversationSurface(
  input: EnsureHostConversationInput & {
    /** When the host page already gated visibility, pass true to skip a second round-trip. */
    viewerAlreadyCanView?: boolean
  },
): Promise<LoadHostConversationSurfaceResult> {
  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return { ok: false, reason: 'disabled' }
    }

    const ensured = await ensureHostConversationInDb(input)
    if (!ensured.ok) {
      return { ok: false, reason: ensured.reason === 'invalid' ? 'invalid' : 'failed' }
    }

    const { conversation, post } = ensured
    const session = await getAppSession()
    const viewerUserId = session?.user?.id ? String(session.user.id).trim() : null
    const viewer = await getAccessViewer()

    const socialStaff = viewerUserId
      ? await viewerMayModerateSocialContent(viewerUserId)
      : false
    const hostCanView =
      input.viewerAlreadyCanView === true
        ? true
        : await resolveHostConversationCanView(conversation, viewerUserId)
    const hostCanModerate = viewerUserId
      ? await resolveHostConversationCanModerate(conversation, viewerUserId)
      : false

    if (!hostCanView && !socialStaff) {
      return { ok: false, reason: 'cannot_view' }
    }

    const pack = await loadSocialModuleSettings()
    const reactionIcons = isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome)
      ? pack.settings.reactionIcons
      : null
    const reactionIconColors = reactionIcons ? pack.settings.reactionIconColors : null
    const reactionIconImageUrls = await resolveReactionIconImageUrls(
      pack.settings.reactionIconMediaIds,
    )

    const storedComments = await listCommentsForPost(post.id)
    const visibleComments = storedComments.filter((comment) =>
      canViewComment(comment, {
        viewerUserId,
        canManagePosts: socialStaff || hostCanModerate,
      }),
    )
    const reactionRows = await listFeedReactions(
      [post.id],
      visibleComments.map((comment) => comment.id),
    )
    const personas = await getPersonas(
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
      reactorNames[row.actorUserId] = authorLabel(
        personas.get(row.actorUserId) ?? null,
        row.actorUserId,
      )
    }

    const comments: HostConversationSurfaceComment[] = visibleComments.map((comment) => ({
      id: comment.id,
      authorUserId: comment.authorUserId,
      authorName: authorLabel(
        personas.get(comment.authorUserId) ?? null,
        comment.authorUserId,
      ),
      body: comment.body,
      parentCommentId: comment.parentCommentId,
      staffHidden: comment.staffHidden,
      editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
      createdAt: comment.createdAt.toISOString(),
    }))

    const reactions: HostConversationSurfaceReaction[] = reactionRows.map((row) => ({
      actorUserId: row.actorUserId,
      targetType: row.targetType,
      targetId: row.targetId,
      kind: row.kind,
    }))

    return {
      ok: true,
      surface: {
        postId: post.id,
        postAuthorUserId: post.authorUserId,
        hostModule: conversation.hostModule,
        hostId: conversation.hostId,
        viewerUserId,
        canModerate: socialStaff || hostCanModerate,
        canWrite: Boolean(viewerUserId) && (hostCanView || socialStaff),
        comments,
        reactions,
        reactorNames,
        reactionKinds: pack.settings.enabledReactionKinds as ReactionKind[],
        reactionIcons,
        reactionIconColors,
        reactionIconImageUrls,
        showReactionLabels: pack.settings.showReactionLabels,
        reactionIconSizePx: pack.settings.reactionIconSizePx,
        reactionTrayHoverSizePx: pack.settings.reactionTrayHoverSizePx,
        reactionTrayHoverEasing: pack.settings.reactionTrayHoverEasing,
        allowComments: pack.settings.allowComments,
        allowCommentReactions: pack.settings.allowReactionsOnComments,
        commentLengthLimit: pack.settings.commentLengthLimit,
      },
    }
  } catch (error) {
    console.error('[social] loadHostConversationSurface failed', error)
    return { ok: false, reason: 'failed' }
  }
}
