import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  ensureMerchantForUser,
  listMerchantCredentialsPublic,
} from '../merchant-store'
import { MerchantSettingsForm } from './merchant-settings-form'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'My merchant — Starforge',
  description: 'Premium merchant keys and billing bridges.',
}

export default async function PaymentsMerchantPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const session = await requireAdminArea('admin.payments-merchant')
  if (!session?.user?.id) {
    redirect('/admin/payments')
  }

  const ensured = await ensureMerchantForUser(session.user.id)
  if (!ensured.ok) {
    return (
      <section className="admin-section admin-layouts-full">
        <PaymentsAdminNav active="merchant" />
        <h2>My merchant</h2>
        <p className="lede admin-lede">{ensured.error}</p>
        <p className="settings-hint">
          Need ACL <code>Payments — merchant</code> and collect entitlement (subscription stub
          auto-grants after ACL). Site MoR stays under{' '}
          <Link href="/admin/payments/settings">Settings</Link>.
        </p>
      </section>
    )
  }

  const credentials = await listMerchantCredentialsPublic(ensured.merchant.id)

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="merchant" />
      <h2>My merchant</h2>
      <p className="lede admin-lede">
        Organizer / vendor collect — your Barion POS and Billingo / Számlázz.hu keys. Settlement to
        your bank; no platform % fee for now.
      </p>
      <MerchantSettingsForm merchant={ensured.merchant} credentials={credentials} />
    </section>
  )
}
