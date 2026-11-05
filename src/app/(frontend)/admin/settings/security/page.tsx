import React from 'react'
import Link from 'next/link'

import { isWiredCaptchaProvider } from '@/core/security/captcha/providers'
import { getSiteChrome } from '@/core/site-chrome'
import { SecuritySettingsForm } from './security-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Security — Starforge',
  description: 'Captcha, honeypot, rate limits, and security headers.',
}

export default async function AdminSettingsSecurityPage() {
  const chrome = await getSiteChrome()
  const wired = isWiredCaptchaProvider(chrome.captchaProvider)
  const captchaProvider = wired ? chrome.captchaProvider : 'none'
  const legacyUnwiredProvider = wired ? null : chrome.captchaProvider

  return (
    <section className="admin-section">
      <h2>Settings — Security</h2>
      <p className="lede admin-lede">
        Captcha provider + surface toggles (Forms default, registration, auth recovery) via the Core
        security port. Turnstile keys stay in env (gated{' '}
        <Link href="/admin/site-chrome/environment">Environment</Link>), never this form or the
        database. Font Awesome lives under{' '}
        <Link href="/admin/page-settings#font-awesome">Layouts → Page settings</Link>, not here.
        Offline / SEO / cookies / email remain under{' '}
        <Link href="/admin/site-chrome">Chrome</Link>.
      </p>
      <SecuritySettingsForm
        captchaEnabled={chrome.captchaEnabled}
        captchaProvider={captchaProvider}
        captchaOnRegister={chrome.captchaOnRegister}
        captchaOnAuthRecovery={chrome.captchaOnAuthRecovery}
        legacyUnwiredProvider={legacyUnwiredProvider}
      />
    </section>
  )
}
