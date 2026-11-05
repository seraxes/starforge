import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getMailerInfo } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listRecentEmailSends } from '../list-sends'
import { EmailAdminNav } from './email-admin-nav'
import { EmailSendsList } from './email-sends-list'

export const metadata = {
  title: 'Email sends — Starforge',
  description: 'Recent Email Manager send log (Mailer attempts).',
}

/** product:email-manager send log admin. */
export default async function EmailSendsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  const [result, mailer] = await Promise.all([listRecentEmailSends({ limit: 50 }), getMailerInfo()])

  const transportLabel = !mailer.enabled
    ? 'disabled'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

  return (
    <section className="admin-section admin-layouts-full">
      <EmailAdminNav active="sends" />
      <h2>Email sends</h2>
      <p className="lede admin-lede">
        Recent outbound attempts via the platform <strong>Mailer</strong> ({transportLabel}
        {mailer.detail ? ` — ${mailer.detail}` : ''}). Configure enable / provider / From under{' '}
        <Link href="/admin/site-chrome">Chrome</Link>. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>

      <EmailSendsList rows={result.rows} unavailable={result.unavailable} />
    </section>
  )
}
