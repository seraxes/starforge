import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { AccountNav } from '@/modules/profiles/public/AccountNav'
import { ensureProfile } from '@/modules/profiles/store'
import {
  ensureSubscriptionsExpiryJob,
  ensureSubscriptionsPaymentHook,
} from '@/modules/subscriptions/api'
import { SubscribePlanForm } from '@/modules/subscriptions/public/SubscribePlanForm'
import {
  listActivePeriodsForUser,
  listPlans,
  listPlansByIds,
} from '@/modules/subscriptions/store'

type Args = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: 'My subscriptions',
  robots: { index: false, follow: false },
}

export default async function AccountSubscriptionsPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) notFound()
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent('/account/subscriptions')}`)
  }

  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()

  const userId = String(session.user.id).trim()
  const profilesOn = isCatalogModuleEnabled(settings, MODULE_IDS.profiles)
  const eventsOn = isCatalogModuleEnabled(settings, MODULE_IDS.events)

  const [active, plans, profile] = await Promise.all([
    listActivePeriodsForUser(userId),
    listPlans({ activeOnly: true }),
    profilesOn ? ensureProfile(userId) : Promise.resolve(null),
  ])

  const activePlans = await listPlansByIds(active.map((p) => p.planId))
  const planTitle = (id: string) => activePlans.find((p) => p.id === id)?.title || id

  let currency = 'HUF'
  let methods: string[] = ['bank_transfer']
  let formatMoney = (major: number) => `${major} ${currency}`
  try {
    const payments = await import('@/modules/payments/api')
    const pay = await payments.getPaymentsSettings()
    currency = pay.currency || 'HUF'
    methods =
      pay.enabledMethods?.length > 0
        ? [...pay.enabledMethods]
        : ['bank_transfer', 'pay_at_entrance', 'cash']
    formatMoney = (major: number) => {
      const minor = payments.majorToMinor(major, currency)
      if (minor == null) return `${major} ${currency}`
      return payments.formatMoneyMinor(minor, currency)
    }
  } catch {
    /* payments migrate pending */
  }

  return (
    <div className="sf-account-page">
      <AccountNav
        active="subscriptions"
        locale={locale}
        handle={profile?.handle}
        showEvents={eventsOn}
        showSubscriptions
      />
      <h1>My subscriptions</h1>
      <p className="lede">
        Player premium, organizer premium, and advertisements. Checkout uses Payments.
      </p>

      <section className="page-settings-panel">
        <div className="page-settings-panel-head">
          <h2>Active</h2>
        </div>
        <div className="page-settings-panel-body">
          {active.length === 0 ? (
            <p>No active subscription.</p>
          ) : (
            <ul>
              {active.map((p) => (
                <li key={p.id}>
                  <strong>{planTitle(p.planId)}</strong> ({p.subject}) — ends{' '}
                  {p.endsAt.toISOString().slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="admin-settings-mosaic" style={{ marginTop: '1.5rem' }}>
        {plans.map((plan) => {
          const priceLabel = `${formatMoney(plan.price)} / ${plan.billingPeriod}`
          return (
            <article key={plan.id} className="page-settings-panel">
              <div className="page-settings-panel-head">
                <h3>{plan.title}</h3>
                <p className="settings-hint">
                  {plan.subject}
                  {plan.audience ? ` · ${plan.audience}` : ''}
                </p>
              </div>
              <div className="page-settings-panel-body">
                {plan.description ? <p>{plan.description}</p> : null}
                <SubscribePlanForm
                  planId={plan.id}
                  planTitle={plan.title}
                  priceLabel={priceLabel}
                  methods={methods}
                />
              </div>
            </article>
          )
        })}
        {plans.length === 0 ? <p className="lede">No plans are for sale yet.</p> : null}
      </section>
    </div>
  )
}
