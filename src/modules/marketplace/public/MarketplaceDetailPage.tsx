import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import {
  getAccessViewer,
  viewerMayAccessAdminResource,
} from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode, type AppLocale } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPaymentsSettings } from '@/modules/payments/api'
import { getPersonas } from '@/modules/profiles/api.server'
import { runMarketplaceDoor } from '@/modules/marketplace/api.server'

import { listingDistanceKm } from '../browse-rules'
import {
  browseFiltersFromSearchParams,
  getMarketplaceListing,
  getPublicMarketplaceListing,
  syncExpiredMarketplaceListings,
} from '../listings'
import {
  formatListingCondition,
  formatListingDistanceKm,
  formatListingPrice,
} from './format'
import { resolveListingMediaSrcs } from './media-src'
import { ListingStatusActions } from './ListingStatusActions'
import { MarketplacePublicNav } from './MarketplacePublicNav'

type Args = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    return { title: `Not found — ${siteName}` }
  }
  const listing = await getMarketplaceListing(id)
  if (!listing) return { title: `Not found — ${siteName}` }
  return {
    title: `${listing.title} — Marketplace`,
    description: listing.description.slice(0, 160) || listing.title,
  }
}

export default async function MarketplaceDetailPage({ params, searchParams }: Args) {
  const { locale: localeParam, id } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  const door = await runMarketplaceDoor(
    () => isCatalogModuleEnabled(settings, MODULE_IDS.marketplace),
    async () => {
      const viewer = await getAccessViewer()
      const isStaff =
        viewer.isAppAdmin ||
        (await viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit'))
      await syncExpiredMarketplaceListings([id])
      const found = await getPublicMarketplaceListing(id, {
        viewerUserId: viewer.userId,
        isStaff,
      })
      if (!found) return null
      const [pay, personas, photos, sp] = await Promise.all([
        getPaymentsSettings(),
        getPersonas([found.listing.sellerUserId], viewer),
        resolveListingMediaSrcs(found.listing.mediaIds),
        searchParams,
      ])
      const filters = browseFiltersFromSearchParams(sp)
      const distanceKm = listingDistanceKm(found.listing, filters.viewer)
      const seller = personas.get(found.listing.sellerUserId)
      const isOwner =
        Boolean(viewer.userId) && viewer.userId === found.listing.sellerUserId
      return {
        found,
        currency: pay.currency || 'HUF',
        sellerLabel: seller?.displayName || seller?.handle || 'Seller',
        photos,
        distanceKm,
        viewer,
        isStaff,
        isOwner,
      }
    },
  )
  if (!door.ok) notFound()
  if (!door.value) notFound()

  const {
    found,
    currency,
    sellerLabel,
    photos,
    distanceKm,
    viewer,
    isStaff,
    isOwner,
  } = door.value
  const { listing, categoryTitle, publicVisible } = found
  const canManage = isOwner || isStaff
  const canEdit =
    canManage &&
    (isStaff || listing.status === 'draft' || listing.status === 'active')
  const distance = formatListingDistanceKm(distanceKm)

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>{listing.title}</h1>
        <p className="lede">
          {formatListingPrice(listing.priceMinor, currency, locale)} ·{' '}
          {formatListingCondition(listing.condition)}
          {categoryTitle ? ` · ${categoryTitle}` : ''}
        </p>
      </header>
      <MarketplacePublicNav
        locale={locale}
        active="browse"
        signedIn={Boolean(viewer.userId)}
      />

      {!publicVisible ? (
        <p className="settings-hint" role="status">
          This listing is not public ({listing.status}).
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div className="sf-marketplace-detail-photos">
          {photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="sf-marketplace-detail-photo" />
          ))}
        </div>
      ) : null}

      <div className="sf-marketplace-detail-meta">
        <p>
          <strong>Area:</strong>{' '}
          {[listing.areaLabel, distance].filter(Boolean).join(' · ') || 'Not set'}
        </p>
        <p>
          <strong>Seller:</strong> {sellerLabel}
        </p>
        {listing.expiresAt ? (
          <p>
            <strong>Expires:</strong> {listing.expiresAt.toLocaleString(locale)}
          </p>
        ) : null}
        <p>
          <strong>Status:</strong> {listing.status}
        </p>
      </div>

      {listing.description ? (
        <div className="sf-marketplace-detail-body">
          <p style={{ whiteSpace: 'pre-wrap' }}>{listing.description}</p>
        </div>
      ) : null}

      {canManage ? (
        <section className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h2>Seller tools</h2>
          </div>
          <div className="page-settings-panel-body">
            {canEdit ? (
              <p>
                <Link
                  href={withLocalePrefix(
                    `/marketplace/${listing.id}/edit`,
                    locale as AppLocale,
                  )}
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                >
                  Edit listing
                </Link>
              </p>
            ) : null}
            <ListingStatusActions
              listingId={listing.id}
              status={listing.status}
              canManage={canManage}
            />
          </div>
        </section>
      ) : null}
    </article>
  )
}
