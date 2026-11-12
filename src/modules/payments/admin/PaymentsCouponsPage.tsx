import React from 'react'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listCoupons } from '../coupons'
import { getPaymentsSettings } from '../store'
import { CouponsManager } from './coupons-manager'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Coupons — Payments — Starforge',
}

export default async function PaymentsCouponsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const [coupons, paySettings] = await Promise.all([listCoupons(), getPaymentsSettings()])

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="coupons" />
      <h2>Coupons</h2>
      <p className="lede admin-lede">
        Shared discount codes for checkout. Events, Shop, Subscriptions, and Ads pass a code;
        Payments re-resolves the discount server-side and charges the reduced total. Amount =
        major units; trailing % = percent off (same one-field rule as ticket modifiers).
      </p>
      <CouponsManager coupons={coupons} defaultCurrency={paySettings.currency} />
    </section>
  )
}
