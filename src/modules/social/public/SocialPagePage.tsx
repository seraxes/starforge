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
import { AlbumList, CreateAlbumForm } from './AlbumActions'
import { FeedPostList } from './FeedPostList'
import { HostedEventsPanel } from './HostedEventsPanel'
import {
  AddPageAdminForm,
  LikePageButton,
  PageWallComposer,
  UnlikePageButton,
} from './PageActions'
import { SocialEntityTabs } from './SocialEntityTabs'

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
  const activeTab =
    eventsEnabled && (query.tab ?? '').trim() === 'calendar' ? 'calendar' : 'wall'

  const [admin, like, likeCount] = await Promise.all([
    userId ? findPageAdmin(page.id, userId) : Promise.resolve(null),
    userId ? findPageLike(page.id, userId) : Promise.resolve(null),
    countPageLikes(page.id),
  ])
  const isAdmin = isPageAdminRow(admin)
  const isLiker = Boolean(like)
  const canSeeWall = isAdmin || isLiker

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

  return (
    <article className="cms-page sf-social-page-detail">
      <header className="cms-page-header">
        <p className="layout-muted">
          <Link href={withLocalePrefix('/feed/pages', locale)}>Pages</Link>
        </p>
        <h1>
          {page.name}
          {page.verifiedAt ? (
            <span className="layout-muted"> · verified</span>
          ) : null}
        </h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
        <p className="layout-muted">
          {likeCount} like{likeCount === 1 ? '' : 's'}
        </p>
      </header>

      {!userId ? (
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>{' '}
          to like this page or see the wall.
        </p>
      ) : (
        <div className="admin-control-row">
          {isLiker ? (
            <UnlikePageButton pageId={page.id} />
          ) : (
            <LikePageButton pageId={page.id} />
          )}
        </div>
      )}

      {canSeeWall ? (
        <SocialEntityTabs
          wallHref={pagePath}
          calendarHref={`${pagePath}?tab=calendar`}
          active={activeTab}
          showCalendar={eventsEnabled}
        />
      ) : null}

      {activeTab === 'calendar' && eventsEnabled && canSeeWall ? (
        <HostedEventsPanel
          locale={locale}
          hostKind="page"
          hostId={page.id}
          canManage={isAdmin}
        />
      ) : (
        <>
          {isAdmin ? (
            <section className="sf-social-page-admin" aria-label="Page admins">
              <h2 className="sf-social-section-heading">Admins</h2>
              <AddPageAdminForm pageId={page.id} />
              <PageWallComposer pageId={page.id} />
            </section>
          ) : null}

          {canSeeWall ? (
            <section className="sf-social-page-albums" aria-label="Page albums">
              <h2 className="sf-social-section-heading">Albums</h2>
              {isAdmin ? <CreateAlbumForm ownerType="page" ownerId={page.id} /> : null}
              <AlbumList albums={albums} itemsByAlbum={itemsByAlbum} canManage={isAdmin} />
            </section>
          ) : null}

          <section className="sf-social-page-wall" aria-label="Page wall">
            <h2 className="sf-social-section-heading">Wall</h2>
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
        </>
      )}
    </article>
  )
}
