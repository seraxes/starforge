import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { formatMoneyMinor, isOfflinePaymentMethod } from '@/core/payments'
import type { PaymentMethodKind } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getOrderWithLines } from '../store'
import { MarkPaidForm } from './mark-paid-form'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Order — Starforge',
}

export default async function PaymentsOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const { orderId } = await params
  const bundle = await getOrderWithLines(orderId)
  if (!bundle) notFound()

  const { order, lines, invoices } = bundle
  const canMarkPaid =
    isOfflinePaymentMethod(order.method as PaymentMethodKind) &&
    (order.status === 'awaiting_offline' || order.status === 'checkout_pending')

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="orders" />
      <h2>Order {order.paymentReference || order.id}</h2>
      <p className="lede admin-lede">
        <Link href="/admin/payments/orders">← Orders</Link>
      </p>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Summary</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Status: <strong>{order.status}</strong> · Method: {order.method} · Provider:{' '}
              {order.provider}
              {order.merchantId ? ` · Merchant ${order.merchantId}` : ' · Site MoR'}
            </p>
            <p className="settings-hint">
              Buyer: {order.buyerName || '—'} &lt;{order.buyerEmail}&gt;
              {order.buyerVatId ? ` · VAT ${order.buyerVatId}` : ''}
            </p>
            <p className="settings-hint">
              Totals: net {formatMoneyMinor(order.totalNetMinor, order.currency)} · VAT{' '}
              {formatMoneyMinor(order.totalVatMinor, order.currency)} · gross{' '}
              <strong>{formatMoneyMinor(order.totalGrossMinor, order.currency)}</strong>
            </p>
            {order.markPaidByUserId ? (
              <p className="settings-hint">
                Marked paid by {order.markPaidByUserId}: {order.markPaidReason}
              </p>
            ) : null}
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Lines</h3>
          </header>
          <div className="page-settings-panel-body">
            <ul className="settings-hint">
              {lines.map((l) => (
                <li key={l.id}>
                  {l.qty}× {l.title} — {formatMoneyMinor(l.lineGrossMinor, l.currency)} (
                  {l.sourceModule}/{l.sourceType}/{l.sourceId})
                </li>
              ))}
            </ul>
          </div>
        </section>

        {invoices.length > 0 ? (
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Invoices</h3>
            </header>
            <div className="page-settings-panel-body">
              <ul className="settings-hint">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    {inv.invoiceNumber} · {inv.kind} · NAV {inv.navSyncState}
                    {inv.billingProvider ? ` · ${inv.billingProvider}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {canMarkPaid ? (
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Confirm offline payment</h3>
            </header>
            <MarkPaidForm orderId={order.id} />
          </section>
        ) : null}
      </div>
    </section>
  )
}
