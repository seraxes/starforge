import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
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

  const [directory, pack, staff] = await Promise.all([
    listPagesDirectory(),
    loadSocialModuleSettings(),
    userId ? requireAdminArea('admin.social', 'manage') : Promise.resolve(null),
  ])
  const canCreate =
    pack.settings.allowPages &&
    actorMayCreateSocialEntity(
      pack.settings.pageWhoCanCreate,
      Boolean(staff?.user?.id),
    )

  return (
    <article className="cms-page sf-social-pages-page">
      <header className="cms-page-header">
        <h1>Pages</h1>
        <p className="lede">Browse pages. Wall posts are for likers and page admins.</p>
      </header>

      {userId && canCreate ? (
        <section className="sf-social-pages-create" aria-label="Create a page">
          <h2 className="sf-social-section-heading">Create a page</h2>
          <CreatePageForm />
        </section>
      ) : userId ? null : (
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>{' '}
          to create or like pages.
        </p>
      )}

      <section className="sf-social-pages-directory" aria-label="Page directory">
        <h2 className="sf-social-section-heading">Directory</h2>
        {directory.length === 0 ? (
          <p className="layout-muted">No pages yet.</p>
        ) : (
          <ul className="sf-social-pages-list">
            {directory.map(({ page, likeCount }) => (
              <li key={page.id} className="sf-social-pages-item">
                <Link
                  href={withLocalePrefix(pageHref(page.slug), locale)}
                  className="sf-social-pages-link"
                >
                  <span className="sf-social-pages-name">{page.name}</span>
                  <span className="layout-muted">
                    {likeCount} like{likeCount === 1 ? '' : 's'}
                    {page.verifiedAt ? ' · verified' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
