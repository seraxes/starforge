import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  listMarketplaceCategories,
  loadMarketplaceCategoryLocaleMaps,
  orderMarketplaceCategoriesTree,
} from '../categories'
import { CategoriesManager } from './categories-manager'
import { MarketplaceAdminNav } from './marketplace-admin-nav'

export const metadata = {
  title: 'Categories — Marketplace — Starforge',
  description: 'Marketplace category tree (Marketplace module).',
}

/** product:marketplace — admin category list and edit. */
export default async function MarketplaceCategoriesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    redirect('/admin/settings')
  }

  const [categories, locales] = await Promise.all([
    listMarketplaceCategories(),
    getContentLocaleOptions(),
  ])
  const localeCodes = locales.map((locale) => locale.code)
  const ordered = orderMarketplaceCategoriesTree(categories)
  const rows = await Promise.all(
    ordered.map(async (category) => {
      const maps = await loadMarketplaceCategoryLocaleMaps(category.id, localeCodes)
      return {
        id: category.id,
        title: category.title,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        depth: category.depth,
        enabled: category.enabled,
        sortOrder: category.sortOrder,
        titleLocales: maps.titleLocales,
        descriptionLocales: maps.descriptionLocales,
        updatedAt: category.updatedAt.toISOString(),
      }
    }),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <MarketplaceAdminNav active="categories" />
      <h2>Categories</h2>
      <p className="lede admin-lede">
        <strong>Add +</strong> · table · Edit one category. Names sync to content-locale files and
        can also be edited under <Link href="/admin/localization">Localization</Link>. Moderation:{' '}
        <Link href="/admin/marketplace/listings">Listings</Link>.
      </p>
      <CategoriesManager categories={rows} locales={locales} />
    </section>
  )
}
