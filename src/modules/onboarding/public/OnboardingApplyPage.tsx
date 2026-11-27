import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureSeededStatuses, listStatuses } from '../store'
import { statusListLabel } from '../status-rules'
import { OnboardingApplyForm } from './apply-form'

type Args = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Apply',
    description: 'Start an Onboarding application.',
    robots: { index: false, follow: false },
  }
}

/** Public applicant view. Creates a Core user in recruiting and sends set-password mail. */
export default async function OnboardingApplyPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) notFound()

  const session = await getAppSession()
  const signedIn = Boolean(session?.user?.id)
  const statuses = await ensureSeededStatuses().catch(() => listStatuses().catch(() => []))
  const recruiting = statuses.find((status) => status.phase === 'recruiting')
  const label = recruiting ? statusListLabel(recruiting) : 'Apply'
  const nextStep = recruiting?.nextStepMessage.trim() ?? ''

  return (
    <div className="sf-account-page">
      <h1>{label || 'Apply'}</h1>
      <p className="lede">
        {nextStep ||
          'Apply with your name and email. We create your account and email a link to set your password.'}
      </p>
      <section className="page-settings-panel">
        <div className="page-settings-panel-head">
          <h2>Application</h2>
        </div>
        <div className="page-settings-panel-body">
          {signedIn ? (
            <p>
              You are already signed in.{' '}
              <Link href="/account/onboarding">Open your onboarding home</Link>.
            </p>
          ) : (
            <OnboardingApplyForm />
          )}
        </div>
      </section>
    </div>
  )
}
