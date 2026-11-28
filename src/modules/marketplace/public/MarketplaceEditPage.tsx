import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
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
import { runMarketplaceDoor } from '@/modules/marketplace/api.server'

import { listMarketplaceCategories } from '../categories'
import { decideListingEdit } from '../listing-rules'
import { getMarketplaceListing } from '../listings'
import { loadMarketplaceModuleSettings } from '../settings'
import { ListingForm } from './ListingForm'
import { MarketplacePublicNav } from './MarketplacePublicNav'

type Args = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, id } = await params
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
  const listing = await getMarketplaceListing(id)
  if (!listing) return { title: t('notFoundTitle', { siteName }) }
  return {
    title: t('editMetaTitle', { title: listing.title }),
    description: t('editMetaDescription', { siteName }),
  }
}

export default async function MarketplaceEditPage({ params }: Args) {
  const { locale: localeParam, id } = await params
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
          withLocalePrefix(
            `/login?next=/marketplace/${encodeURIComponent(id)}/edit`,
            locale as AppLocale,
          ),
        )
      }
      const listing = await getMarketplaceListing(id)
      if (!listing) return null
      const isStaff =
        viewer.isAppAdmin ||
        (await viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit'))
      const decision = decideListingEdit(
        { userId: viewer.userId!, isStaff },
        listing,
      )
      if (!decision.ok) return { forbidden: true as const }
      const [categories, moduleSettings, pay] = await Promise.all([
        listMarketplaceCategories(),
        loadMarketplaceModuleSettings(),
        getPaymentsSettings(),
      ])
      return {
        listing,
        categories: categories.map((c) => ({
          id: c.id,
          title: c.title,
          enabled: c.enabled,
        })),
        photoCap: moduleSettings.settings.photoCap,
        currency: pay.currency || 'HUF',
        viewer,
      }
    },
  )
  if (!door.ok) notFound()
  if (!door.value) notFound()
  if ('forbidden' in door.value) notFound()

  const { listing, categories, photoCap, currency, viewer } = door.value
  const t = await getTranslations('product:marketplace')

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>{t('editListingTitle')}</h1>
        <p className="lede">{listing.title}</p>
      </header>
      <MarketplacePublicNav
        locale={locale}
        active="you"
        signedIn={Boolean(viewer.userId)}
      />
      <ListingForm
        locale={locale}
        mode="edit"
        categories={categories}
        photoCap={photoCap}
        currency={currency}
        initial={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          condition: listing.condition,
          priceMinor: listing.priceMinor,
          categoryId: listing.categoryId,
          areaLabel: listing.areaLabel,
          latitude: listing.latitude,
          longitude: listing.longitude,
          mediaIds: listing.mediaIds,
        }}
      />
    </article>
  )
}
