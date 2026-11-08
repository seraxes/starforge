import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  getFiscalProvider,
  getPaymentsProvider,
  ONLINE_PAYMENT_PROVIDERS,
} from '@/core/payments'
import { formatMoneyMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getPaymentsSettings, listOrders } from '../store'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Payments — Starforge',
  description: 'Shared commerce module overview.',
}

export default async function PaymentsOverviewPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const paySettings = await getPaymentsSettings()
  const orders = await listOrders(8)
  const providerInfo = getPaymentsProvider().info()
  const fiscalInfo = getFiscalProvider().info()

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="overview" />
      <h2>Payments</h2>
      <p className="lede admin-lede">
        Shared cart and checkout for Events, Shop, Subscriptions, and Ads. Site MoR settings below;
        premium organizers configure keys under My merchant. Receipts:{' '}
        <Link href="/admin/email">Email Manager</Link>.
      </p>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Site commerce</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Currency <strong>{paySettings.currency}</strong> · VAT entry{' '}
              <strong>{paySettings.amountEntryMode}</strong> · default rate{' '}
              <strong>{(paySettings.defaultVatRateBps / 100).toFixed(2)}%</strong>
            </p>
            <p className="settings-hint">
              Methods: {paySettings.enabledMethods.join(', ') || '(none)'}
            </p>
            <div className="page-settings-actions">
              <Link
                href="/admin/payments/settings"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
              >
                Settings
              </Link>
            </div>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Providers</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Active: <strong>{providerInfo.label}</strong>
              {providerInfo.ready ? ' (ready)' : ' (not ready)'}
              {providerInfo.detail ? ` — ${providerInfo.detail}` : ''}
            </p>
            <p className="settings-hint">
              Fiscal: <strong>{fiscalInfo.label}</strong>
              {fiscalInfo.ready ? ' (ready)' : ' (not ready)'}
              {fiscalInfo.detail ? ` — ${fiscalInfo.detail}` : ''}
            </p>
            <ul className="settings-hint">
              {ONLINE_PAYMENT_PROVIDERS.map((p) => (
                <li key={p.value}>{p.label}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Recent orders</h3>
          </header>
          <div className="page-settings-panel-body">
            {orders.length === 0 ? (
              <p className="settings-hint">No orders yet.</p>
            ) : (
              <ul className="settings-hint">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/payments/orders/${o.id}`}>
                      {o.paymentReference || o.id.slice(0, 12)} — {o.status} —{' '}
                      {formatMoneyMinor(o.totalGrossMinor, o.currency)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="page-settings-actions">
              <Link
                href="/admin/payments/orders"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              >
                All orders
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
