import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { formatMoneyMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listInvoices } from '../store'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Invoices — Starforge',
}

export default async function PaymentsInvoicesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const invoices = await listInvoices(100)

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="invoices" />
      <h2>Invoices</h2>
      <p className="lede admin-lede">
        Gapless series for site MoR and merchant Billingo / Számlázz.hu document ids.
      </p>
      {invoices.length === 0 ? (
        <p className="settings-hint">No invoices yet.</p>
      ) : (
        <div className="page-settings-panel">
          <div className="page-settings-panel-body">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Kind</th>
                  <th>Issue</th>
                  <th>Buyer</th>
                  <th>Gross</th>
                  <th>Billing</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.kind}</td>
                    <td>{inv.issueDate}</td>
                    <td>{inv.buyerName}</td>
                    <td>{formatMoneyMinor(inv.totalGrossMinor, inv.currency)}</td>
                    <td>
                      {inv.billingProvider || '—'}
                      {inv.billingExternalId ? ` (${inv.billingExternalId})` : ''}
                    </td>
                    <td>
                      <Link href={`/admin/payments/orders/${inv.orderId}`}>Open</Link>
                    </td>
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
