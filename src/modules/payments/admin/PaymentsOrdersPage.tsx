import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { formatMoneyMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listOrders } from '../store'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Payment orders — Starforge',
}

export default async function PaymentsOrdersPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const orders = await listOrders(100)

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="orders" />
      <h2>Orders</h2>
      <p className="lede admin-lede">Checkout sessions and offline payments awaiting confirmation.</p>
      {orders.length === 0 ? (
        <p className="settings-hint">No orders yet.</p>
      ) : (
        <div className="page-settings-panel">
          <div className="page-settings-panel-body">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/payments/orders/${o.id}`}>
                        {o.paymentReference || o.id}
                      </Link>
                    </td>
                    <td>{o.status}</td>
                    <td>{o.method}</td>
                    <td>{o.buyerEmail}</td>
                    <td>{formatMoneyMinor(o.totalGrossMinor, o.currency)}</td>
                    <td>{o.createdAt?.toISOString?.().slice(0, 16) ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
