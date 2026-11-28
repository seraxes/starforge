import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { DriverHomeView } from './driver-home-view'
import { loadDriverHomeForUser } from './load-driver-home'

type Args = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: 'My onboarding',
  robots: { index: false, follow: false },
}

/** Signed-in user view: current status message, action chip, and tiles. */
export default async function AccountOnboardingPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) notFound()

  const session = await getAppSession()
  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/account/onboarding')}`)
  }

  const home = await loadDriverHomeForUser(userId)

  return (
    <div className="sf-account-page">
      <h1>My onboarding</h1>
      <p className="lede">Your current step, and the actions for that step.</p>
      {home ? (
        <DriverHomeView
          label={home.label}
          actionChip={home.actionChip}
          nextStep={home.nextStep}
          tiles={home.tiles}
        />
      ) : (
        <section className="page-settings-panel">
          <div className="page-settings-panel-body">
            <p>No onboarding step is on this account yet.</p>
            <p>
              <Link href="/onboarding/apply">Apply</Link>
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
