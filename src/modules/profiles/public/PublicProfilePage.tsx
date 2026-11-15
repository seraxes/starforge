import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonaByHandle } from '@/modules/profiles/api.server'
import { PublicProfile } from '@/modules/profiles/public/PublicProfile'

type Args = { params: Promise<{ locale: string; handle: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, handle } = await params
  const [settings, chrome, viewer] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    getAccessViewer(),
  ])
  const siteName = chrome.siteName || settings.siteName
  const notFoundMeta = { title: `Not found — ${siteName}` }

  if (!isValidLocaleCode(localeParam)) return notFoundMeta
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) return notFoundMeta

  const found = await getPersonaByHandle(decodeURIComponent(handle), viewer)
  if (!found) return notFoundMeta
  return {
    title: found.persona.displayName,
    description: found.persona.headline || `${found.persona.displayName} on ${siteName}`,
  }
}

/** Public profile page — `/[locale]/u/[handle]` (product:profiles). */
export default async function PublicProfilePage({ params }: Args) {
  const { locale: localeParam, handle } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) notFound()

  const viewer = await getAccessViewer()
  const found = await getPersonaByHandle(decodeURIComponent(handle), viewer)
  if (!found) notFound()

  return (
    <div className="sf-profile-page">
      <PublicProfile
        persona={found.persona}
        locale={locale}
        memberSince={found.createdAt}
        adminEditHref={
          viewer.isAppAdmin ? `/admin/profiles/${found.persona.userId}` : undefined
        }
      />
    </div>
  )
}
