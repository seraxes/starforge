import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { pageHref } from '../pages'
import { listPagesDirectory } from '../pages-store'
import { actorMayCreateSocialEntity } from '../pack-settings'
import { loadSocialModuleSettings } from '../settings'
import { FeedTabs } from './FeedTabs'
import { CreatePageForm } from './PageActions'

type Args = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Pages',
    description: `Find pages on ${siteName}.`,
  }
}

function pageCoverMediaSrc(coverMediaId: string | null | undefined): string {
  const id = (coverMediaId ?? '').trim()
  return id ? `/api/media/${encodeURIComponent(id)}` : ''
}

/** Pages directory — `/feed/pages`. */
export default async function SocialPagesPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/pages', locale),
  )}`

  const [directory, pack, staff, t] = await Promise.all([
    listPagesDirectory(),
    loadSocialModuleSettings(),
    userId ? requireAdminArea('admin.social', 'manage') : Promise.resolve(null),
    getTranslations('product:social'),
  ])
  const canCreate =
    pack.settings.allowPages &&
    actorMayCreateSocialEntity(
      pack.settings.pageWhoCanCreate,
      Boolean(staff?.user?.id),
    )
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  return (
    <div className="sf-social-feed-page sf-social-pages-page">
      <FeedTabs locale={locale} active="pages" {...tabFlags} />
      <div className="sf-social-directory-shell">
        <div className="sf-social-directory-toolbar">
          {userId && canCreate ? (
            <CreatePageForm />
          ) : userId ? null : (
            <p className="sf-social-directory-signin">
              <Link className="sf-social-cta" href={loginHref}>
                {t('signIn')}
              </Link>
              <span className="layout-muted">{t('guestSignInPagesSuffix')}</span>
            </p>
          )}
        </div>

        <section className="sf-social-directory" aria-label={t('pageDirectoryAriaLabel')}>
          {directory.length === 0 ? (
            <p className="layout-muted">{t('emptyNoPagesYet')}</p>
          ) : (
            <ul className="sf-social-directory-grid">
              {directory.map(({ page, likeCount }) => {
                const coverSrc = pageCoverMediaSrc(page.coverMediaId)
                return (
                  <li key={page.id} className="sf-social-directory-card">
                    <Link
                      href={withLocalePrefix(pageHref(page.slug), locale)}
                      className="sf-social-directory-card-link"
                    >
                      {coverSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverSrc}
                          alt=""
                          className="sf-social-directory-card-cover"
                        />
                      ) : (
                        <span
                          className="sf-social-directory-card-cover sf-social-directory-card-cover-empty"
                          aria-hidden
                        />
                      )}
                      <span className="sf-social-directory-card-body">
                        <span className="sf-social-directory-card-title">{page.name}</span>
                        <span className="sf-social-directory-card-meta">
                          {likeCount} like{likeCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
