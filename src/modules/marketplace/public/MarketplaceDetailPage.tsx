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
  listMarketplaceInquiriesForListing,
  loadMarketplaceBuyerThread,
} from '../inquiries'
import {
  browseFiltersFromSearchParams,
  getMarketplaceListing,
  getPublicMarketplaceListing,
  syncExpiredMarketplaceListings,
} from '../listings'
import {
  getMarketplaceRatingEligibility,
  getPublicMarketplaceRatingAverage,
} from '../ratings'
import { isMarketplaceListingSaved } from '../saves'
import { loadMarketplaceModuleSettings } from '../settings'
import {
  formatListingCondition,
  formatListingDate,
  formatListingDistanceKm,
  formatListingPrice,
  formatListingStatus,
} from './format'
import { BuyerInquiryPanel, SellerInquiryPanel } from './InquiryActions'
import { resolveListingMediaSrcs } from './media-src'
import { ListingStatusActions } from './ListingStatusActions'
import { MarketplacePublicNav } from './MarketplacePublicNav'
import { RatingSubmitForm } from './RatingActions'
import { SaveListingActions } from './SaveListingActions'
import { ShareToFeedAction } from './ShareToFeedAction'

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
      const isOwner =
        Boolean(viewer.userId) && viewer.userId === found.listing.sellerUserId
      const [
        pay,
        personas,
        photos,
        sp,
        saved,
        moduleSettings,
        buyerThread,
        sellerThreads,
        sellerRatingAvg,
        ratingEligibility,
      ] = await Promise.all([
        getPaymentsSettings(),
        getPersonas([found.listing.sellerUserId], viewer),
        resolveListingMediaSrcs(found.listing.mediaIds),
        searchParams,
        viewer.userId
          ? isMarketplaceListingSaved(viewer.userId, found.listing.id)
          : Promise.resolve(false),
        loadMarketplaceModuleSettings(),
        viewer.userId && !isOwner
          ? loadMarketplaceBuyerThread(found.listing.id, viewer.userId)
          : Promise.resolve(null),
        isOwner || isStaff
          ? listMarketplaceInquiriesForListing(found.listing.id)
          : Promise.resolve([]),
        getPublicMarketplaceRatingAverage(found.listing.sellerUserId),
        viewer.userId
          ? getMarketplaceRatingEligibility(found.listing.id, viewer.userId)
          : Promise.resolve({
              canRate: false,
              direction: null,
              toUserId: null,
              alreadyRated: false,
            }),
      ])
      const filters = browseFiltersFromSearchParams(sp)
      const distanceKm = listingDistanceKm(found.listing, filters.viewer)
      const seller = personas.get(found.listing.sellerUserId)
      return {
        found,
        currency: pay.currency || 'HUF',
        sellerLabel: seller?.displayName || seller?.handle || 'Seller',
        photos,
        distanceKm,
        viewer,
        isStaff,
        isOwner,
        saved,
        offersEnabled: moduleSettings.settings.offersEnabled,
        buyerThread,
        sellerThreads,
        sellerRatingAvg,
        ratingEligibility,
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
    saved,
    offersEnabled,
    buyerThread,
    sellerThreads,
    sellerRatingAvg,
    ratingEligibility,
  } = door.value
  const { listing, categoryTitle, publicVisible } = found
  const canManage = isOwner || isStaff
  const canEdit =
    canManage &&
    (isStaff || listing.status === 'draft' || listing.status === 'active')
  const distance = formatListingDistanceKm(distanceKm)
  const signedIn = Boolean(viewer.userId)
  const showBuyerInquiry =
    !isOwner && (publicVisible || Boolean(buyerThread)) && listing.status !== 'removed'
  const showRatingForm =
    signedIn &&
    ratingEligibility.canRate &&
    ratingEligibility.direction &&
    ratingEligibility.toUserId
  const expiryLabel = formatListingDate(listing.expiresAt, locale)
  const areaLabel =
    [listing.areaLabel, distance].filter(Boolean).join(' · ') || 'Not set'
  const statusLabel = formatListingStatus(listing.status)

  return (
    <article className="cms-page sf-marketplace-page">
      <MarketplacePublicNav
        locale={locale}
        active="browse"
        signedIn={signedIn}
      />

      {!publicVisible ? (
        <p className="settings-hint" role="status">
          This listing is not public ({statusLabel}).
        </p>
      ) : null}

      <div className="sf-marketplace-detail">
        <div className="sf-marketplace-detail-gallery" aria-label="Photos">
          {photos.length > 0 ? (
            photos.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="sf-marketplace-detail-photo" />
            ))
          ) : (
            <div className="sf-marketplace-detail-photo is-empty" aria-hidden>
              <span>No photo</span>
            </div>
          )}
        </div>

        <div className="sf-marketplace-detail-summary">
          <header className="sf-marketplace-detail-header">
            <h1>{listing.title}</h1>
            <p className="sf-marketplace-detail-price">
              {formatListingPrice(listing.priceMinor, currency, locale)}
            </p>
          </header>

          {(publicVisible || saved || canManage) ? (
            <div className="sf-marketplace-detail-actions">
              {publicVisible || saved ? (
                <SaveListingActions
                  listingId={listing.id}
                  saved={saved}
                  signedIn={signedIn}
                />
              ) : null}
              {canEdit ? (
                <Link
                  href={withLocalePrefix(
                    `/marketplace/${listing.id}/edit`,
                    locale as AppLocale,
                  )}
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                >
                  Edit
                </Link>
              ) : null}
              {canManage ? (
                <>
                  <ListingStatusActions
                    listingId={listing.id}
                    status={listing.status}
                    canManage={canManage}
                  />
                  <ShareToFeedAction listingId={listing.id} canShare={canManage} />
                </>
              ) : null}
            </div>
          ) : null}

          <dl className="sf-marketplace-detail-facts">
            <div>
              <dt>Condition</dt>
              <dd>{formatListingCondition(listing.condition)}</dd>
            </div>
            {categoryTitle ? (
              <div>
                <dt>Category</dt>
                <dd>{categoryTitle}</dd>
              </div>
            ) : null}
            <div>
              <dt>Area</dt>
              <dd>{areaLabel}</dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>
                {sellerLabel}
                {sellerRatingAvg != null ? (
                  <>
                    {' '}
                    ·{' '}
                    <span title="Public Marketplace rating average">
                      {sellerRatingAvg.toFixed(1)} ★
                    </span>
                  </>
                ) : null}
              </dd>
            </div>
            {expiryLabel ? (
              <div>
                <dt>Expires</dt>
                <dd>{expiryLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Status</dt>
              <dd>
                {statusLabel}
                {listing.status === 'sold' && listing.soldToUserId
                  ? ` · sold to ${listing.soldToUserId.slice(0, 8)}…`
                  : ''}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {listing.description ? (
        <div className="sf-marketplace-detail-body">
          <p>{listing.description}</p>
        </div>
      ) : null}

      {showBuyerInquiry ? (
        <section className="page-settings-panel sf-marketplace-panel">
          <div className="page-settings-panel-head">
            <h2>Ask / offer</h2>
          </div>
          <div className="page-settings-panel-body">
            <BuyerInquiryPanel
              listingId={listing.id}
              signedIn={signedIn}
              offersEnabled={offersEnabled}
              thread={buyerThread}
              viewerUserId={viewer.userId || ''}
            />
          </div>
        </section>
      ) : null}

      {showRatingForm &&
      ratingEligibility.direction &&
      ratingEligibility.toUserId ? (
        <RatingSubmitForm
          listingId={listing.id}
          toUserId={ratingEligibility.toUserId}
          direction={ratingEligibility.direction}
          signedIn={signedIn}
        />
      ) : null}

      {canManage ? (
        <section className="page-settings-panel sf-marketplace-panel">
          <div className="page-settings-panel-head">
            <h2>Inquiries</h2>
          </div>
          <div className="page-settings-panel-body">
            <SellerInquiryPanel
              listingId={listing.id}
              threads={sellerThreads}
              viewerUserId={viewer.userId || ''}
            />
          </div>
        </section>
      ) : null}
    </article>
  )
}
