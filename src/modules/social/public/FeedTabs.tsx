import Link from 'next/link'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'

type FeedTab = 'friends' | 'following' | 'discover' | 'watch'

/** Friends / Following / Discover / Watch tabs on the home feed surfaces. */
export function FeedTabs({
  locale,
  active,
  showFollowing = true,
  showDiscover = true,
  showWatch = true,
}: {
  locale: string
  active: FeedTab
  showFollowing?: boolean
  showDiscover?: boolean
  showWatch?: boolean
}) {
  const friendsHref = withLocalePrefix('/feed', locale)
  const followingHref = withLocalePrefix('/feed/following', locale)
  const discoverHref = withLocalePrefix('/feed/discover', locale)
  const watchHref = withLocalePrefix('/feed/watch', locale)
  return (
    <nav className="sf-social-feed-tabs admin-control-row" aria-label="Feed tabs">
      <Link
        className={
          active === 'friends' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
        }
        href={friendsHref}
        aria-current={active === 'friends' ? 'page' : undefined}
      >
        Friends
      </Link>
      {showFollowing ? (
        <Link
          className={
            active === 'following' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
          }
          href={followingHref}
          aria-current={active === 'following' ? 'page' : undefined}
        >
          Following
        </Link>
      ) : null}
      {showDiscover ? (
        <Link
          className={
            active === 'discover' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
          }
          href={discoverHref}
          aria-current={active === 'discover' ? 'page' : undefined}
        >
          Discover
        </Link>
      ) : null}
      {showWatch ? (
        <Link
          className={
            active === 'watch' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
          }
          href={watchHref}
          aria-current={active === 'watch' ? 'page' : undefined}
        >
          Watch
        </Link>
      ) : null}
    </nav>
  )
}
