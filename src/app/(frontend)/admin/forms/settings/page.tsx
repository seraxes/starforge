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
    redirect('/admin/settings')
  }

  const { loadFormsModuleSettings } = await import('@/core/forms/settings-store')
  const loaded = await loadFormsModuleSettings()
  const mailer = await getMailerInfo()

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <FormsAdminNav active="settings" />
      <h2 className="sr-only">Forms settings</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Module defaults for success copy and email-on-submit. Success mail goes through{' '}
        <Link href="/admin/email">Email Manager</Link> only (Chrome Mailer is the transport).
        Per-form notify flags and recipients live in the builder.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using defaults (run <code>npm run db:core:push</code> for <code>sf_form_settings</code>).
          Source: {loaded.source}.
        </p>
      ) : null}
      <FormsSettingsForm initial={loaded.settings} mailer={mailer} />
      <p className="admin-lede">
        Deep link (not in nav):{' '}
        <Link href="/admin/forms/submissions">View recent submissions</Link>
        {' · '}
        <Link href="/admin/forms">← Forms</Link>
      </p>
    </section>
  )
}
