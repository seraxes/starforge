import type { Metadata } from 'next'
import Link from 'next/link'
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

import {
  listMarketplaceListingsForSeller,
  syncExpiredMarketplaceListings,
} from '../listings'
import { listMarketplaceSavesForUser } from '../saves'
import {
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
} from './format'
import { ListingCard } from './ListingCard'
import { MarketplacePublicNav } from './MarketplacePublicNav'
import { resolveListingMediaSrc } from './media-src'
import { SaveListingActions } from './SaveListingActions'

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
    title: `${t('youTitle')} — ${t('browseTitle')}`,
    description: t('youMetaDescription', { siteName }),
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
      const [listings, saves, pay] = await Promise.all([
        listMarketplaceListingsForSeller(viewer.userId!),
        listMarketplaceSavesForUser(viewer.userId!),
        getPaymentsSettings(),
      ])
      const thumbIds = [
        ...listings.map((l) => ({ id: l.id, mediaId: l.mediaIds[0] || '' })),
        ...saves.map(({ listing }) => ({
          id: listing.id,
          mediaId: listing.mediaIds[0] || '',
        })),
      ]
      const thumbs = await Promise.all(
        thumbIds.map(async ({ id, mediaId }) => ({
          id,
          src: mediaId ? await resolveListingMediaSrc(mediaId) : '',
        })),
      )
      return {
        listings,
        saves,
        currency: pay.currency || 'HUF',
        viewer,
        thumbs: new Map(thumbs.map((t) => [t.id, t.src])),
      }
    },
  )
  if (!door.ok) notFound()

  const { listings, saves, currency, viewer, thumbs } = door.value
  const signedIn = Boolean(viewer.userId)
  const t = await getTranslations('product:marketplace')
  const conditionLabels = {
    new: t('conditionNew'),
    used: t('conditionUsed'),
    refurbished: t('conditionRefurbished'),
  }
  const statusLabels = {
    draft: t('statusDraft'),
    active: t('statusActive'),
    pending: t('statusPending'),
    sold: t('statusSold'),
    hidden: t('statusHidden'),
    removed: t('statusRemoved'),
    expired: t('statusExpired'),
  }

  return (
    <article className="cms-page sf-marketplace-page">
      <header className="cms-page-header">
        <h1>{t('youTitle')}</h1>
        <p className="lede">{t('youLede')}</p>
      </header>
      <MarketplacePublicNav locale={locale} active="you" signedIn={signedIn} />

      <section className="sf-marketplace-you-section">
        <h2 className="sf-marketplace-section-heading">{t('yourListingsHeading')}</h2>
        {listings.length === 0 ? (
          <p className="lede">
            {t('emptyNoListingsPrefix')}{' '}
            <Link href={withLocalePrefix('/marketplace/new', locale as AppLocale)}>
              {t('emptySellCta')}
            </Link>
            .
          </p>
        ) : (
          <ul className="sf-marketplace-card-grid">
            {listings.map((listing) => {
              const canEdit =
                listing.status === 'draft' || listing.status === 'active'
              const editHref = withLocalePrefix(
                `/marketplace/${listing.id}/edit`,
                locale as AppLocale,
              )
              const detailHref = withLocalePrefix(
                `/marketplace/${listing.id}`,
                locale as AppLocale,
              )
              return (
                <ListingCard
                  key={listing.id}
                  href={canEdit ? editHref : detailHref}
                  title={listing.title}
                  priceLabel={formatListingPrice(
                    listing.priceMinor,
                    currency,
                    locale,
                    t('free'),
                  )}
                  conditionLabel={formatListingCondition(
                    listing.condition,
                    conditionLabels,
                  )}
                  areaLabel={listing.areaLabel}
                  thumbSrc={thumbs.get(listing.id) || ''}
                  footnote={formatListingStatus(listing.status, statusLabels)}
                  actions={
                    canEdit ? (
                      <Link
                        href={editHref}
                        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      >
                        {t('edit')}
                      </Link>
                    ) : null
                  }
                />
              )
            })}
          </ul>
        )}
      </section>

      <section className="sf-marketplace-you-section">
        <h2 className="sf-marketplace-section-heading">{t('savedHeading')}</h2>
        {saves.length === 0 ? (
          <p className="lede">{t('emptyNoSaves')}</p>
        ) : (
          <ul className="sf-marketplace-card-grid">
            {saves.map(({ listing }) => (
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
                conditionLabel={formatListingCondition(
                  listing.condition,
                  conditionLabels,
                )}
                areaLabel={listing.areaLabel}
                thumbSrc={thumbs.get(listing.id) || ''}
                footnote={formatListingStatus(listing.status, statusLabels)}
                actions={
                  <SaveListingActions
                    listingId={listing.id}
                    saved
                    signedIn={signedIn}
                  />
                }
              />
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
