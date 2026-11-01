import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { DEFAULT_LAYOUT_ID } from '@/core/db'
import {
  getLayoutOutline,
  listLayoutOutlines,
  listModulesForLayoutAdmin,
  loadLayoutDocument,
} from '@/core/modules'
import { listNavMenus } from '@/core/nav'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { LayoutEditor } from './layout-editor'
import { LayoutOutlineProvider } from './layout-outline-context'
import { LayoutsAdminNav } from './layouts-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Layout — Starforge',
  description: 'Gantry-like visual layout manager — particles, sections, percent widths.',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

function pickOutlineParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LAYOUT_ID
}

export default async function AdminLayoutsPage(props: { searchParams?: SearchParams }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/app/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineParam(search.outline)

  const outlines = await listLayoutOutlines()
  const known = outlines.some((o) => o.id === requestedId)
  const layoutId = known ? requestedId : DEFAULT_LAYOUT_ID

  const { document, source, isFallback, label } = await loadLayoutDocument(layoutId)
  const outlineMeta = (await getLayoutOutline(layoutId)) ?? {
    id: layoutId,
    label: label || layoutId,
  }
  await ensureDefaultUserGroupsSeeded()
  const [modules, groups, navMenus] = await Promise.all([
    listModulesForLayoutAdmin(),
    listUserGroupOptions(),
    listNavMenus(),
  ])

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <LayoutsAdminNav
        active="layout"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
      />
      <h2 className="sr-only">Layout manager</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Editing outline <strong>{outlineMeta.label}</strong> (<code>{layoutId}</code>
        {isFallback ? ' — default until first drop/save' : ''}). Drag particles · resize 1% ·{' '}
        <Link href="/app/admin/outlines">Manage outlines</Link>
        {pageSettingsOn ? (
          <>
            {' · '}
            <Link href="/app/admin/page-settings">Page settings</Link>
          </>
        ) : null}
        .
      </p>

      <LayoutOutlineProvider layoutId={layoutId}>
        <LayoutEditor
          document={document}
          source={source}
          modules={modules}
          groups={groups}
          navMenus={navMenus.map((m) => ({ id: m.id, label: m.label }))}
          primaryNavMenuId={settings.primaryNavMenuId}
          layoutId={layoutId}
          layoutLabel={outlineMeta.label}
        />
      </LayoutOutlineProvider>
    </section>
  )
}
