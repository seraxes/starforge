import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import {
  flattenNavItemsInOrder,
  listEnabledModuleNavOptions,
  listNavPageOptions,
  loadNavMenu,
} from '@/core/nav'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { ensureModulesRegistered } from '@/modules/catalog'

import { NavItemsEditor } from './nav-items-editor'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ menuId: string }>
}

export async function generateMetadata({ params }: Args) {
  const { menuId } = await params
  const loaded = await loadNavMenu(decodeURIComponent(menuId))
  return {
    title: `${loaded.label} — Nav — Starforge`,
    description: `Edit items for navigation set ${loaded.id}.`,
  }
}

export default async function AdminNavMenuItemsPage({ params }: Args) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)) {
    redirect('/app/admin/settings')
  }

  ensureModulesRegistered()

  const { menuId: rawId } = await params
  const menuId = decodeURIComponent(rawId)
  const loaded = await loadNavMenu(menuId)

  if (loaded.isFallback && loaded.source === 'empty') {
    notFound()
  }

  const [pages, modules] = await Promise.all([
    listNavPageOptions(),
    Promise.resolve(listEnabledModuleNavOptions(settings)),
  ])
  const items = flattenNavItemsInOrder(loaded.document.items)

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Nav items — {loaded.label}</h2>
      <p className="lede admin-lede">
        Bind each item to a CMS page, URL, or an <strong>enabled module view</strong> (Modules
        catalog / registry <code>navViews</code>). Reorder with Up/Down; Copy/Paste to duplicate.
        Access level is a stub for upcoming ACL.{' '}
        <Link href="/app/admin/nav">Back to menus</Link>
        {settings.primaryNavMenuId === loaded.id ? (
          <>
            {' '}
            · This set is the site primary (
            <Link href="/app/admin/settings">Site settings</Link>).
          </>
        ) : null}
      </p>
      <NavItemsEditor
        menuId={loaded.id}
        menuLabel={loaded.label}
        items={items}
        pages={pages}
        modules={modules}
        isSitePrimary={settings.primaryNavMenuId === loaded.id}
      />
    </section>
  )
}
