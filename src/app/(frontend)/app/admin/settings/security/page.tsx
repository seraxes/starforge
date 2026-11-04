import React from 'react'
import Link from 'next/link'

import {
  emptyDeveloperAdminEmailsGrantAllAdmins,
  getDeveloperAdminEmails,
} from '@/core/auth/admin'
import { getSiteChrome } from '@/core/site-chrome'
import { SecuritySettingsForm } from './security-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Security — Starforge',
  description: 'Captcha, honeypot, rate limits, and security headers.',
}

export default async function AdminSettingsSecurityPage() {
  const chrome = await getSiteChrome()
  const developerAdminEmailsEmpty = getDeveloperAdminEmails().length === 0
  const emptyListOpenLocally = emptyDeveloperAdminEmailsGrantAllAdmins()

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
      {developerAdminEmailsEmpty ? (
        <p className="notice-banner" role="status">
          <code>STARFORGE_DEVELOPER_ADMIN_EMAILS</code> is empty
          {emptyListOpenLocally
            ? ' — locally all app admins are developer-admins; production grants nobody (fail-closed).'
            : ' — developer-admin is fail-closed (nobody). Set emails for Environment / script fields.'}{' '}
          Edit via{' '}
          <Link href="/app/admin/site-chrome/environment">Chrome → Environment</Link>.
        </p>
      ) : null}
      <SecuritySettingsForm
        captchaEnabled={chrome.captchaEnabled}
        captchaProvider={chrome.captchaProvider}
      />
    </section>
  )
}
