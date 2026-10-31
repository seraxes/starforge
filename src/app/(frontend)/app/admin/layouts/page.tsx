import React from 'react'
import Link from 'next/link'

import { listModulesForLayoutAdmin, loadLayoutDocument } from '@/core/modules'

import { LayoutEditor } from './layout-editor'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Layout — Starforge',
  description: 'Visual layout manager foundation — sections, positions, module assignments.',
}

export default async function AdminLayoutsPage() {
  const { document, source, isFallback } = await loadLayoutDocument()
  const modules = await listModulesForLayoutAdmin()

  return (
    <section className="admin-section">
      <h2>Layout manager</h2>
      <p className="lede admin-lede">
        Foundation for a Gantry-like visual layout editor. Add sections, name positions, and assign
        registered modules. Storage is a JSON document in core Postgres (
        <code>sf_layouts</code>
        ){isFallback ? ' — currently using the checked-in default until the first save' : ''}.
        Turn on <Link href="/app/admin/settings">Modules</Link> under site settings so positions
        render on the public site. Full drag-drop, custom JS particles, and ACL come later.
      </p>
      <LayoutEditor document={document} source={source} modules={modules} />
    </section>
  )
}
