import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listOpenReports } from '../reports-store'
import { findPost } from '../posts-store'
import { SocialAdminNav } from './social-admin-nav'
import { SocialReportsQueue } from './SocialReportsQueue'

export const metadata = {
  title: 'Social reports — Starforge',
  description: 'Review queue for Social abuse reports.',
}

/** product:social report review queue. Does nothing useful when Social is off. */
export default async function SocialReportsPage() {
  const settings = await getSiteSettings()
  const on = isCatalogModuleEnabled(settings, MODULE_IDS.social)

  const open = on ? await listOpenReports({ limit: 100 }) : []
  const rows = await Promise.all(
    open.map(async (report) => {
      const post = await findPost(report.postId)
      return {
        id: report.id,
        postId: report.postId,
        commentId: report.commentId,
        reporterUserId: report.reporterUserId,
        reason: report.reason,
        note: report.note,
        createdAt: report.createdAt.toISOString(),
        postDeleted: !post,
        postBodyPreview: post
          ? post.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
          : null,
        authorUserId: post?.authorUserId ?? null,
      }
    }),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="reports" />
      <h2>Reports</h2>
      <p className="lede admin-lede">
        Open abuse flags on posts (optional comment). Hide closes the report and staff-hides the
        content; Dismiss closes without hide. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>

      {!on ? (
        <div className="admin-settings-mosaic">
          <div className="page-settings-panel">
            <div className="page-settings-panel-head">
              <h3>Status</h3>
            </div>
            <div className="page-settings-panel-body">
              <p className="layout-muted settings-hint">
                Social is off. Turn it on under Settings → Modules to load the review queue.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <SocialReportsQueue rows={rows} />
      )}
    </section>
  )
}
