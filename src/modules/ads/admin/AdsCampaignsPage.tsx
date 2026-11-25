import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listCampaigns, listPackages, listPlacements } from '../store'
import { AdsAdminNav } from './ads-admin-nav'
import { CampaignsManager } from './campaigns-manager'

export const metadata = {
  title: 'Campaigns — Ads — Starforge',
}

export default async function AdsCampaignsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.ads)) {
    redirect('/admin/settings')
  }

  const [campaigns, packages, placements] = await Promise.all([
    listCampaigns(),
    listPackages(),
    listPlacements(),
  ])
  const mediaEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.media)

  return (
    <section className="admin-section admin-layouts-full">
      <AdsAdminNav active="campaigns" />
      <h2>Campaigns</h2>
      <p className="lede admin-lede">
        Bind a buyer, package, placement(s), schedule, and creative. Go-live and Social publish
        are not in this slice — keep campaigns draft, pending, or offline.
      </p>
      <CampaignsManager
        campaigns={campaigns}
        packages={packages}
        placements={placements}
        mediaEnabled={mediaEnabled}
      />
    </section>
  )
}
