import React from 'react'
import Link from 'next/link'

import { getSiteChrome } from '@/core/site-chrome'
import { IntegrationsForm } from './integrations-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Integrations — Starforge',
  description: 'Captcha provider enable and other site integrations.',
}

export default async function AdminSettingsIntegrationsPage() {
  const chrome = await getSiteChrome()

  return (
    <section className="admin-section">
      <h2>Site settings — Integrations</h2>
      <p className="lede admin-lede">
        Sitewide captcha enable + provider for Form particles that opt into the site default.
        Turnstile keys stay in env (gated{' '}
        <Link href="/app/admin/site-chrome/environment">Environment</Link>), never this form or the
        database. Font Awesome lives under{' '}
        <Link href="/app/admin/page-settings#font-awesome">Layouts → Font Awesome</Link>, not here.
        Offline / SEO / cookies / email remain under{' '}
        <Link href="/app/admin/site-chrome">Site Chrome</Link>.
      </p>
      <IntegrationsForm
        captchaEnabled={chrome.captchaEnabled}
        captchaProvider={chrome.captchaProvider}
      />
    </section>
  )
}
