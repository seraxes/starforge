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

import { LayoutOutlineProvider } from '../layout-outline-context'
import { OutlineSwitcher } from '../outline-switcher'
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

export default async function AdminLayoutBreakpointsPage(props: { searchParams?: SearchParams }) {
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

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <h2>Breakpoints</h2>
      <p className="lede admin-lede">
        Outline-scoped responsive breakpoints (Large desktop / Desktop / Tablet / Mobile / Mobile
        menu). Same outline switcher as the{' '}
        <Link href={`/app/admin/layouts${layoutId === 'default' ? '' : `?outline=${encodeURIComponent(layoutId)}`}`}>
          Layout
        </Link>{' '}
        canvas — no separate Styles mega-page. Public CSS exposes{' '}
        <code>--sf-bp-*</code> and <code>--sf-container-max</code>; boxed sections use the large
        desktop value as their max width.
      </p>

      <OutlineSwitcher
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentId={layoutId}
        basePath="/app/admin/layouts/breakpoints"
      />

      <LayoutOutlineProvider layoutId={layoutId}>
        <BreakpointsForm
          layoutLabel={outlineMeta.label}
          breakpoints={breakpoints}
        />
      </LayoutOutlineProvider>
    </section>
  )
}
