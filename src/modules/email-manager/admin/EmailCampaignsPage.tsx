import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { kickDueBroadcasts } from '../broadcast-engine'
import { listBroadcastRecipientsForAdmin } from '../broadcast-store'
import {
  listEmailCampaignRecipientEmails,
  listEmailCampaigns,
  syncEmailCampaignListStatuses,
} from '../campaign-store'
import { listEmailTemplates } from '../store'
import { EmailAdminNav } from './email-admin-nav'
import { EmailCampaignsManager } from './email-campaigns-manager'

export const metadata = {
  title: 'Email campaigns — Starforge',
  description: 'Draft and send paced emails with a template and pasted recipients.',
}

/** product:email-manager campaign list + inline expand editor. */
export default async function EmailCampaignsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  // Restart-safe: memory JobRunner timers die; kick anything due, then sync status.
  await kickDueBroadcasts()

  const listed = await listEmailCampaigns({ limit: 40 })
  const rows = listed.unavailable
    ? listed.rows
    : await syncEmailCampaignListStatuses(listed.rows)

  const templates = await listEmailTemplates()

  const campaigns = await Promise.all(
    rows.map(async (row) => {
      const recipientsText = (await listEmailCampaignRecipientEmails(row.id)).join('\n')
      const broadcastId = (row.broadcastId || '').trim()
      const showBroadcastRecipients =
        row.status !== 'draft' && Boolean(broadcastId) && Boolean(row.broadcast)
      const broadcastRecipients = showBroadcastRecipients
        ? await listBroadcastRecipientsForAdmin(broadcastId, 'all')
        : null

      return {
        id: row.id,
        label: row.label,
        templateId: row.templateId,
        templateLabel: row.templateLabel,
        recipientCount: row.recipientCount,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
        recipientsText,
        broadcast: row.broadcast
          ? {
              status: row.broadcast.status,
              totalCount: row.broadcast.totalCount,
              sentCount: row.broadcast.sentCount,
              failedCount: row.broadcast.failedCount,
              skippedCount: row.broadcast.skippedCount,
              nextRunAt: row.broadcast.nextRunAt
                ? row.broadcast.nextRunAt.toISOString()
                : null,
            }
          : null,
        broadcastRecipients: broadcastRecipients
          ? {
              rows: broadcastRecipients.rows.map((r) => ({
                id: r.id,
                email: r.email,
                status: r.status,
                error: r.error,
                sentAt: r.sentAt ? r.sentAt.toISOString() : null,
              })),
              total: broadcastRecipients.total,
            }
          : null,
      }
    }),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <EmailAdminNav active="campaigns" />
      <h2>Email campaigns</h2>
      <p className="lede admin-lede">
        A name, one template, and a pasted recipient list. Click a label (or Edit) to expand the
        editor on this page. Send queues one paced broadcast; counts follow that broadcast.{' '}
        <Link href="/admin/email/templates">Email → Templates</Link>
        {' · '}
        <Link href="/admin/email/broadcasts">Broadcasts</Link>.
      </p>

      <EmailCampaignsManager
        unavailable={listed.unavailable}
        unavailableError={listed.error}
        richEditorEnabled={isRichEditorEnabled(settings)}
        templates={templates.map((t) => ({
          id: t.id,
          label: t.label,
          subject: t.subject,
          bodyText: t.bodyText,
          bodyHtml: t.bodyHtml ?? '',
          updatedAt: t.updatedAt.toISOString(),
        }))}
        campaigns={campaigns}
      />
    </section>
  )
}
