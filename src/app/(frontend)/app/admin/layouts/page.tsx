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
        Gantry-like canvas: left palette = particles (modules); main area = sections with rows and
        12-column widths (Starforge grid math — not Bootstrap). Built-ins include{' '}
        <strong>Page Content</strong>, <strong>Site Header</strong>, and <strong>Custom</strong>{' '}
        (HTML/CSS; JS stub for developer-admins later). Storage is JSON in{' '}
        <code>sf_layouts</code>
        {isFallback ? ' — using the checked-in default until the first save' : ''}. Extension
        particles still need <Link href="/app/admin/settings">Modules</Link> on.
      </p>
      <LayoutEditor document={document} source={source} modules={modules} />
    </section>
  )
}
