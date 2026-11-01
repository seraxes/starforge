import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { FormsAdminNav } from '../forms-admin-nav'
import { FormsSettingsForm } from './forms-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Forms settings — Starforge',
  description: 'Forms module settings — email notify defaults (stub transport).',
}

export default async function AdminFormsSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    redirect('/app/admin/settings')
  }

  const { loadFormsModuleSettings } = await import('@/core/forms/settings-store')
  const loaded = await loadFormsModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <FormsAdminNav active="settings" />
      <h2>Forms settings</h2>
      <p className="lede admin-lede">
        Module defaults for success copy and email-on-submit. Transport is{' '}
        <strong>stub</strong> until platform email is wired (prefs: forgot-password deferred with
        email). Per-form overrides live in the builder. Secrets stay in env — never here.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using defaults (run <code>npm run db:core:push</code> for <code>sf_form_settings</code>).
          Source: {loaded.source}.
        </p>
      ) : null}
      <FormsSettingsForm initial={loaded.settings} />
      <p className="admin-lede">
        <Link href="/app/admin/forms">← Forms</Link>
      </p>
    </section>
  )
}
