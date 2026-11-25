import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPlacements } from '../store'
import { AdsAdminNav } from './ads-admin-nav'
import { PlacementsManager } from './placements-manager'

export const metadata = {
  title: 'Placements — Ads — Starforge',
}

export default async function AdsPlacementsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.ads)) {
    redirect('/admin/settings')
  }

  const placements = await listPlacements()

  return (
    <section className="admin-section admin-layouts-full">
      <AdsAdminNav active="placements" />
      <h2>Placements</h2>
      <p className="lede admin-lede">
        Where a creative may appear. Placement policy stays in Ads; Social and layout render via
        the public door later.
      </p>
      <PlacementsManager placements={placements} />
    </section>
  )
}
