import React from 'react'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  getLayoutDocumentForAdmin,
  getLayoutOutline,
  listLayoutOutlines,
  normalizeLayoutBreakpoints,
} from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  ensureSkinOutlineSeeds,
  getActiveSkin,
  isSkinPinnedByEnv,
  listSkins,
} from '@/core/skin'
import type { LayoutDocument, LayoutSection } from '@/core/modules/types'

import { LayoutOutlineProvider } from '../layouts/layout-outline-context'
import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { BreakpointsForm } from './breakpoints-form'
import { SectionStylesPanel } from './section-styles-panel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Styles — Layouts — Starforge',
  description:
    'Outline-scoped section styles (colors, background image, overlay) and breakpoints.',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

function pickOutlineParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LAYOUT_ID
}

/** Whether Styles card inherits from parent for this section id. */
function sectionStylesInherited(raw: LayoutDocument, canInherit: boolean, sectionId: string): boolean {
  if (!canInherit) return false
  const child = raw.sections.find((s) => s.id === sectionId)
  if (!child) return true
  if (child.stylesInheritMode === 'local') return false
  if (child.stylesInheritMode === 'inherit') return true
  return child.inheritMode === 'inherit'
}

/**
 * Layouts → Styles: live section style panels + outline breakpoints.
 * Route stays `/admin/breakpoints` (not nested under `layouts/`) to avoid
 * Next 16 Turbopack stale `build-manifest` ENOENT for nested layout routes.
 */
export default async function AdminStylesPage(props: { searchParams?: SearchParams }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineParam(search.outline)

  const activeSkin = await getActiveSkin()
  await ensureSkinOutlineSeeds(activeSkin.id)

  const outlines = await listLayoutOutlines()
  const known = outlines.some((o) => o.id === requestedId)
  const layoutId = known ? requestedId : DEFAULT_LAYOUT_ID

  const { raw, resolved, parentLayoutId, label } = await getLayoutDocumentForAdmin(layoutId)
  const outlineMeta = (await getLayoutOutline(layoutId)) ?? {
    id: layoutId,
    label: label || layoutId,
  }
  const breakpoints = normalizeLayoutBreakpoints(
    resolved.styles?.breakpoints ??
      raw.styles?.breakpoints ??
      DEFAULT_LAYOUT_BREAKPOINTS,
  )

  const canInherit = Boolean(
    raw.inheritFrom &&
      String(raw.inheritFrom).trim() &&
      String(raw.inheritFrom).trim() !== layoutId,
  )

  const sections = [...resolved.sections]
    .sort((a: LayoutSection, b: LayoutSection) =>
      (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    .map((section) => ({
      id: section.id,
      label: section.label || section.id,
      styles: section.styles,
      stylesInherited: sectionStylesInherited(raw, canInherit, section.id),
    }))

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="styles"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
        skins={listSkins().map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2>Styles</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Live sections on outline <strong>{outlineMeta.label}</strong> — text/background colors,
        background image, and overlay. When this outline inherits from another, each Styles card can
        inherit the parent section styles as a whole. Breakpoints below stay outline-scoped (
        <code>--sf-bp-*</code>).
      </p>

      <LayoutOutlineProvider layoutId={layoutId}>
        {/* Remount Styles/Breakpoints with the outline so autosave cannot bleed across outlines. */}
        <React.Fragment key={layoutId}>
          <h3 className="section-styles-heading">Section Styles</h3>
          <SectionStylesPanel
            sections={sections}
            canInherit={canInherit}
            parentLayoutId={parentLayoutId}
          />

          <h3 className="section-styles-heading" id="breakpoints">
            Breakpoints
          </h3>
          <BreakpointsForm layoutLabel={outlineMeta.label} breakpoints={breakpoints} />
        </React.Fragment>
      </LayoutOutlineProvider>
    </section>
  )
}
