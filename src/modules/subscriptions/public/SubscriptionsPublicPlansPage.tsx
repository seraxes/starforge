import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import {
  ensureSubscriptionRegistrationFormSeeded,
  ensureSubscriptionsExpiryJob,
  ensureSubscriptionsPaymentHook,
} from '../api'
import { PlansCatalog } from './PlansCatalog'
import { loadPlansCatalogMoney, loadPublicPlans } from './load-plans-catalog'

type Args = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Plans',
    description: `Subscription plans on ${siteName}.`,
  }
}

/** Public plans catalog — Nav module link + brochure pages via particle. */
export default async function SubscriptionsPublicPlansPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) notFound()

  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()
  void ensureSubscriptionRegistrationFormSeeded()

  const [plans, money] = await Promise.all([loadPublicPlans(), loadPlansCatalogMoney()])

  return (
    <article className="cms-page sf-subscriptions-plans-page">
      <header className="cms-page-header">
        <h1>Plans</h1>
        <p className="lede">Choose a plan. Checkout uses Payments.</p>
      </header>
      <PlansCatalog
        plans={plans}
        locale={locale}
        signedIn={Boolean(session?.user?.id)}
        currency={money.currency}
        methods={money.methods}
        formatMoney={money.formatMoney}
        showAccountLink
      />
    </article>
  )
}
