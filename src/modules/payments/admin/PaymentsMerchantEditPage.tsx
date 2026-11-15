import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireAdminArea } from '@/core/acl/access'
import { listPaymentMethodDescriptors } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getMerchantById, listMerchantCredentialsPublic, listMerchantsForAdmin } from '../merchant-store'
import { MerchantSettingsForm } from './merchant-settings-form'
import { PaymentsAdminNav } from './payments-admin-nav'

export const metadata = {
  title: 'Merchant — Payments — Starforge',
}

export default async function PaymentsMerchantEditPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    redirect('/admin/settings')
  }

  const session = await requireAdminArea('admin.payments')
  if (!session?.user?.id) {
    redirect('/admin/payments')
  }

  const { merchantId } = await params
  const merchant = await getMerchantById(merchantId)
  if (!merchant) notFound()

  const rows = await listMerchantsForAdmin()
  const row = rows.find((item) => item.id === merchant.id)
  const credentials = await listMerchantCredentialsPublic(merchant.id)

  return (
    <section className="admin-section admin-layouts-full">
      <PaymentsAdminNav active="merchants" />
      <h2>{merchant.displayName || merchant.sellerName || 'Merchant'}</h2>
      <p className="lede admin-lede">
        Payment setup for this seller. Bank transfer, pay at entrance, and cash stay on the
        profile. Online gateway keys are stored encrypted.
      </p>
      <p className="settings-hint">
        <Link href="/admin/payments/merchants">All merchants</Link>
      </p>
      <MerchantSettingsForm
        merchant={merchant}
        credentials={credentials}
        onlineMethods={listPaymentMethodDescriptors()}
        accountEmail={row?.userEmail || undefined}
        accountName={row?.userName || undefined}
      />
    </section>
  )
}
