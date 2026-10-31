import React from 'react'
import Link from 'next/link'

import { listModulesForLayoutAdmin, loadLayoutDocument } from '@/core/modules'

import { LayoutEditor } from './layout-editor'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Layout — Starforge',
  description: 'Gantry-like visual layout manager — particles, sections, 12-col widths.',
}

export default async function AdminLayoutsPage() {
  const { document, source, isFallback } = await loadLayoutDocument()
  const modules = await listModulesForLayoutAdmin()

  return (
    <section className="admin-section">
      <h2>Layout manager</h2>
      <p className="lede admin-lede">
        Aligned with the{' '}
        <a href="https://docs.gantry.org/gantry5/configure/layout-manager" target="_blank" rel="noreferrer">
          Gantry Layout Manager
        </a>
        : left palette = particles; canvas = sections with 12-column widths (Starforge grid math —
        not Bootstrap). Built-ins: <strong>Page Content</strong>, <strong>Site Header</strong>,{' '}
        <strong>Custom</strong> (CodeMirror HTML/CSS/JS — no plain code textareas). Storage is JSON
        in <code>sf_layouts</code>
        {isFallback ? ' — using the checked-in default until the first save' : ''}. Extension
        particles need <Link href="/app/admin/settings">Modules</Link> on. Styles / Outlines / Menu
        editors are next polish.
      </p>
      <LayoutEditor document={document} source={source} modules={modules} />
    </section>
  )
}
