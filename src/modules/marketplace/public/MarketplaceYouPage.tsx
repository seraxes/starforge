import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode, type AppLocale } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPaymentsSettings } from '@/modules/payments/api'
import { runMarketplaceDoor } from '@/modules/marketplace/api.server'

import {
  listMarketplaceListingsForSeller,
  syncExpiredMarketplaceListings,
} from '../listings'
import { formatListingCondition, formatListingPrice } from './format'
import { MarketplacePublicNav } from './MarketplacePublicNav'

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
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    return { title: `Not found — ${siteName}` }
  }
  return {
    title: 'Your listings — Marketplace',
    description: `Your Marketplace listings on ${siteName}.`,
  }
}

export default async function MarketplaceYouPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  const door = await runMarketplaceDoor(
    () => isCatalogModuleEnabled(settings, MODULE_IDS.marketplace),
    async () => {
      const viewer = await getAccessViewer()
      if (!viewer.userId) {
        redirect(
          withLocalePrefix('/login?next=/marketplace/you', locale as AppLocale),
        )
      }
      await syncExpiredMarketplaceListings()
      const [listings, pay] = await Promise.all([
        listMarketplaceListingsForSeller(viewer.userId!),
        getPaymentsSettings(),
      ])
      return {
        listings,
        currency: pay.currency || 'HUF',
        viewer,
      }
    },
  )
  if (!door.ok) notFound()

  const { listings, currency, viewer } = door.value

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>Your listings</h1>
        <p className="lede">
          Seller listings only. Saves and inquiries come in later slices.
        </p>
      </header>
      <MarketplacePublicNav locale={locale} active="you" signedIn={Boolean(viewer.userId)} />

      {listings.length === 0 ? (
        <p className="lede">
          No listings yet.{' '}
          <Link href={withLocalePrefix('/marketplace/new', locale as AppLocale)}>
            Sell an item
          </Link>
          .
        </p>
      ) : (
        <ul className="sf-marketplace-you-list">
          {listings.map((listing) => (
            <li key={listing.id} className="sf-marketplace-you-item">
              <Link
                href={withLocalePrefix(
                  `/marketplace/${listing.id}`,
                  locale as AppLocale,
                )}
              >
                <strong>{listing.title}</strong>
              </Link>
              <span>
                {formatListingPrice(listing.priceMinor, currency, locale)} ·{' '}
                {formatListingCondition(listing.condition)} · {listing.status}
              </span>
              {(listing.status === 'draft' || listing.status === 'active') && (
                <Link
                  href={withLocalePrefix(
                    `/marketplace/${listing.id}/edit`,
                    locale as AppLocale,
                  )}
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                >
                  Edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
