import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { loadMarketplaceModuleSettings } from '../settings'
import { MarketplaceAdminNav } from './marketplace-admin-nav'
import { MarketplaceSettingsForm } from './marketplace-settings-form'

export const metadata = {
  title: 'Marketplace settings — Starforge',
  description: 'Marketplace module settings (expiry, photos, offers, listing fee).',
}

/** product:marketplace settings admin. */
export default async function MarketplaceSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    redirect('/admin/settings')
  }

  const loaded = await loadMarketplaceModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <MarketplaceAdminNav active="settings" />
      <h2>Marketplace settings</h2>
      <p className="lede admin-lede">
        Expiry, photo cap, offers, and listing-fee switch. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Listings:{' '}
        <Link href="/admin/marketplace/listings">Listings</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run{' '}
          <code>npm run db:migrate</code> if <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <MarketplaceSettingsForm settings={loaded.settings} />
    </section>
  )
}
