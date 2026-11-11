import React from 'react'
import Link from 'next/link'

import { listContentLocaleFiles } from '@/core/i18n/content-locales/store'
import { getLocalizationSettings } from '@/core/localization'

import { ContentLocaleFilesPanel } from './content-locale-files-panel'
import { LocalizationForm } from './localization-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Localization — Starforge',
  description:
    'Locale catalog, enabled public locales, default locale, content fallback, and content locale files.',
}

export default async function AdminLocalizationPage() {
  const settings = await getLocalizationSettings()
  const locales =
    settings.localesEnabled.length > 0
      ? settings.localesEnabled
      : [settings.defaultLocale]
  const filesByLocale: Record<
    string,
    { scope: 'layouts' | 'nav'; ownerId: string; relativePath: string }[]
  > = {}
  for (const locale of locales) {
    filesByLocale[locale] = await listContentLocaleFiles(locale)
  }

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
      <div className="admin-settings-mosaic" style={{ marginTop: '1.25rem' }}>
        <ContentLocaleFilesPanel
          locales={locales}
          filesByLocale={filesByLocale}
          defaultLocale={settings.defaultLocale}
        />
      </div>
    </section>
  )
}
