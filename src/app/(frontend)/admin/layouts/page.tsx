import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { DEFAULT_LAYOUT_ID } from '@/core/db'
import {
  getLayoutDocumentForAdmin,
  getLayoutOutline,
  listLayoutOutlines,
  listModulesForLayoutAdmin,
} from '@/core/modules'
import {
  ensureDefaultContactFormSeeded,
  listFormDefinitions,
} from '@/modules/forms'
import { hydrateLayoutDocumentLocales } from '@/core/i18n/content-locales/hydrate'
import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { listNavMenus } from '@/core/nav'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  ensureSkinOutlineSeeds,
  filterOutlinesForSkin,
  getActiveSkin,
  isSkinBaseOutlineId,
  isSkinPinnedByEnv,
  listSkins,
  pickOutlineSearchParam,
  resolveAdminWorkingOutlineId,
} from '@/core/skin'

import { LayoutEditor } from './layout-editor'
import { LayoutOutlineProvider } from './layout-outline-context'
import { LayoutsAdminNav } from './layouts-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Layout — Starforge',
  description: 'Gantry-like visual layout manager — particles, sections, percent widths.',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

export default async function AdminLayoutsPage(props: { searchParams?: SearchParams }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineSearchParam(search.outline)

  // Install any missing skin outline seeds (e.g. Pastel offline) before listing.
  const activeSkin = await getActiveSkin()
  await ensureSkinOutlineSeeds(activeSkin.id)

  const outlines = await listLayoutOutlines()
  const skinOutlines = filterOutlinesForSkin(outlines, activeSkin.id)
  const layoutId = await resolveAdminWorkingOutlineId({
    requestedId,
    skinId: activeSkin.id,
    preferredOutlineId: activeSkin.preferredDefaultOutlineId,
    outlines,
    fallbackId: DEFAULT_LAYOUT_ID,
  })

  const adminBundle = await getLayoutDocumentForAdmin(layoutId)
  const raw = await hydrateLayoutDocumentLocales(layoutId, adminBundle.raw)
  const resolved = await hydrateLayoutDocumentLocales(layoutId, adminBundle.resolved)
  const { parent, parentLayoutId, label } = adminBundle
  const isFallback = raw.sections.length === 0
  const outlineMeta = (await getLayoutOutline(layoutId)) ?? {
    id: layoutId,
    label: label || layoutId,
  }
  await ensureDefaultUserGroupsSeeded()
  const formsModuleEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  if (formsModuleEnabled) {
    await ensureDefaultContactFormSeeded()
  }
  const [modules, groups, navMenus, formDefinitions, contentLocales] = await Promise.all([
    listModulesForLayoutAdmin(),
    listUserGroupOptions(),
    listNavMenus(),
    formsModuleEnabled ? listFormDefinitions() : Promise.resolve([]),
    getContentLocaleOptions(),
  ])

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <LayoutsAdminNav
        active="layout"
        outlines={skinOutlines.map((o) => ({ id: o.id, label: o.label }))}
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
          document={resolved}
          rawDocument={raw}
          parentDocument={parent}
          parentLayoutId={parentLayoutId}
          source={isFallback ? 'default-json' : 'database'}
          modules={modules}
          groups={groups}
          navMenus={navMenus.map((m) => ({ id: m.id, label: m.label }))}
          formDefinitions={formDefinitions.map((f) => ({ id: f.id, label: f.label }))}
          formsModuleEnabled={formsModuleEnabled}
          primaryNavMenuId={settings.primaryNavMenuId}
          contentLocales={contentLocales}
          layoutId={layoutId}
          layoutLabel={outlineMeta.label}
          canInheritOutline={!isSkinBaseOutlineId(layoutId, activeSkin.preferredDefaultOutlineId)}
        />
      </LayoutOutlineProvider>
    </section>
  )
}
