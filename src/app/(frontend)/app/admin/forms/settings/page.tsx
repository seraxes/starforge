import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getMailerInfo } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsAdminNav } from '../forms-admin-nav'
import { FormsSettingsForm } from './forms-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Forms settings — Starforge',
  description: 'Forms module settings — email notify defaults via platform Mailer.',
}

export default async function AdminFormsSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const { loadFormsModuleSettings } = await import('@/core/forms/settings-store')
  const loaded = await loadFormsModuleSettings()
  const mailer = await getMailerInfo()

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="settings" />
      <h2>Forms settings</h2>
      <p className="lede admin-lede">
        Module defaults for success copy and email-on-submit. Transport is the platform{' '}
        <strong>Mailer</strong> (Chrome enable / provider / From; secrets in env). Per-form
        overrides live in the builder.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using defaults (run <code>npm run db:core:push</code> for <code>sf_form_settings</code>).
          Source: {loaded.source}.
        </p>
      ) : null}
      <FormsSettingsForm initial={loaded.settings} mailer={mailer} />
      <p className="admin-lede">
        <Link href="/app/admin/forms">← Forms</Link>
      </p>
    </section>
  )
}
