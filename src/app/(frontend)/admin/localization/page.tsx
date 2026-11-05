import React from 'react'
import Link from 'next/link'

import { getLocalizationSettings } from '@/core/localization'
import { LocalizationForm } from './localization-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Localization — Starforge',
  description:
    'Locale catalog, enabled public locales, default locale, and content fallback.',
}

export default async function AdminLocalizationPage() {
  const settings = await getLocalizationSettings()

  return (
    <section className="admin-section">
      <h2>Localization</h2>
      <p className="lede admin-lede">
        Locale catalog (add codes beyond <code>en</code>/<code>hu</code>), enable list,
        default locale, and fallback. Public routing, switcher, nav, and hreflang honor this
        catalog immediately. Payload CMS locales in <code>payload.config.ts</code> stay
        code-bootstrapped from Core bootstrap codes — admin-added languages do not appear in{' '}
        <code>/cms</code> until that config is updated and the app restarts. Offline /
        SEO / cookies / email under <Link href="/admin/site-chrome">Chrome</Link>; Modules
        / Auth / Security under <Link href="/admin/settings">Settings</Link>.
      </p>
      <LocalizationForm settings={settings} />
    </section>
  )
}
