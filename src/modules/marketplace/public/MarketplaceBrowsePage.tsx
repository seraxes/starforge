import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
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
import { resolveListingMediaSrc } from './media-src'
import { MarketplacePublicNav } from './MarketplacePublicNav'

type Args = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
    title: 'Marketplace',
    description: `Browse local listings on ${siteName}.`,
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
      }
    },
  )
  if (!door.ok) notFound()

  const { browse, categories, currency, viewer, filters, thumbs } = door.value
  const signedIn = Boolean(viewer.userId)
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')
  const sp = await searchParams

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>Marketplace</h1>
        <p className="lede">Local classifieds. Meet in person — no street addresses shown.</p>
      </header>
      <MarketplacePublicNav locale={locale} active="browse" signedIn={signedIn} />

      <form className="page-settings-panel sf-marketplace-filters" method="get">
        <div className="page-settings-panel-body">
          <div className="admin-control-row">
            <label className="settings-field">
              <span>Search</span>
              <input name="q" type="search" defaultValue={one(sp.q)} />
            </label>
            <label className="settings-field">
              <span>Category</span>
              <select name="category" defaultValue={filters.categoryId || ''}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>Condition</span>
              <select name="condition" defaultValue={filters.condition || ''}>
                <option value="">Any</option>
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </label>
          </div>
          <div className="admin-control-row">
            <label className="settings-field">
              <span>Min price (minor)</span>
              <input
                name="priceMin"
                type="number"
                min={0}
                step={1}
                defaultValue={
                  filters.priceMinMinor != null && Number.isFinite(filters.priceMinMinor)
                    ? String(filters.priceMinMinor)
                    : ''
                }
              />
            </label>
            <label className="settings-field">
              <span>Max price (minor)</span>
              <input
                name="priceMax"
                type="number"
                min={0}
                step={1}
                defaultValue={
                  filters.priceMaxMinor != null && Number.isFinite(filters.priceMaxMinor)
                    ? String(filters.priceMaxMinor)
                    : ''
                }
              />
            </label>
            <label className="settings-field">
              <span>Sort</span>
              <select name="sort" defaultValue={filters.sort || 'newest'}>
                <option value="newest">Newest</option>
                <option value="price">Price</option>
                <option value="distance">Distance</option>
              </select>
            </label>
          </div>
          <div className="admin-control-row">
            <label className="settings-field">
              <span>Your latitude</span>
              <input
                name="lat"
                type="number"
                step="any"
                defaultValue={filters.viewer?.latitude ?? ''}
              />
            </label>
            <label className="settings-field">
              <span>Your longitude</span>
              <input
                name="lng"
                type="number"
                step="any"
                defaultValue={filters.viewer?.longitude ?? ''}
              />
            </label>
            <label className="settings-field">
              <span>Max distance (km)</span>
              <input
                name="distance"
                type="number"
                min={0}
                step="any"
                defaultValue={
                  filters.maxDistanceKm != null && Number.isFinite(filters.maxDistanceKm)
                    ? String(filters.maxDistanceKm)
                    : ''
                }
              />
            </label>
          </div>
        </div>
        <div className="page-settings-actions">
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save">
            Apply filters
          </button>
        </div>
      </form>

      {browse.error ? (
        <p className="admin-inline-error" role="alert">
          {browse.error}
        </p>
      ) : null}

      {browse.listings.length === 0 ? (
        <p className="lede">No listings match these filters.</p>
      ) : (
        <ul className="sf-marketplace-browse-list">
          {browse.listings.map((listing) => {
            const thumb = thumbs.get(listing.id) || ''
            const distance = formatListingDistanceKm(listing.distanceKm)
            return (
              <li key={listing.id} className="sf-marketplace-browse-item">
                <Link
                  href={withLocalePrefix(
                    `/marketplace/${listing.id}`,
                    locale as AppLocale,
                  )}
                  className="sf-marketplace-browse-link"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="sf-marketplace-browse-thumb" />
                  ) : (
                    <span className="sf-marketplace-browse-thumb is-empty" aria-hidden />
                  )}
                  <span className="sf-marketplace-browse-body">
                    <strong>{listing.title}</strong>
                    <span>
                      {formatListingPrice(listing.priceMinor, currency, locale)} ·{' '}
                      {formatListingCondition(listing.condition)}
                    </span>
                    <span>
                      {[listing.areaLabel, distance].filter(Boolean).join(' · ') ||
                        'Area not set'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
