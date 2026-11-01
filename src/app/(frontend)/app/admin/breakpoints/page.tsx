import React from 'react'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  getLayoutOutline,
  listLayoutOutlines,
  loadLayoutDocument,
  normalizeLayoutBreakpoints,
} from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

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

/**
 * Layouts → Styles: live section style panels + outline breakpoints.
 * Route stays `/app/admin/breakpoints` (not nested under `layouts/`) to avoid
 * Next 16 Turbopack stale `build-manifest` ENOENT for nested layout routes.
 */
export default async function AdminStylesPage(props: { searchParams?: SearchParams }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/app/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineParam(search.outline)

  const outlines = await listLayoutOutlines()
  const known = outlines.some((o) => o.id === requestedId)
  const layoutId = known ? requestedId : DEFAULT_LAYOUT_ID

  const { document, label } = await loadLayoutDocument(layoutId)
  const outlineMeta = (await getLayoutOutline(layoutId)) ?? {
    id: layoutId,
    label: label || layoutId,
  }
  const breakpoints = normalizeLayoutBreakpoints(
    document.styles?.breakpoints ?? DEFAULT_LAYOUT_BREAKPOINTS,
  )

  const sections = [...document.sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    .map((section) => ({
      id: section.id,
      label: section.label || section.id,
      styles: section.styles,
    }))

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="styles"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
      />
      <h2>Styles</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Live sections on outline <strong>{outlineMeta.label}</strong> — text/background colors,
        background image, and overlay. Deleting a section on Layout removes its Styles entry.
        Breakpoints below stay outline-scoped (<code>--sf-bp-*</code>).
      </p>

      <LayoutOutlineProvider layoutId={layoutId}>
        <h3 className="section-styles-heading">Section Styles</h3>
        <SectionStylesPanel sections={sections} />

        <h3 className="section-styles-heading" id="breakpoints">
          Breakpoints
        </h3>
        <BreakpointsForm layoutLabel={outlineMeta.label} breakpoints={breakpoints} />
      </LayoutOutlineProvider>
    </section>
  )
}
