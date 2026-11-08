import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { countProfiles, listProfileDirectory } from '../store'
import { ProfilesAdminNav } from './profiles-admin-nav'
import { ProfilesManager } from './profiles-manager'

export const metadata = {
  title: 'Profiles — Starforge',
  description: 'Member profiles directory (Profiles module).',
}

type Search = Promise<{ q?: string; status?: string }>

/** product:profiles — member directory + profile admin. */
export default async function ProfilesListPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 100)
  const rawStatus = (params.status ?? 'all').trim()
  const status =
    rawStatus === 'active' || rawStatus === 'hidden' || rawStatus === 'none'
      ? rawStatus
      : 'all'

  const [rows, totals] = await Promise.all([
    listProfileDirectory({ q, status }),
    countProfiles(),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <ProfilesAdminNav active="profiles" />
      <h2>Profiles</h2>
      <p className="lede admin-lede">
        One persona per account — Events, Marketplace, Social and every other module read
        names, avatars and privacy from here. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Sign-in accounts:{' '}
        <Link href="/admin/users">Users</Link>.
      </p>
      <ProfilesManager
        q={q}
        status={status}
        totals={totals}
        rows={rows.map((r) => ({
          ...r,
          updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
        }))}
      />
    </section>
  )
}
