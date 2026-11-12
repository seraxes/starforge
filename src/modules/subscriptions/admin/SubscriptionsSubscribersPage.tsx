import React from 'react'
import { redirect } from 'next/navigation'

import { getAccessViewer } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getPersonas } from '@/modules/profiles/api.server'

import { ensureSubscriptionsExpiryJob } from '../expiry'
import { ensureSubscriptionsPaymentHook } from '../payment-bridge'
import { listPeriods, listPlans } from '../store'
import {
  SubscribersManager,
  type SubscriberPeriodView,
  type SubscriberPerson,
} from './subscribers-manager'
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

  const [periods, plans, viewer] = await Promise.all([
    listPeriods({ limit: 400 }),
    listPlans(),
    getAccessViewer(),
  ])

  let people: Record<string, SubscriberPerson> = {}
  try {
    const personas = await getPersonas(
      [...new Set(periods.map((period) => period.userId))],
      viewer,
      { provision: false },
    )
    people = {}
    for (const [id, persona] of personas) {
      people[id] = {
        name: persona.displayName?.trim() || '',
        handle: persona.handle?.trim() || '',
      }
    }
  } catch {
    people = {}
  }

  const rows: SubscriberPeriodView[] = periods.map((period) => ({
    id: period.id,
    planId: period.planId,
    userId: period.userId,
    status: period.status,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    createdAt: period.createdAt.toISOString(),
    orderId: period.orderId || '',
    subject: period.subject,
    audience: period.audience,
    source: period.source,
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <SubscriptionsAdminNav active="subscribers" />
      <h2>Subscribers</h2>
      <p className="lede admin-lede">
        Who holds a plan, and until when. <strong>Add +</strong> grants a period without checkout.
        Edit changes the end date or closes the period. Refunds stay with Payments.
      </p>
      <SubscribersManager periods={rows} plans={plans} people={people} />
    </section>
  )
}
