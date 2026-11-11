import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { CheckoutHandoff } from '@/modules/payments/public/CheckoutHandoff'
import { getOrderWithLines } from '@/modules/payments/api'

type Args = {
  params: Promise<{ locale: string; orderId: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: `Checkout — ${siteName}`,
    robots: { index: false, follow: false },
  }
}

/**
 * Public payments handoff — gateway redirect or offline payment instructions.
 * Path: `/[locale]/checkout/[orderId]`.
 */
export default async function PublicCheckoutPage({ params }: Args) {
  const { locale: localeParam, orderId: orderIdRaw } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    notFound()
  }

  const orderId = decodeURIComponent(orderIdRaw || '').trim()
  if (!orderId) notFound()

  const bundle = await getOrderWithLines(orderId)
  if (!bundle) notFound()

  const { order } = bundle
  const gatewayUrl = (order.redirectUrl || '').trim()

  if (
    (order.status === 'redirected_provider' || order.status === 'checkout_pending') &&
    gatewayUrl &&
    /^https?:\/\//i.test(gatewayUrl)
  ) {
    redirect(gatewayUrl)
  }

  if (order.status === 'paid' || order.status === 'fulfilled') {
    return (
      <div className="sf-checkout-handoff">
        <h1 className="sf-checkout-handoff-title">Payment received</h1>
        <p className="sf-checkout-handoff-lede">
          Reference <code>{order.paymentReference || order.id}</code> is paid.
        </p>
      </div>
    )
  }

  if (order.status === 'expired' || order.status === 'failed' || order.status === 'refunded') {
    return (
      <div className="sf-checkout-handoff">
        <h1 className="sf-checkout-handoff-title">Checkout closed</h1>
        <p className="sf-checkout-handoff-lede settings-hint">
          This order is {order.status}. Start registration again if you still need a seat.
        </p>
      </div>
    )
  }

  const instructions =
    typeof order.metadata?.offlineInstructions === 'string'
      ? order.metadata.offlineInstructions
      : ''

  return (
    <CheckoutHandoff
      paymentReference={order.paymentReference || order.id}
      method={order.method}
      currency={order.currency}
      totalGrossMinor={order.totalGrossMinor}
      instructions={instructions}
      status={order.status}
    />
  )
}
