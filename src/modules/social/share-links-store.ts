/**
 * product:social share + link persistence.
 * Link preview fetch is server-side, timed out, and size-capped.
 * Private / internal addresses are refused before any fetch.
 */

import 'server-only'

import { db } from '@/core/db'

import { areBlocked } from './friends-store'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { canViewerSeePost, findPost } from './posts-store'
import type { PostAudience, PostRecord } from './posts'
import {
  decideCreateLinkPost,
  decideCreateSharePost,
  type LinkPreviewSnapshot,
  type ShareCard,
  type ShareLinkMutationResult,
} from './share-links'
import { sfSocialPosts } from './schema'

const LINK_FETCH_TIMEOUT_MS = 4_000
const LINK_FETCH_MAX_BYTES = 64_000

async function insertPostRow(post: PostRecord): Promise<void> {
  await db.insert(sfSocialPosts).values({
    id: post.id,
    authorUserId: post.authorUserId,
    body: post.body,
    kind: post.kind,
    audience: post.audience,
    groupId: post.groupId,
    pageId: post.pageId,
    sharedPostId: post.sharedPostId,
    linkUrl: post.linkUrl,
    linkTitle: post.linkTitle,
    linkDescription: post.linkDescription,
    linkImageUrl: post.linkImageUrl,
    pollOptions: post.pollOptions,
    pollClosedAt: post.pollClosedAt,
    placeLabel: post.placeLabel,
    mapsPinId: post.mapsPinId,
    placeLat: post.placeLat,
    placeLng: post.placeLng,
    staffHidden: post.staffHidden,
    pendingReview: post.pendingReview,
    isAnnouncement: post.isAnnouncement,
    editedAt: post.editedAt,
    extensions: post.extensions,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  })
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  const match = html.match(re) ?? html.match(alt)
  const value = match?.[1]?.trim()
  return value || null
}

function titleFromHtml(html: string): string | null {
  const og = metaContent(html, 'og:title')
  if (og) return og
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const value = match?.[1]?.trim()
  return value || null
}

/**
 * Fetch a public link preview. Call only after classifyLinkUrl accepted the URL.
 * Failures return an empty snapshot — the URL still saves.
 */
export async function fetchLinkPreview(
  url: string,
): Promise<LinkPreviewSnapshot> {
  const empty: LinkPreviewSnapshot = {
    title: null,
    description: null,
    imageUrl: null,
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LINK_FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'StarforgeSocialLinkPreview/1.0',
        },
      })
      if (!res.ok) return empty
      const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
      if (!contentType.includes('html') && !contentType.includes('xml')) {
        return empty
      }
      const reader = res.body?.getReader()
      if (!reader) {
        const text = await res.text()
        const clipped = text.slice(0, LINK_FETCH_MAX_BYTES)
        return {
          title: titleFromHtml(clipped),
          description: metaContent(clipped, 'og:description'),
          imageUrl: metaContent(clipped, 'og:image'),
        }
      }
      const chunks: Uint8Array[] = []
      let total = 0
      while (total < LINK_FETCH_MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done || !value) break
        chunks.push(value)
        total += value.byteLength
        if (total >= LINK_FETCH_MAX_BYTES) break
      }
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      const merged = new Uint8Array(Math.min(total, LINK_FETCH_MAX_BYTES))
      let offset = 0
      for (const chunk of chunks) {
        const slice = chunk.subarray(
          0,
          Math.min(chunk.byteLength, LINK_FETCH_MAX_BYTES - offset),
        )
        merged.set(slice, offset)
        offset += slice.byteLength
        if (offset >= LINK_FETCH_MAX_BYTES) break
      }
      const html = new TextDecoder('utf-8', { fatal: false }).decode(
        merged.subarray(0, offset),
      )
      return {
        title: titleFromHtml(html),
        description: metaContent(html, 'og:description'),
        imageUrl: metaContent(html, 'og:image'),
      }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return empty
  }
}

