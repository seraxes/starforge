import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_NAV_MENU_ID, listNavMenus } from '@/core/nav'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { NavMenusManager } from './nav-menus-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nav — Starforge',
  description: 'Navigation sets (menus) and menu items for the public site.',
}

export default async function AdminNavPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)) {
    redirect('/app/admin/settings')
  }

  const menus = await listNavMenus()

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Nav</h2>
      <p className="lede admin-lede">
        Top-level navigation manager (sibling of Users / Site settings / Layouts) — named{' '}
        <strong>navigation sets</strong> with their own items: CMS page or URL, reorder, copy/paste.
        Site settings only <em>assigns</em> which set is the public primary (
        <Link href="/app/admin/settings">Primary nav assignment</Link>). Storage:{' '}
        <code>sf_nav_menus</code>. Default set id: <code>{DEFAULT_NAV_MENU_ID}</code>.
      </p>
      <NavMenusManager
        primaryNavMenuId={settings.primaryNavMenuId}
        menus={menus.map((m) => ({
          id: m.id,
          label: m.label,
          updatedAt: m.updatedAt.toISOString(),
          itemCount: m.itemCount,
          isDefault: m.id === DEFAULT_NAV_MENU_ID,
          isSitePrimary: m.id === settings.primaryNavMenuId,
        }))}
      />
    </section>
  )
}
