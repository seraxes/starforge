import React from 'react'
import Link from 'next/link'

import { getSiteChrome } from '@/core/site-chrome'
import { SecuritySettingsForm } from './security-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Security — Starforge',
  description: 'Captcha, honeypot, rate limits, and security headers.',
}

export default async function AdminSettingsSecurityPage() {
  const chrome = await getSiteChrome()

  return (
    <section className="admin-section">
      <h2>Settings — Security</h2>
      <p className="lede admin-lede">
        Sitewide captcha enable + provider for Form particles that opt into the site default, plus
        room for honeypot, rate-limit, and security-header controls. Turnstile keys stay in env
        (gated <Link href="/app/admin/site-chrome/environment">Environment</Link>), never this form
        or the database. Font Awesome lives under{' '}
        <Link href="/app/admin/page-settings#font-awesome">Layouts → Page settings</Link>, not
        here.
        Offline / SEO / cookies / email remain under{' '}
        <Link href="/app/admin/site-chrome">Chrome</Link>.
      </p>
      <SecuritySettingsForm
        captchaEnabled={chrome.captchaEnabled}
        captchaProvider={chrome.captchaProvider}
      />
    </section>
  )
}
