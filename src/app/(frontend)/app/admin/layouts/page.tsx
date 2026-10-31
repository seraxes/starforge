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
        Full-width Gantry Layout Manager: create <strong>section</strong> → add <strong>row</strong> →{' '}
        <strong>drag</strong> particles into the row (side-by-side) → resize in <strong>1%</strong>{' '}
        steps (<strong>5%–95%</strong>, pair sums to 100%). Built-ins: Page Content, Site Header,
        Custom (CodeMirror). Storage: JSON in <code>sf_layouts</code>
        {isFallback ? ' — default until first drop/save' : ''}. Extension particles need{' '}
        <Link href="/app/admin/settings">Modules</Link> on.{' '}
        <a href="https://docs.gantry.org/gantry5/configure/layout-manager" target="_blank" rel="noreferrer">
          Gantry docs
        </a>
        .
      </p>
      <LayoutEditor document={document} source={source} modules={modules} />
    </section>
  )
}
