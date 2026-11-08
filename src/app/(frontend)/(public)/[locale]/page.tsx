import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug, requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { findNavOverridesForPath } from '@/core/nav'
import { HOME_PAGE_KEY } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

/** Payload page slug for `/` (matches Page Settings pageKey). */
const HOME_SLUG = HOME_PAGE_KEY

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ notice?: string }>
}

/**
 * Public home — Payload page `home` via the layout page-content particle.
 * Auth welcome lives in the Login particle (Layouts), not hard-coded here.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) {
    return { title: 'Starforge' }
  }
  const locale = requireContentLocale(localeParam)
  const page = await getPublishedPageBySlug(HOME_SLUG, locale)
  if (!page) {
    const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
    const siteName = chrome.siteName || settings.siteName
    return { title: siteName }
  }
  const settings = await getSiteSettings()
  const overrides = findNavOverridesForPath(settings.primaryNav, '/')
  const meta = await buildPageMetadata(page)
  if (overrides?.browserTitle) {
    return { ...meta, title: overrides.browserTitle }
  }
  return meta
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const query = await searchParams
  const page = await getPublishedPageBySlug(HOME_SLUG, locale)

  if (!page) {
    notFound()
  }

  const settings = await getSiteSettings()
  const overrides = findNavOverridesForPath(settings.primaryNav, '/')
  const heading = overrides?.pageHeading?.trim() || page.title
  const showAdminsOnly = query.notice === 'admins-only'
  const showCmsDenied = query.notice === 'cms-denied'

  return (
    <article className="cms-page">
      {showAdminsOnly ? (
        <div className="notice-banner" role="status">
          <p>
            <strong>Admins only.</strong> Starforge admin (<code>/admin</code>) is for role{' '}
            <code>admin</code>. Sign in as a seed admin or set <code>STARFORGE_ADMIN_EMAILS</code>.
          </p>
        </div>
      ) : null}
      {showCmsDenied ? (
        <div className="notice-banner" role="status">
          <p>
            <strong>No CMS access.</strong> Content CMS (<code>/cms/admin</code>) needs{' '}
            <code>cms_access</code>. Ask a Starforge admin under{' '}
            <Link href="/admin/users">Users</Link>, or sign in as the seed admin.
          </p>
        </div>
      ) : null}
      <header className="cms-page-header">
        <h1>{heading}</h1>
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}
