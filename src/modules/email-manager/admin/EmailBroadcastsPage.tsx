import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getMailerInfo } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { kickDueBroadcasts } from '../broadcast-engine'
import { listEmailBroadcasts } from '../broadcast-store'
import { loadEmailManagerModuleSettings } from '../settings'
import { EmailAdminNav } from './email-admin-nav'
import { EmailBroadcastsManager } from './email-broadcasts-manager'

export const metadata = {
  title: 'Email broadcasts — Starforge',
  description: 'Paced bulk send queue and pace rules for Email Manager.',
}

/** product:email-manager paced broadcast admin. */
export default async function EmailBroadcastsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  // Restart-safe: memory JobRunner timers die; kick anything due.
  await kickDueBroadcasts()

  const [pace, listed, mailer] = await Promise.all([
    loadEmailManagerModuleSettings(),
    listEmailBroadcasts({ limit: 40 }),
    getMailerInfo(),
  ])

  const transportLabel = !mailer.enabled
    ? 'disabled'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

  return (
    <section className="admin-section admin-layouts-full">
      <EmailAdminNav active="broadcasts" />
      <h2>Email broadcasts</h2>
      <p className="lede admin-lede">
        Paced bulk sends via the platform <strong>Mailer</strong> ({transportLabel}
        {mailer.detail ? ` — ${mailer.detail}` : ''}). Callers pass a template and
        recipient rows; this pack batches and gaps them. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>

      <EmailBroadcastsManager
        settings={pace.settings}
        broadcasts={listed.rows.map((row) => ({
          ...row,
          nextRunAt: row.nextRunAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))}
        unavailable={listed.unavailable}
      />
    </section>
  )
}
