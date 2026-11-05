import React from 'react'
import Link from 'next/link'

import { getLocalizationSettings } from '@/core/localization'
import { LocalizationForm } from './localization-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Localization — Starforge',
  description:
    'Enabled public locales, default locale, and content fallback for Starforge multilang.',
}

export default async function AdminLocalizationPage() {
  const settings = await getLocalizationSettings()

  return (
    <section className="admin-section">
      <h2>Localization</h2>
      <p className="lede admin-lede">
        Public language enable list, default locale, and fallback. Offline, SEO/metadata,
        cookies, and outbound email stay under{' '}
        <Link href="/admin/site-chrome">Chrome</Link>; Modules / Auth / Security under{' '}
        <Link href="/admin/settings">Settings</Link>. Payload CMS locale codes are wired in{' '}
        <code>payload.config.ts</code> from the Core catalog today — keep enabled locales
        aligned with that catalog when practical.
      </p>
      <LocalizationForm settings={settings} />
    </section>
  )
}
