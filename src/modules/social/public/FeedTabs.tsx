import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'

export type SocialPublicNavActive =
  | 'feed'
  | 'friends'
  | 'people'
  | 'groups'
  | 'pages'
  | 'stories'
  | 'following'
  | 'discover'
  | 'watch'
  | 'saved'

function linkClass(active: boolean, secondary = false): string {
  const base = secondary ? 'sf-social-nav-secondary-link' : 'sf-social-nav-link'
  return active ? `${base} is-active` : base
}

/**
 * Public Social shell nav — Feed / People / Groups / Pages primary;
 * Stories / Following / Discover / Watch / Saved secondary when enabled.
 */
export async function FeedTabs({
  locale,
  active,
  showFollowing = true,
  showDiscover = true,
  showWatch = true,
  showStories = true,
}: {
  locale: string
  active: SocialPublicNavActive
  showFollowing?: boolean
  showDiscover?: boolean
  showWatch?: boolean
  showStories?: boolean
}) {
  const t = await getTranslations('product:social')
  const feedActive = active === 'feed' || active === 'friends'
  const feedHref = withLocalePrefix('/feed', locale)
  const peopleHref = withLocalePrefix('/feed/people', locale)
  const groupsHref = withLocalePrefix('/feed/groups', locale)
  const pagesHref = withLocalePrefix('/feed/pages', locale)
  const storiesHref = withLocalePrefix('/feed/stories', locale)
  const followingHref = withLocalePrefix('/feed/following', locale)
  const discoverHref = withLocalePrefix('/feed/discover', locale)
  const watchHref = withLocalePrefix('/feed/watch', locale)
  const savedHref = withLocalePrefix('/feed/saved', locale)

  return (
    <nav className="sf-social-nav" aria-label={t('navAriaLabel')}>
      <div className="sf-social-nav-primary">
        <Link
          className={linkClass(feedActive)}
          href={feedHref}
          aria-current={feedActive ? 'page' : undefined}
        >
          {t('navFeed')}
        </Link>
        <Link
          className={linkClass(active === 'people')}
          href={peopleHref}
          aria-current={active === 'people' ? 'page' : undefined}
        >
          {t('navPeople')}
        </Link>
        <Link
          className={linkClass(active === 'groups')}
          href={groupsHref}
          aria-current={active === 'groups' ? 'page' : undefined}
        >
          {t('navGroups')}
        </Link>
        <Link
          className={linkClass(active === 'pages')}
          href={pagesHref}
          aria-current={active === 'pages' ? 'page' : undefined}
        >
          {t('navPages')}
        </Link>
      </div>
      <div className="sf-social-nav-secondary">
        {showStories ? (
          <Link
            className={linkClass(active === 'stories', true)}
            href={storiesHref}
            aria-current={active === 'stories' ? 'page' : undefined}
          >
            {t('navStories')}
          </Link>
        ) : null}
        {showFollowing ? (
          <Link
            className={linkClass(active === 'following', true)}
            href={followingHref}
            aria-current={active === 'following' ? 'page' : undefined}
          >
            {t('navFollowing')}
          </Link>
        ) : null}
        {showDiscover ? (
          <Link
            className={linkClass(active === 'discover', true)}
            href={discoverHref}
            aria-current={active === 'discover' ? 'page' : undefined}
          >
            {t('navDiscover')}
          </Link>
        ) : null}
        {showWatch ? (
          <Link
            className={linkClass(active === 'watch', true)}
            href={watchHref}
            aria-current={active === 'watch' ? 'page' : undefined}
          >
            {t('navWatch')}
          </Link>
        ) : null}
        <Link
          className={linkClass(active === 'saved', true)}
          href={savedHref}
          aria-current={active === 'saved' ? 'page' : undefined}
        >
          {t('navSaved')}
        </Link>
      </div>
    </nav>
  )
}
