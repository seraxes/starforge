import React from 'react'
import { redirect } from 'next/navigation'

import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSubscriptionsExpiryJob } from '../expiry'
import { ensureSubscriptionsPaymentHook } from '../payment-bridge'
import { loadSubscriptionPlanLocaleMaps } from '../plan-locales'
import { ensureSubscriptionRegistrationFormSeeded } from '../registration-form'
import { loadSubscriptionsModuleSettings } from '../settings'
import { listPlans } from '../store'
import { PlansManager } from './plans-manager'
import { SubscriptionsAdminNav } from './subscriptions-admin-nav'

export const metadata = {
  title: 'Plans — Subscriptions — Starforge',
}

type Search = Promise<{ subject?: string }>

export default async function SubscriptionsPlansPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    redirect('/admin/settings')
  }

  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()
  void ensureSubscriptionRegistrationFormSeeded()

  const params = await searchParams
  const [plans, packSettings, locales] = await Promise.all([
    listPlans(),
    loadSubscriptionsModuleSettings(),
    getContentLocaleOptions(),
  ])
  const localeCodes = locales.map((locale) => locale.code)
  const planRows = await Promise.all(
    plans.map(async (plan) => {
      const maps = await loadSubscriptionPlanLocaleMaps(plan.id, localeCodes)
      return {
        ...plan,
        titleLocales: maps.titleLocales,
        descriptionLocales: maps.descriptionLocales,
      }
    }),
  )

  let currency = 'HUF'
  try {
    const { getPaymentsSettings } = await import('@/modules/payments/api')
    currency = (await getPaymentsSettings()).currency || 'HUF'
  } catch {
    /* payments optional at render if migrate pending */
  }

  let groupOptions: { id: string; label: string }[] = []
  try {
    const { listUserGroupOptions } = await import('@/core/acl')
    groupOptions = await listUserGroupOptions()
  } catch {
    /* ACL migrate pending */
  }

  return (
    <section className="admin-section admin-layouts-full">
      <SubscriptionsAdminNav active="plans" />
      <h2>Plans</h2>
      <p className="lede admin-lede">
        Catalog of what can be sold. Filter by type and subtype, then edit one plan. Payments
        charges the price; a period grants entitlements and syncs access groups for ACL.
      </p>
      <PlansManager
        plans={planRows}
        currency={currency}
        initialType={(params.subject ?? '').trim()}
        defaultGraceHours={packSettings.settings.defaultGraceHours}
        defaultFormDefinitionId={packSettings.settings.defaultFormDefinitionId}
        groupOptions={groupOptions}
        locales={locales}
      />
    </section>
  )
}
