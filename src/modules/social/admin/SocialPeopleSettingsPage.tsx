import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listBannedMembers } from '../members-store'
import { socialPackAdminPage } from '../pack-settings'
import { listStaffHiddenPosts } from '../posts-store'
import { loadSocialModuleSettings } from '../settings'
import { SocialAdminNav } from './social-admin-nav'
import { SocialPeopleSettingsForm } from './social-people-settings-form'

export const metadata = {
  title: 'Social people — Starforge',
  description:
    'Social people, reactions, bans, report reasons, auto-hide, and word list settings.',
}

/** product:social people / reactions / reports admin (slice 15c). */
export default async function SocialPeopleSettingsPage() {
  const site = await getSiteSettings()
  const on = isCatalogModuleEnabled(site, MODULE_IDS.social)
  const page = socialPackAdminPage(on)

  if (page.mode === 'disabled-notice') {
    return (
      <section className="admin-section admin-layouts-full">
        <SocialAdminNav active="people" />
        <h2>People and reactions</h2>
        <p className="lede admin-lede">
          Friend requests, follow, bans, reactions, report reasons, and word list. Module on/off:{' '}
          <Link href="/admin/settings">Settings → Modules</Link>.
        </p>
        <div className="admin-settings-mosaic">
          <div className="page-settings-panel">
            <div className="page-settings-panel-head">
              <h3>Status</h3>
            </div>
            <div className="page-settings-panel-body">
              <p className="layout-muted settings-hint">{page.notice}</p>
              <p>
                <Link href="/admin/settings">Settings → Modules</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const [loaded, banned, hiddenPosts] = await Promise.all([
    loadSocialModuleSettings(),
    listBannedMembers({ limit: 100 }),
    listStaffHiddenPosts({ limit: 100 }),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="people" />
      <h2>People and reactions</h2>
      <p className="lede admin-lede">
        Friend requests, follow, bans, reaction kinds, report reasons, auto-hide, staff-hidden
        posts, and the word list. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <SocialPeopleSettingsForm
        settings={loaded.settings}
        banned={banned.map((row) => ({
          userId: row.userId,
          bannedAt: row.bannedAt?.toISOString() ?? '',
        }))}
        hiddenPosts={hiddenPosts.map((post) => ({
          id: post.id,
          authorUserId: post.authorUserId,
          bodyPreview: post.body
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80),
          updatedAt: post.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
