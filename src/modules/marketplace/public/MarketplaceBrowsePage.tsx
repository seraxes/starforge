import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode, type AppLocale } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPaymentsSettings } from '@/modules/payments/api'
import { runMarketplaceDoor } from '@/modules/marketplace/api.server'

import { listMarketplaceCategories } from '../categories'
import {
  browseFiltersFromSearchParams,
  queryPublicMarketplaceListings,
  syncExpiredMarketplaceListings,
} from '../listings'
import {
  formatListingCondition,
  formatListingDistanceKm,
  formatListingPrice,
} from './format'
import { ListingCard } from './ListingCard'
import { resolveListingMediaSrc } from './media-src'
import { MarketplaceBrowseFilters } from './MarketplaceBrowseFilters'
import { MarketplacePublicNav } from './MarketplacePublicNav'

type Args = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  const t = await getTranslations({
    locale: isValidLocaleCode(localeParam) ? localeParam : 'en',
    namespace: 'product:marketplace',
  })
  if (!isValidLocaleCode(localeParam)) {
    return { title: t('notFoundTitle', { siteName }) }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    return { title: t('notFoundTitle', { siteName }) }
  }
  return {
    title: t('browseTitle'),
    description: t('browseMetaDescription', { siteName }),
  }
}

export default async function MarketplaceBrowsePage({ params, searchParams }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  const door = await runMarketplaceDoor(
    () => isCatalogModuleEnabled(settings, MODULE_IDS.marketplace),
    async () => {
      const sp = await searchParams
      const filters = browseFiltersFromSearchParams(sp)
      await syncExpiredMarketplaceListings()
      const [browse, categories, pay, viewer] = await Promise.all([
        queryPublicMarketplaceListings(filters),
        listMarketplaceCategories(),
        getPaymentsSettings(),
        getAccessViewer(),
      ])
      const thumbs = await Promise.all(
        browse.listings.map(async (listing) => ({
          id: listing.id,
          src: listing.mediaIds[0]
            ? await resolveListingMediaSrc(listing.mediaIds[0])
            : '',
        })),
      )
      return {
        browse,
        categories: categories.filter((c) => c.enabled),
        currency: pay.currency || 'HUF',
        viewer,
        filters,
        thumbs: new Map(thumbs.map((t) => [t.id, t.src])),
        sp,
      }
    },
  )
  if (!door.ok) notFound()

  const { browse, categories, currency, viewer, filters, thumbs, sp } = door.value
  const signedIn = Boolean(viewer.userId)
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')
  const t = await getTranslations('product:marketplace')
  const conditionLabels = {
    new: t('conditionNew'),
    used: t('conditionUsed'),
    refurbished: t('conditionRefurbished'),
  }

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>{t('browseTitle')}</h1>
        <p className="lede">{t('browseLede')}</p>
      </header>
      <MarketplacePublicNav locale={locale} active="browse" signedIn={signedIn} />

      <MarketplaceBrowseFilters
        categories={categories.map((c) => ({ id: c.id, title: c.title }))}
        filters={filters}
        currency={currency}
        defaults={{
          q: one(sp.q),
          lat: one(sp.lat),
          lng: one(sp.lng),
          distance: one(sp.distance),
        }}
      />

      {browse.error ? (
        <p className="admin-inline-error" role="alert">
          {browse.error}
        </p>
      ) : null}

      {browse.listings.length === 0 ? (
        <p className="lede">{t('emptyNoMatches')}</p>
      ) : (
        <ul className="sf-marketplace-card-grid">
          {browse.listings.map((listing) => {
            const thumb = thumbs.get(listing.id) || ''
            const distance = formatListingDistanceKm(listing.distanceKm)
            return (
              <ListingCard
                key={listing.id}
                href={withLocalePrefix(
                  `/marketplace/${listing.id}`,
                  locale as AppLocale,
                )}
                title={listing.title}
                priceLabel={formatListingPrice(
                  listing.priceMinor,
                  currency,
                  locale,
                  t('free'),
                )}
                conditionLabel={formatListingCondition(listing.condition, conditionLabels)}
                areaLabel={listing.areaLabel}
                thumbSrc={thumb}
                footnote={distance || undefined}
              />
            )
          })}
        </ul>
      )}
    </article>
  )
}
