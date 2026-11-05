import React from 'react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect as nextRedirect } from 'next/navigation'

import { AuthWelcomePanel } from '@/components/AuthWelcomePanel'
import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/safe-next-path'
import { redirect as i18nRedirect, routing } from '@/core/i18n'
import { getSiteSettings } from '@/core/settings'
import { parseLoginMode } from './login-mode'

function redirectAfterLogin(next: string, locale: string): never {
  if (
    next.startsWith('/admin') ||
    next.startsWith('/cms') ||
    next.startsWith('/api')
  ) {
    nextRedirect(next)
  }
  i18nRedirect({ href: next, locale })
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; reset?: string; error?: string; mode?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Auth' })
  return {
    title: t('signInTitle'),
    description: t('signInDescription'),
  }
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const query = await searchParams
  const next = safeNextPath(query.next, '/')
  const [session, settings, t] = await Promise.all([
    getAppSession(),
    getSiteSettings(),
    getTranslations('Auth'),
  ])
  if (session) {
    redirectAfterLogin(next, locale)
  }

  return (
    <div className="auth-page">
      <AuthWelcomePanel
        siteName={settings.siteName}
        variant="page"
        title={t('signIn')}
        registrationEnabled={settings.features.registration}
        welcomeNote={t('welcomeNoteGuest')}
        next={next === '/' ? undefined : next}
        resetSuccess={query.reset === '1'}
        magicError={query.error === 'magic_link'}
        initialMode={parseLoginMode(query.mode)}
        showForm
      />
    </div>
  )
}
