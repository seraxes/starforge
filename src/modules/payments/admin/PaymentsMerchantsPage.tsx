import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listMerchantsForAdmin } from '../merchant-store'
import { MerchantsCreateForm } from './merchants-create-form'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Merchants — Payments — Starforge',
  description: 'Premium merchants who collect on their own keys.',
}

export default async function PaymentsMerchantsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const session = await requireAdminArea('admin.payments')
  if (!session?.user?.id) {
    redirect('/admin/payments')
  }

  const merchants = await listMerchantsForAdmin()

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="merchants" />
      <h2>Merchants</h2>
      <p className="lede admin-lede">
        Premium sellers who collect on their own bank or a registered online gateway. Add an
        existing account, then fill that seller&apos;s payment setup. How to add a gateway is under
        Payments → Settings.
      </p>

      <div className="admin-settings-mosaic">
        <MerchantsCreateForm />
      </div>

      {merchants.length === 0 ? (
        <p className="settings-hint">No merchants yet.</p>
      ) : (
        <div className="page-settings-panel">
          <div className="page-settings-panel-body">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Billing</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/payments/merchants/${row.id}`}>
                        {row.displayName || row.sellerName || row.userName || row.id}
                      </Link>
                    </td>
                    <td>{row.userEmail || row.userId}</td>
                    <td>{row.status}</td>
                    <td>{row.billingProvider}</td>
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
