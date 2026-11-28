import Link from 'next/link'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'

export type StoryTrayBubble = {
  /** Stable key — author id when grouped, else story id. */
  key: string
  mediaId: string
  label: string
  seen: boolean
  href: string
}

/**
 * Horizontal story covers — round thumbs in one scroll row.
 * Used on the home feed tray and the Stories page.
 */
export function StoryTray({
  items,
  emptyMessage,
  ariaLabel = 'Stories',
}: {
  items: StoryTrayBubble[]
  emptyMessage?: string
  ariaLabel?: string
}) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="sf-social-story-tray-empty layout-muted">{emptyMessage}</p>
    ) : null
  }

  return (
    <ul className="sf-social-story-tray" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.key} className="sf-social-story-tray-item">
          <Link
            href={item.href}
            className={
              item.seen
                ? 'sf-social-story-bubble is-seen'
                : 'sf-social-story-bubble is-unseen'
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
            <img
              src={`/api/media/${encodeURIComponent(item.mediaId)}`}
              alt=""
              className="sf-social-story-bubble-img"
            />
            <span className="sf-social-story-bubble-label">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Permalink into the Stories surface (viewer opens there). */
export function storiesSurfaceHref(locale: string): string {
  return withLocalePrefix('/feed/stories', locale)
}
