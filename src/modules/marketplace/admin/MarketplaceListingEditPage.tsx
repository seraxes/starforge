import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import {
  getAccessViewer,
  viewerMayAccessAdminResource,
} from '@/core/acl/access'
import { isValidLocaleCode, type AppLocale } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getPaymentsSettings } from '@/modules/payments/api'

import { listMarketplaceCategories } from '../categories'
import { decideListingEdit } from '../listing-rules'
import { getMarketplaceListing } from '../listings'
import { loadMarketplaceModuleSettings } from '../settings'
import { ListingForm } from '../public/ListingForm'
import { MarketplaceAdminNav } from './marketplace-admin-nav'

export const metadata = {
  title: 'Edit listing — Marketplace — Starforge',
  description: 'Edit a Marketplace listing (admin).',
}

type Params = Promise<{ id: string }>

/** product:marketplace — admin listing editor (stays under /admin). */
export default async function MarketplaceListingEditPage({
  params,
}: {
  params: Params
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    redirect('/admin/settings')
  }

  const { id: rawId } = await params
  const id = (rawId || '').trim()
  if (!id) notFound()

  const viewer = await getAccessViewer()
  const isStaff =
    viewer.isAppAdmin ||
    (await viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit'))
  if (!viewer.userId || !isStaff) {
    redirect('/admin/marketplace/listings')
  }

  const listing = await getMarketplaceListing(id)
  if (!listing) notFound()

  const decision = decideListingEdit(
    { userId: viewer.userId, isStaff: true },
    listing,
  )
  if (!decision.ok) notFound()

  const [categories, moduleSettings, pay] = await Promise.all([
    listMarketplaceCategories(),
    loadMarketplaceModuleSettings(),
    getPaymentsSettings(),
  ])

  const editLocale = (
    isValidLocaleCode(settings.defaultLocale) ? settings.defaultLocale : 'en'
  ) as AppLocale

  return (
    <section className="admin-section admin-layouts-full">
      <MarketplaceAdminNav active="listings" />
      <p className="sf-events-editor-back">
        <Link href="/admin/marketplace/listings">← Listings</Link>
      </p>
      <h2>Edit · {listing.title}</h2>
      <p className="lede admin-lede">
        Staff listing editor. Public sellers edit at{' '}
        <code>/marketplace/[id]/edit</code>. Shared form fields; this shell stays under{' '}
        <code>/admin</code>.
      </p>

      <div className="page-settings-panel">
        <div className="page-settings-panel-body">
          <ListingForm
            locale={editLocale}
            mode="edit"
            categories={categories.map((c) => ({
              id: c.id,
              title: c.title,
              enabled: c.enabled,
            }))}
            photoCap={moduleSettings.settings.photoCap}
            currency={pay.currency || 'HUF'}
            successHref={`/admin/marketplace/listings/${listing.id}`}
            cancelHref="/admin/marketplace/listings"
            photosPicker="library"
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
        </div>
      </div>
    </section>
  )
}
