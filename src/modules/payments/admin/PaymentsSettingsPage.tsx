import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getPaymentsSettings } from '../store'
import { PaymentsAdminNav } from './payments-admin-nav'
import { PaymentsSettingsForm } from './payments-settings-form'

export const metadata = {
  title: 'Payments settings — Starforge',
  description: 'Currency, VAT, seller block, enabled methods.',
}

export default async function PaymentsSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const paySettings = await getPaymentsSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="settings" />
      <h2>Payments settings</h2>
      <p className="lede admin-lede">
        Site merchant-of-record defaults. Premium organizers use{' '}
        <Link href="/admin/payments/merchant">My merchant</Link>. Gateway API keys:{' '}
        <Link href="/admin/environment">Environment</Link>. Receipts:{' '}
        <Link href="/admin/email">Email Manager</Link>.
      </p>
      <PaymentsSettingsForm settings={paySettings} />
    </section>
  )
}
