import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPackages } from '../store'
import { AdsAdminNav } from './ads-admin-nav'
import { PackagesManager } from './packages-manager'

export const metadata = {
  title: 'Packages — Ads — Starforge',
}

export default async function AdsPackagesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.ads)) {
    redirect('/admin/settings')
  }

  const packages = await listPackages()

  let currency = 'HUF'
  try {
    const { getPaymentsSettings } = await import('@/modules/payments/api')
    currency = (await getPaymentsSettings()).currency || 'HUF'
  } catch {
    /* payments optional at render if migrate pending */
  }

  return (
    <section className="admin-section admin-layouts-full">
      <AdsAdminNav active="packages" />
      <h2>Packages</h2>
      <p className="lede admin-lede">
        Sellable ad SKUs and credit bundles. Price lives here for a later Payments snapshot —
        there is no cart or checkout in this slice.
      </p>
      <PackagesManager packages={packages} currency={currency} />
    </section>
  )
}
