import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSubscriptionsExpiryJob } from '../expiry'
import { ensureSubscriptionsPaymentHook } from '../payment-bridge'
import { listPlans } from '../store'
import { PLAN_SUBJECTS } from '../types'
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

  const params = await searchParams
  const subjectFilter = (params.subject ?? '').trim()
  const plans = await listPlans()

  let currency = 'HUF'
  try {
    const { getPaymentsSettings } = await import('@/modules/payments/api')
    currency = (await getPaymentsSettings()).currency || 'HUF'
  } catch {
    /* payments optional at render if migrate pending */
  }

  const subjects = [
    { id: '', label: 'All' },
    { id: PLAN_SUBJECTS.membership, label: 'Player' },
    { id: PLAN_SUBJECTS.organizer, label: 'Organizer' },
    { id: PLAN_SUBJECTS.advertisement, label: 'Advertisement' },
  ]

  return (
    <section className="admin-section admin-layouts-full sf-subscriptions-manager">
      <SubscriptionsAdminNav active="plans" />
      <h2>Subscription plans</h2>
      <p className="lede admin-lede">
        Player premium, organizer premium (event management access), and advertisements.
        Payments charges the plan; this pack grants periods and entitlements.
      </p>
      <p className="gantry-inherit-copy-row-inline" style={{ marginBottom: '1rem' }}>
        {subjects.map((s) => (
          <Link
            key={s.id || 'all'}
            href={s.id ? `/admin/subscriptions?subject=${encodeURIComponent(s.id)}` : '/admin/subscriptions'}
            className={
              subjectFilter === s.id
                ? 'gantry-toolbar-btn gantry-toolbar-btn-save'
                : 'gantry-toolbar-btn'
            }
          >
            {s.label}
          </Link>
        ))}
      </p>
      <PlansManager plans={plans} currency={currency} subjectFilter={subjectFilter} />
    </section>
  )
}