export async function createLinkPost(input: {
  authorUserId: string
  url: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  /** Test / caller-injected preview skips network fetch. */
  preview?: LinkPreviewSnapshot | null
}): Promise<ShareLinkMutationResult> {
  const authorUserId = input.authorUserId.trim()
  const actorBannedAt = authorUserId ? await getMemberBannedAt(authorUserId) : null

  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const linkOpts = {
    kindEnabled: isComposerPostKindEnabled('link', pack.settings),
    holdForStaffReview: pack.settings.holdNewPostsForReview,
  }

  // Refuse private addresses before fetch.
  const gate = decideCreateLinkPost(
    {
      authorUserId,
      url: input.url,
      body: input.body,
      audience: input.audience,
      groupId: input.groupId,
      pageId: input.pageId,
      extensions: input.extensions,
      actorBannedAt,
      preview: null,
    },
    linkOpts,
  )
  if (!gate.ok) return gate

  const preview =
    input.preview !== undefined
      ? input.preview
      : await fetchLinkPreview(gate.post.linkUrl!)

  const decided = decideCreateLinkPost(
    {
      authorUserId,
      url: input.url,
      body: input.body,
      audience: input.audience,
      groupId: input.groupId,
      pageId: input.pageId,
      extensions: input.extensions,
      actorBannedAt,
      preview,
    },
    {
      now: gate.post.createdAt,
      newId: () => gate.post.id,
      ...linkOpts,
    },
  )
  if (!decided.ok) return decided

  try {
    await insertPostRow(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decided
}

export async function createSharePost(input: {
  authorUserId: string
  sharedPostId: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
}): Promise<ShareLinkMutationResult> {
  const authorUserId = input.authorUserId.trim()
  const sharedPostId = input.sharedPostId.trim()
  let target = await findPost(sharedPostId)
  // Sharing a share card points at the original, the same way Facebook does.
  if (target?.kind === 'share' && target.sharedPostId) {
    const original = await findPost(target.sharedPostId)
    if (original) target = original
  }
  const actorBannedAt = authorUserId ? await getMemberBannedAt(authorUserId) : null

  const otherId = target?.authorUserId ?? ''
  const [blocked, actorHidden, otherHidden, otherBannedAt, canViewTarget] =
    await Promise.all([
      target && authorUserId && otherId && authorUserId !== otherId
        ? areBlocked(authorUserId, otherId)
        : Promise.resolve(false),
      authorUserId ? isMemberAccountHidden(authorUserId) : Promise.resolve(false),
      otherId && authorUserId !== otherId
        ? isMemberAccountHidden(otherId)
        : Promise.resolve(false),
      otherId ? getMemberBannedAt(otherId) : Promise.resolve(null),
      target
        ? canViewerSeePost(authorUserId, target)
        : Promise.resolve(false),
    ])

  const interact: CanInteractContext = {
    isBlocked: blocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  }

  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decided = decideCreateSharePost(
    target,
    {
      authorUserId,
      sharedPostId: target?.id ?? sharedPostId,
      body: input.body,
      audience: input.audience,
      groupId: input.groupId,
      pageId: input.pageId,
      extensions: input.extensions,
      actorBannedAt,
      interact,
      canViewTarget,
    },
    {
      kindEnabled: isComposerPostKindEnabled('share', pack.settings),
      holdForStaffReview: pack.settings.holdNewPostsForReview,
    },
  )
  if (!decided.ok) return decided

  try {
    await insertPostRow(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decided
}

/** Resolve a share card for a viewer (omits target when canViewPost denies). */
export async function getShareCard(
  viewerUserId: string | null,
  sharePostId: string,
): Promise<ShareCard | null> {
  const share = await findPost(sharePostId)
  if (!share || share.kind !== 'share') return null
  const target = share.sharedPostId ? await findPost(share.sharedPostId) : null
  if (!target) {
    return { share, target: null, targetOmitted: true }
  }
  const canSee = await canViewerSeePost(viewerUserId, target)
  return {
    share,
    target: canSee ? target : null,
    targetOmitted: !canSee,
  }
}
