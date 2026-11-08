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
import {
  ensureDefaultContactFormSeeded,
  listFormDefinitions,
} from '@/core/forms'
import { listNavMenus } from '@/core/nav'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isSkinPinnedByEnv, listSkins } from '@/core/skin'
import { getActiveSkin } from '@/core/skin/resolve-active'

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
    redirect('/admin/settings')
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
  const formsModuleEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  if (formsModuleEnabled) {
    await ensureDefaultContactFormSeeded()
  }
  const [modules, groups, navMenus, formDefinitions] = await Promise.all([
    listModulesForLayoutAdmin(),
    listUserGroupOptions(),
    listNavMenus(),
    formsModuleEnabled ? listFormDefinitions() : Promise.resolve([]),
  ])

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const activeSkin = await getActiveSkin()

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <LayoutsAdminNav
        active="layout"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
        skins={listSkins().map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2 className="sr-only">Layout manager</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Editing outline <strong>{outlineMeta.label}</strong> (<code>{layoutId}</code>
        {isFallback ? ' — default until first drop/save' : ''}). Drag particles · resize 1% ·{' '}
        <Link href="/admin/outlines">Manage outlines</Link>
        {pageSettingsOn ? (
          <>
            {' · '}
            <Link href="/admin/page-settings">Page settings</Link>
          </>
        ) : null}
        .
      </p>

      <LayoutOutlineProvider layoutId={layoutId}>
        {/* Remount on outline switch so soft-merge / cog drafts cannot target the wrong layoutId. */}
        <LayoutEditor
          key={layoutId}
          document={document}
          source={source}
          modules={modules}
          groups={groups}
          navMenus={navMenus.map((m) => ({ id: m.id, label: m.label }))}
          formDefinitions={formDefinitions.map((f) => ({ id: f.id, label: f.label }))}
          formsModuleEnabled={formsModuleEnabled}
          primaryNavMenuId={settings.primaryNavMenuId}
          layoutId={layoutId}
          layoutLabel={outlineMeta.label}
        />
      </LayoutOutlineProvider>
    </section>
  )
}
