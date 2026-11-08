import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { getEnabledPublicLocaleEntries } from '@/core/i18n/enabled'
import { withLocalePrefix } from '@/core/i18n/path'
import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { saveOwnProfileAction } from '@/modules/profiles/actions'
import { ProfileEditor } from '@/modules/profiles/components/ProfileEditor'
import { buildEditorModel } from '@/modules/profiles/form'
import { AccountNav } from '@/modules/profiles/public/AccountNav'
import { loadProfilesModuleSettings } from '@/modules/profiles/settings.server'
import { ensureProfile } from '@/modules/profiles/store'

type Args = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: 'Your profile',
  robots: { index: false, follow: false },
}

/** Member self-service profile editor (product:profiles). */
export default async function AccountProfilePage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) notFound()
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/account/profile')}`)
  }

  const user = session.user as { id: string; email: string }
  const mapsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.maps)
  const [record, loaded, locales, mapClientConfig] = await Promise.all([
    ensureProfile(user.id),
    loadProfilesModuleSettings(),
    getEnabledPublicLocaleEntries(),
    mapsEnabled ? getMapProvider().then((p) => p.clientConfig()) : Promise.resolve(null),
  ])
  if (!record) notFound()

  const model = buildEditorModel({
    record,
    email: user.email,
    settings: loaded.settings,
    locales,
    actor: 'self',
  })

  return (
    <article className="cms-page sf-profile-page">
      <header className="cms-page-header">
        <h1>Your profile</h1>
      </header>
      <AccountNav active="profile" locale={locale} handle={record.handle} />
      <p className="lede">
        This is how you appear across the whole community — events, marketplace, posts and
        messages. Choose who can see each detail with the selector next to it.
      </p>
      <ProfileEditor
        model={model}
        action={saveOwnProfileAction}
        chrome="public"
        imagePicker="member"
        cancelHref={withLocalePrefix(`/u/${record.handle}`, locale)}
        mapClientConfig={mapClientConfig}
        locale={locale}
        viewHrefPrefix={`${withLocalePrefix('/u/', locale).replace(/\/$/, '')}/`}
      />
    </article>
  )
}
