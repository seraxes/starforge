import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPlans, listUpgradePaths } from '../store'
import { SubscriptionsAdminNav } from './subscriptions-admin-nav'
import { UpgradesManager } from './upgrades-manager'

export const metadata = {
  title: 'Upgrades — Subscriptions — Starforge',
}

export default async function SubscriptionsUpgradesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    redirect('/admin/settings')
  }

  const [plans, paths] = await Promise.all([listPlans(), listUpgradePaths()])

  return (
    <section className="admin-section admin-layouts-full">
      <SubscriptionsAdminNav active="changes" />
      <h2>Plan changes</h2>
      <p className="lede admin-lede">
        Which plan can change to which. A higher price starts immediately — Actions choose whether
        leftover days reduce the charge, or the buyer pays full price. A lower price waits until
        this term ends, then the next renewal uses that plan. There is no refund.
      </p>
      <UpgradesManager
        plans={plans.map((plan) => ({ id: plan.id, title: plan.title || plan.id }))}
        paths={paths.map((path) => ({
          id: path.id,
          fromPlanId: path.fromPlanId,
          toPlanId: path.toPlanId,
          creditMode: path.creditMode,
        }))}
      />
    </section>
  )
}
