import React from 'react'
import Link from 'next/link'
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

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Breakpoints — Layouts — Starforge',
  description: 'Outline-scoped responsive breakpoints (Gantry-style rem presets).',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

function pickOutlineParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LAYOUT_ID
}

/**
 * Outline-scoped breakpoints admin (Layouts child).
 * Lives at `/app/admin/breakpoints` (not nested under `layouts/`) to avoid a
 * Next 16 Turbopack stale `build-manifest` ENOENT for nested layout routes.
 */
export default async function AdminBreakpointsPage(props: { searchParams?: SearchParams }) {
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

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <LayoutsAdminNav
        active="styles"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
      />
      <h2>Styles · Breakpoints</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Outline-scoped breakpoints (Large desktop / Desktop / Tablet / Mobile / Mobile menu) — no
        Styles mega-page. Public CSS exposes <code>--sf-bp-*</code> and{' '}
        <code>--sf-container-max</code>. Section Background/Text live on the{' '}
        <Link
          href={`/app/admin/layouts${layoutId === 'default' ? '' : `?outline=${encodeURIComponent(layoutId)}`}`}
        >
          Layout
        </Link>{' '}
        canvas.
      </p>

      <LayoutOutlineProvider layoutId={layoutId}>
        <BreakpointsForm layoutLabel={outlineMeta.label} breakpoints={breakpoints} />
      </LayoutOutlineProvider>
    </section>
  )
}
