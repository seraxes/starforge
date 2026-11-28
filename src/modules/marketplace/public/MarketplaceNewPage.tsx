import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
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

import { listMarketplaceCategories } from '../categories'
import { loadMarketplaceModuleSettings } from '../settings'
import { ListingForm } from './ListingForm'
import { MarketplacePublicNav } from './MarketplacePublicNav'

type Args = {
  params: Promise<{ locale: string }>
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
    title: t('sellMetaTitle'),
    description: t('sellMetaDescription', { siteName }),
  }
}

export default async function MarketplaceNewPage({ params }: Args) {
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
          withLocalePrefix('/login?next=/marketplace/new', locale as AppLocale),
        )
      }
      const [categories, moduleSettings, pay] = await Promise.all([
        listMarketplaceCategories(),
        loadMarketplaceModuleSettings(),
        getPaymentsSettings(),
      ])
      return {
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

  const { categories, photoCap, currency, viewer } = door.value
  const t = await getTranslations('product:marketplace')

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>{t('sellTitle')}</h1>
        <p className="lede">{t('sellLede')}</p>
      </header>
      <MarketplacePublicNav locale={locale} active="new" signedIn={Boolean(viewer.userId)} />
      <ListingForm
        locale={locale}
        mode="create"
        categories={categories}
        photoCap={photoCap}
        currency={currency}
        initial={{
          title: '',
          description: '',
          condition: 'used',
          priceMinor: null,
          categoryId: '',
          areaLabel: '',
          latitude: null,
          longitude: null,
          mediaIds: [],
        }}
      />
    </article>
  )
}
