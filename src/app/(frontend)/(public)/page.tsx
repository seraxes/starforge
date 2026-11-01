import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug } from '@/core/content/pages'
import { findNavOverridesForPath } from '@/core/nav'
import { HOME_PAGE_KEY } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

/** Payload page slug for `/` (matches Page Settings pageKey). */
const HOME_SLUG = HOME_PAGE_KEY

type Props = {
  searchParams: Promise<{ notice?: string }>
}

/**
 * Public home — Payload page `home` via the layout page-content particle.
 * No hard-coded scaffold; edit content in CMS `/admin`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPageBySlug(HOME_SLUG)
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

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const page = await getPublishedPageBySlug(HOME_SLUG)

  if (!page) {
    notFound()
  }

  const settings = await getSiteSettings()
  const overrides = findNavOverridesForPath(settings.primaryNav, '/')
  const heading = overrides?.pageHeading?.trim() || page.title
  const showAdminsOnly = params.notice === 'admins-only'
  const showCmsDenied = params.notice === 'cms-denied'

  return (
    <article className="cms-page">
      {showAdminsOnly ? (
        <div className="notice-banner" role="status">
          <p>
            <strong>Admins only.</strong> Starforge admin (<code>/app/admin</code>) is for role{' '}
            <code>admin</code>. Sign in as a seed admin or set <code>STARFORGE_ADMIN_EMAILS</code>.
          </p>
        </div>
      ) : null}
      {showCmsDenied ? (
        <div className="notice-banner" role="status">
          <p>
            <strong>No CMS access.</strong> Content CMS (<code>/admin</code>) needs{' '}
            <code>cms_access</code>. Ask a Starforge admin under{' '}
            <Link href="/app/admin/users">Users</Link>, or sign in as the seed admin.
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
