import React from 'react'
import Link from 'next/link'

import { withLocalePrefix } from '@/core/i18n'
import type { Persona } from '@/modules/profiles/api'

import {
  memberFeedHref,
  permalinkHref,
  type PostRecord,
} from '../posts'

export type ShortVideoLayoutItem = {
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

/**
 * Short-video stack inside the feed column — one vertical video post per slide.
 * Same posts as the timeline; layout mode only.
 */
export function ShortVideoLayout({
  items,
  locale,
  emptyMessage = 'No short videos yet.',
}: {
  items: ShortVideoLayoutItem[]
  locale: string
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="layout-muted sf-social-feed-empty">{emptyMessage}</p>
  }

  return (
    <ul className="sf-social-short-video-list" aria-label="Short videos">
      {items.map(({ post, author }) => {
        const name = authorLabel(author, post.authorUserId)
        const profileHref = authorHref(author, locale)
        const postHref = withLocalePrefix(permalinkHref(post.id), locale)
        const video = post.media.find((item) =>
          (item.mimeType ?? '').toLowerCase().startsWith('video/'),
        )
        const src = video
          ? `/api/media/${encodeURIComponent(video.mediaId)}`
          : null
        return (
          <li key={post.id} className="sf-social-short-video-item">
            {src ? (
              <video
                className="sf-social-short-video-player"
                src={src}
                controls
                playsInline
                preload="metadata"
              />
            ) : null}
            <div className="sf-social-short-video-meta">
              {profileHref ? (
                <Link href={profileHref}>{name}</Link>
              ) : (
                <span>{name}</span>
              )}
              <Link className="sf-social-short-video-open" href={postHref}>
                Open post
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
