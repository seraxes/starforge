import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSubscriptionsEmailStartersSeeded } from '../email-starters'
import { ensureSubscriptionsExpiryJob } from '../expiry'
import { ensureSubscriptionsPaymentHook } from '../payment-bridge'
import { ensureSubscriptionRegistrationFormSeeded } from '../registration-form'
import { loadSubscriptionsModuleSettings } from '../settings'
import { SubscriptionsAdminNav } from './subscriptions-admin-nav'
import { SubscriptionsSettingsForm } from './subscriptions-settings-form'

export const metadata = {
  title: 'Subscriptions settings — Starforge',
  description: 'Subscriptions pack defaults (reminders, Forms link).',
}

export default async function SubscriptionsSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    redirect('/admin/settings')
  }

  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()
  void ensureSubscriptionRegistrationFormSeeded()
  void ensureSubscriptionsEmailStartersSeeded()

  const loaded = await loadSubscriptionsModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <SubscriptionsAdminNav active="settings" />
      <h2>Subscriptions settings</h2>
      <p className="lede admin-lede">
        Pack defaults and deep-links. Plans and subscribers stay on their own tabs. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <SubscriptionsSettingsForm settings={loaded.settings} />
    </section>
  )
}
