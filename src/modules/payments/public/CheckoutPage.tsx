import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { orderStatusChromeKey, paymentMethodChromeLabel } from '@/modules/payments/chrome'
import { CheckoutHandoff } from '@/modules/payments/public/CheckoutHandoff'
import { getOrderWithLines } from '@/modules/payments/api'

type Args = {
  params: Promise<{ locale: string; orderId: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  const locale = isValidLocaleCode(localeParam) ? localeParam : 'en'
  const t = await getTranslations({
    locale,
    namespace: 'product:payments',
  })

  if (!isValidLocaleCode(localeParam) || !isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { title: `${t('notFoundTitle')} — ${siteName}` }
  }

  return {
    title: `${t('checkoutTitle')} — ${siteName}`,
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
  const t = await getTranslations('product:payments')

  if (
    (order.status === 'redirected_provider' || order.status === 'checkout_pending') &&
    gatewayUrl &&
    /^https?:\/\//i.test(gatewayUrl)
  ) {
    redirect(gatewayUrl)
  }

  if (order.status === 'paid' || order.status === 'fulfilled') {
    const reference = order.paymentReference || order.id
    return (
      <div className="sf-checkout-handoff">
        <h1 className="sf-checkout-handoff-title">{t('paymentReceived')}</h1>
        <p className="sf-checkout-handoff-lede">
          {t('paymentReceivedLede', { reference })}
        </p>
      </div>
    )
  }

  if (order.status === 'expired' || order.status === 'failed' || order.status === 'refunded') {
    const statusKey = orderStatusChromeKey(order.status)
    const statusLabel = statusKey ? t(statusKey) : order.status
    return (
      <div className="sf-checkout-handoff">
        <h1 className="sf-checkout-handoff-title">{t('checkoutClosed')}</h1>
        <p className="sf-checkout-handoff-lede settings-hint">
          {t('checkoutClosedLede', { status: statusLabel })}
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
      methodLabel={await paymentMethodChromeLabel(order.method)}
      currency={order.currency}
      totalGrossMinor={order.totalGrossMinor}
      instructions={instructions}
      status={order.status}
    />
  )
}
