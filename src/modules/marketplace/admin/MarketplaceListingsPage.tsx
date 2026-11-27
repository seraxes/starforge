import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listMarketplaceListingsForAdmin } from '../listings'
import { ListingsModeration } from './listings-moderation'
import { MarketplaceAdminNav } from './marketplace-admin-nav'

export const metadata = {
  title: 'Listings — Marketplace — Starforge',
  description: 'Marketplace listing moderation (Marketplace module).',
}

/** product:marketplace — admin listing moderation list. */
export default async function MarketplaceListingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    redirect('/admin/settings')
  }

  const loaded = await listMarketplaceListingsForAdmin()
  const rows = loaded.listings.map((listing) => ({
    id: listing.id,
    sellerUserId: listing.sellerUserId,
    categoryId: listing.categoryId,
    title: listing.title,
    description: listing.description,
    priceMinor: listing.priceMinor,
    condition: listing.condition,
    status: listing.status,
    areaLabel: listing.areaLabel,
    latitude: listing.latitude,
    longitude: listing.longitude,
    expiresAt: listing.expiresAt ? listing.expiresAt.toISOString() : null,
    soldToUserId: listing.soldToUserId,
    mediaIds: listing.mediaIds,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <MarketplaceAdminNav active="listings" />
      <h2>Listings</h2>
      <p className="lede admin-lede">
        Staff moderation — edit, hide, remove, restore. Title or Edit opens the admin listing
        editor. Categories: <Link href="/admin/marketplace">Categories</Link>. Settings:{' '}
        <Link href="/admin/marketplace/settings">Settings</Link>.
      </p>
      <ListingsModeration listings={rows} loadError={loaded.error} />
    </section>
  )
}
