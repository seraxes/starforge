import React from 'react'
import Link from 'next/link'

import { listContentLocaleFiles } from '@/core/i18n/content-locales/store'
import type { ContentLocaleScope } from '@/core/i18n/content-locales/paths'
import { getLocalizationSettings } from '@/core/localization'
import { loadNavMenu } from '@/core/nav'
import { getSiteSettings } from '@/core/settings'

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
    { scope: ContentLocaleScope; ownerId: string; relativePath: string }[]
  > = {}
  for (const locale of locales) {
    filesByLocale[locale] = await listContentLocaleFiles(locale)
  }

  const siteSettings = await getSiteSettings()
  const root = siteSettings.rootItem
  let rootLabel = ''
  let rootMenuId = ''
  if (root) {
    const menu = await loadNavMenu(root.menuId)
    const item = menu.document.items.find((row) => row.id === root.itemId)
    rootLabel = item?.label?.trim() || 'Root item'
    rootMenuId = root.menuId
  }

  return (
    <section className="admin-section">
      <h2>Localization</h2>
      <p className="lede admin-lede">
        Locale catalog (add codes beyond <code>en</code>/<code>hu</code>), enable list,
        default locale, and fallback. Public routing, switcher, nav, and hreflang honor this
        catalog immediately. Offline / SEO / cookies / email under{' '}
        <Link href="/admin/site-chrome">Chrome</Link>; Modules / Auth / Security under{' '}
        <Link href="/admin/settings">Settings</Link>. The site root is chosen on a{' '}
        <Link href="/admin/nav">navigation</Link> item. Each locale loads that item’s
        translation, and missing fields use the default locale when fallback is on.
      </p>
      <p className="lede admin-lede">
        {rootMenuId ? (
          <>
            Site root:{' '}
            <Link href={`/admin/nav/${encodeURIComponent(rootMenuId)}`}>{rootLabel}</Link>.
          </>
        ) : (
          <>
            No root is set. <code>/{'{locale}'}</code> still uses the page slug <code>home</code>.
          </>
        )}
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
