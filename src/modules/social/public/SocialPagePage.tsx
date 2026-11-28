import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonas } from '@/modules/profiles/api.server'

import { listAlbumItems, listAlbumsForOwner } from '../albums-store'
import { isPageAdminRow } from '../pages'
import {
  countPageLikes,
  findPageAdmin,
  findPageBySlug,
  findPageLike,
  listPageWallPosts,
} from '../pages-store'
import { loadSocialModuleSettings } from '../settings'
import { AlbumList, CreateAlbumForm } from './AlbumActions'
import { FeedPostList } from './FeedPostList'
import { FeedTabs } from './FeedTabs'
import { HostedEventsPanel } from './HostedEventsPanel'
import {
  AddPageAdminForm,
  LikePageButton,
  PageWallComposer,
  UnlikePageButton,
} from './PageActions'
import { resolveEntityTab, SocialEntityTabs } from './SocialEntityTabs'

type Args = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  const page = await findPageBySlug(slug)
  if (!page) return { title: `Not found — ${siteName}` }

  return {
    title: page.name,
    description: page.description || `Page on ${siteName}.`,
  }
}

function pageCoverMediaSrc(coverMediaId: string | null | undefined): string {
  const id = (coverMediaId ?? '').trim()
  return id ? `/api/media/${encodeURIComponent(id)}` : ''
}

/** Page wall — `/feed/p/[slug]`. Non-likers (and non-admins) do not see wall posts. */
export default async function SocialPagePage({ params, searchParams }: Args) {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session, viewer, query] = await Promise.all([
    getSiteSettings(),
    getAppSession(),
    getAccessViewer(),
    searchParams,
  ])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const page = await findPageBySlug(slug)
  if (!page) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const pagePath = withLocalePrefix(`/feed/p/${page.slug}`, locale)
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    pagePath,
  )}`
  const eventsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.events)

  const [admin, like, likeCount, pack] = await Promise.all([
    userId ? findPageAdmin(page.id, userId) : Promise.resolve(null),
    userId ? findPageLike(page.id, userId) : Promise.resolve(null),
    countPageLikes(page.id),
    loadSocialModuleSettings(),
  ])
  const isAdmin = isPageAdminRow(admin)
  const isLiker = Boolean(like)
  const canSeeWall = isAdmin || isLiker
  const activeTab = resolveEntityTab(
    query.tab,
    eventsEnabled,
    canSeeWall ? 'wall' : 'about',
  )
  const coverSrc = pageCoverMediaSrc(page.coverMediaId)
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const posts =
    canSeeWall && activeTab === 'wall' ? await listPageWallPosts(page.id) : []
  const albums =
    canSeeWall && activeTab === 'wall' ? await listAlbumsForOwner('page', page.id) : []
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))
  const itemsByAlbum = new Map(
    await Promise.all(
      albums.map(async (album) => [album.id, await listAlbumItems(album.id)] as const),
    ),
  )

  const likeBlock = !userId ? (
    <p className="sf-social-entity-join-copy">
      <Link className="sf-social-cta" href={loginHref}>
        Sign in
      </Link>{' '}
      to like this page or see the wall.
    </p>
  ) : (
    <div className="sf-social-control-row">
      {isLiker ? (
        <UnlikePageButton pageId={page.id} />
      ) : (
        <LikePageButton pageId={page.id} />
      )}
    </div>
  )

  return (
    <div className="sf-social-feed-page sf-social-entity-page sf-social-page-detail">
      <FeedTabs locale={locale} active="pages" {...tabFlags} />
      <div className="sf-social-feed-column">
        <header className="sf-social-entity-header">
          {coverSrc ? (
            <div className="sf-social-entity-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" className="sf-social-entity-cover-img" />
            </div>
          ) : (
            <div
              className="sf-social-entity-cover sf-social-entity-cover-empty"
              aria-hidden="true"
            />
          )}
          <div className="sf-social-entity-header-body">
            <p className="sf-social-entity-crumb layout-muted">
              <Link href={withLocalePrefix('/feed/pages', locale)}>Pages</Link>
            </p>
            <h1 className="sf-social-entity-title">
              {page.name}
              {page.verifiedAt ? (
                <span className="sf-social-entity-verified layout-muted"> · verified</span>
              ) : null}
            </h1>
            <p className="sf-social-entity-meta layout-muted">
              {page.verifiedAt ? (
                <span className="sf-social-entity-visibility">verified</span>
              ) : (
                <span className="sf-social-entity-visibility">page</span>
              )}
              <span aria-hidden="true"> · </span>
              <span>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </span>
            </p>
          </div>
        </header>

        <SocialEntityTabs
          baseHref={pagePath}
          active={activeTab}
          showCalendar={eventsEnabled}
        />

        {activeTab === 'about' ? (
          <section className="sf-social-entity-about" aria-label="About">
            {page.description ? (
              <p className="sf-social-entity-description">{page.description}</p>
            ) : (
              <p className="layout-muted">No description yet.</p>
            )}
            {likeBlock}
            {!canSeeWall && userId ? (
              <p className="layout-muted">Like this page to see its wall.</p>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'members' ? (
          <div className="sf-social-entity-members-pane">
            {isAdmin ? (
              <section className="sf-social-page-admin" aria-label="Page admins">
                <h2 className="sf-social-section-heading">Admins</h2>
                <AddPageAdminForm pageId={page.id} />
              </section>
            ) : (
              <p className="layout-muted">
                {canSeeWall
                  ? 'Page admin tools are available to page admins.'
                  : 'Like this page to follow its updates. Admin tools stay with page admins.'}
              </p>
            )}
          </div>
        ) : null}

        {activeTab === 'calendar' && eventsEnabled ? (
          <HostedEventsPanel
            locale={locale}
            hostKind="page"
            hostId={page.id}
            canManage={isAdmin}
          />
        ) : null}

        {activeTab === 'wall' ? (
          <section className="sf-social-page-wall" aria-label="Page wall">
            {isAdmin ? <PageWallComposer pageId={page.id} /> : null}
            {canSeeWall ? (
              <section className="sf-social-page-albums" aria-label="Page albums">
                <h2 className="sf-social-section-heading">Albums</h2>
                {isAdmin ? <CreateAlbumForm ownerType="page" ownerId={page.id} /> : null}
                <AlbumList albums={albums} itemsByAlbum={itemsByAlbum} canManage={isAdmin} />
              </section>
            ) : null}
            {!userId ? (
              <p className="layout-muted">Sign in and like this page to see posts.</p>
            ) : !canSeeWall ? (
              <p className="layout-muted">Like this page to see its wall.</p>
            ) : items.length === 0 ? (
              <p className="layout-muted">No posts yet.</p>
            ) : (
              <FeedPostList items={items} locale={locale} />
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
