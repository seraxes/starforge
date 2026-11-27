import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPendingReviewPosts } from '../posts-store'
import { SocialAdminNav } from './social-admin-nav'
import { SocialPendingQueue } from './SocialPendingQueue'

export const metadata = {
  title: 'Social pending — Starforge',
  description: 'Hold-new-posts-for-review queue for Social.',
}

/** product:social pending-review queue. Does nothing useful when Social is off. */
export default async function SocialPendingPage() {
  const settings = await getSiteSettings()
  const on = isCatalogModuleEnabled(settings, MODULE_IDS.social)

  const pending = on ? await listPendingReviewPosts({ limit: 100 }) : []
  const rows = pending.map((post) => ({
    id: post.id,
    authorUserId: post.authorUserId,
    audience: post.audience,
    createdAt: post.createdAt.toISOString(),
    bodyPreview: post.body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120),
  }))

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="pending" />
      <h2>Pending review</h2>
      <p className="lede admin-lede">
        New posts held by Hold new posts for review. Approve publishes under normal audience rules;
        Reject staff-hides the post (People restore list). Module on/off:{' '}
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
                Social is off. Turn it on under Settings → Modules to load the pending queue.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <SocialPendingQueue rows={rows} />
      )}
    </section>
  )
}
