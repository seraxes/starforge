import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSubscriptionsExpiryJob } from '../expiry'
import { ensureSubscriptionsPaymentHook } from '../payment-bridge'
import { listPeriods, listPlans } from '../store'
import { SubscribersManager } from './subscribers-manager'
import { SubscriptionsAdminNav } from './subscriptions-admin-nav'

export const metadata = {
  title: 'Subscribers — Subscriptions — Starforge',
}

export default async function SubscriptionsSubscribersPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    redirect('/admin/settings')
  }

  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()

  const [periods, plans] = await Promise.all([listPeriods({ limit: 200 }), listPlans()])

  return (
    <section className="admin-section admin-layouts-full sf-subscriptions-manager">
      <SubscriptionsAdminNav active="subscribers" />
      <h2>Subscribers</h2>
      <p className="lede admin-lede">
        Active and past periods. Comp grants a period without checkout. Expiry and refunds end
        the period without writing ACL rows.
      </p>
      <SubscribersManager periods={periods} plans={plans} />
    </section>
  )
}
