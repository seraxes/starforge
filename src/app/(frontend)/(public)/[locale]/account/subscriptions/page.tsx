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
  ensureSubscriptionRegistrationFormSeeded,
  ensureSubscriptionsExpiryJob,
  ensureSubscriptionsPaymentHook,
} from '@/modules/subscriptions/api'
import { CancelSubscriptionForm } from '@/modules/subscriptions/public/CancelSubscriptionForm'
import { SeatManager } from '@/modules/subscriptions/public/SeatManager'
import { SubscribePlanForm } from '@/modules/subscriptions/public/SubscribePlanForm'
import { SubscriptionIntakeForm } from '@/modules/subscriptions/public/SubscriptionIntakeForm'
import {
  listActivePeriodsForUser,
  listPeriods,
  listPlans,
  listPlansByIds,
  listSeats,
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
  void ensureSubscriptionRegistrationFormSeeded()

  const userId = String(session.user.id).trim()
  const profilesOn = isCatalogModuleEnabled(settings, MODULE_IDS.profiles)
  const eventsOn = isCatalogModuleEnabled(settings, MODULE_IDS.events)

  const [active, history, plans, profile] = await Promise.all([
    listActivePeriodsForUser(userId),
    listPeriods({ userId, limit: 50 }),
    listPlans({ activeOnly: true }),
    profilesOn ? ensureProfile(userId) : Promise.resolve(null),
  ])

  const activePlans = await listPlansByIds(active.map((p) => p.planId))
  const allPlanIds = [...new Set([...active.map((p) => p.planId), ...history.map((p) => p.planId)])]
  const historyPlans = await listPlansByIds(allPlanIds)
  const planTitle = (id: string) =>
    activePlans.find((p) => p.id === id)?.title ||
    historyPlans.find((p) => p.id === id)?.title ||
    id

  const seatsByPeriod = new Map<string, Awaited<ReturnType<typeof listSeats>>>()
  for (const p of active) {
    const plan = activePlans.find((x) => x.id === p.planId)
    if (plan && plan.seatLimit > 0 && p.userId === userId) {
      seatsByPeriod.set(p.id, await listSeats(p.id))
    }
  }

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
        Player premium, organizer premium, and advertisements. Checkout uses Payments; mail uses
        Email Manager.
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
              {active.map((p) => {
                const plan = activePlans.find((x) => x.id === p.planId)
                const seats = seatsByPeriod.get(p.id) || []
                const upgrades =
                  plan?.upgradeTargetIds
                    .map((id) => plans.find((x) => x.id === id))
                    .filter(Boolean) ?? []
                return (
                  <li key={p.id} style={{ marginBottom: '1rem' }}>
                    <strong>{planTitle(p.planId)}</strong> ({p.subject}
                    {p.isTrial ? ' · trial' : ''}
                    {p.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                    {p.autoRenew ? ' · auto-renew' : ''}) — ends{' '}
                    {p.endsAt.toISOString().slice(0, 10)}
                    {p.orderId ? (
                      <>
                        {' '}
                        · <a href={`/${locale}/checkout/${p.orderId}`}>Order / invoice</a>
                      </>
                    ) : null}
                    <div style={{ marginTop: '0.5rem' }}>
                      {plan &&
                      !plan.lifetime &&
                      plan.billingPeriod !== 'lifetime' &&
                      !plan.fixedExpiresAt ? (
                        <SubscribePlanForm
                          planId={plan.id}
                          planTitle={plan.title}
                          priceLabel={`${formatMoney(plan.earlyRenewPrice ?? plan.price)} / ${plan.billingPeriod}`}
                          methods={methods}
                          mode="renew"
                          recurringSupported={plan.recurringSupported}
                          isFree={plan.price <= 0}
                          submitLabel="Renew"
                        />
                      ) : null}
                      <CancelSubscriptionForm
                        periodId={p.id}
                        cancelAtPeriodEnd={p.cancelAtPeriodEnd}
                      />
                    </div>
                    {upgrades.length > 0 ? (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p className="settings-hint">Upgrade options</p>
                        {upgrades.map((target) =>
                          target ? (
                            <SubscribePlanForm
                              key={target.id}
                              planId={target.id}
                              planTitle={target.title}
                              priceLabel={`${formatMoney(target.price)} / ${target.billingPeriod}`}
                              methods={methods}
                              mode="upgrade"
                              fromPeriodId={p.id}
                              isFree={target.price <= 0}
                              submitLabel={`Upgrade to ${target.title}`}
                            />
                          ) : null,
                        )}
                      </div>
                    ) : null}
                    {plan && plan.seatLimit > 0 ? (
                      <SeatManager periodId={p.id} seats={seats} seatLimit={plan.seatLimit} />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
        <div className="page-settings-panel-head">
          <h2>History</h2>
        </div>
        <div className="page-settings-panel-body">
          {history.length === 0 ? (
            <p>No subscriptions yet.</p>
          ) : (
            <ul>
              {history.map((p) => (
                <li key={p.id}>
                  {planTitle(p.planId)} — {p.status} · {p.startsAt.toISOString().slice(0, 10)} →{' '}
                  {p.endsAt.toISOString().slice(0, 10)}
                  {p.orderId ? (
                    <>
                      {' '}
                      · <a href={`/${locale}/checkout/${p.orderId}`}>Order</a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="admin-settings-mosaic" style={{ marginTop: '1.5rem' }}>
        {plans.map((plan) => {
          const priceLabel =
            plan.price <= 0
              ? `Free / ${plan.billingPeriod}`
              : `${formatMoney(plan.price)} / ${plan.billingPeriod}`
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
                {plan.formDefinitionId ? (
                  <SubscriptionIntakeForm
                    planId={plan.id}
                    formDefinitionId={plan.formDefinitionId}
                  />
                ) : null}
                <SubscribePlanForm
                  planId={plan.id}
                  planTitle={plan.title}
                  priceLabel={priceLabel}
                  methods={methods}
                  recurringSupported={plan.recurringSupported}
                  isFree={plan.price <= 0}
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
