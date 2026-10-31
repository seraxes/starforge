import React from 'react'
import Link from 'next/link'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import {
  getLayoutOutline,
  listLayoutOutlines,
  listModulesForLayoutAdmin,
  loadLayoutDocument,
} from '@/core/modules'

import { LayoutEditor } from './layout-editor'
import { LayoutOutlineProvider } from './layout-outline-context'
import { OutlineSwitcher } from './outline-switcher'

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
  const modules = await listModulesForLayoutAdmin()

  return (
    <section className="admin-section layout-admin-section admin-layouts-full">
      <h2>Layout manager</h2>
      <p className="lede admin-lede">
        Editing outline <strong>{outlineMeta.label}</strong> (<code>{layoutId}</code>
        {isFallback ? ' — default until first drop/save' : ''}). Full-width Gantry Layout Manager:
        section → row → drag particles → resize in <strong>1%</strong> steps (
        <strong>5%–95%</strong>). Manage named layouts under{' '}
        <Link href="/app/admin/outlines">Outlines</Link>; assign via{' '}
        <Link href="/app/admin/page-settings">Page settings</Link>. Storage:{' '}
        <code>sf_layouts</code>.{' '}
        <a
          href="https://docs.gantry.org/gantry5/configure/layout-manager"
          target="_blank"
          rel="noreferrer"
        >
          Gantry docs
        </a>
        .
      </p>

      <OutlineSwitcher
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentId={layoutId}
      />

      <LayoutOutlineProvider layoutId={layoutId}>
        <LayoutEditor
          document={document}
          source={source}
          modules={modules}
          layoutId={layoutId}
          layoutLabel={outlineMeta.label}
        />
      </LayoutOutlineProvider>
    </section>
  )
}
