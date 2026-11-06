import React from 'react'
import Link from 'next/link'

import { getSiteSettings } from '@/core/settings'
import { isLexicalEditorEnabled, LEXICAL_EDITOR_MODULE_ID } from '@/modules/lexical-editor/api.server'

export const metadata = {
  title: 'Lexical editor settings — Starforge',
  description: 'Optional Lexical pack info and Site Settings toggle.',
}

/** product:lexical-editor info / settings. */
export default async function LexicalEditorSettingsPage() {
  const settings = await getSiteSettings()
  const on = isLexicalEditorEnabled(settings)

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Lexical editor</h2>
      <p className="lede admin-lede">
        Optional Payload Lexical stack. Default content editing is{' '}
        <Link href="/admin/rich-editor/settings">TipTap (Rich editor)</Link> with sanitized HTML.
      </p>

      <div className="page-settings-panel">
        <div className="page-settings-panel-body">
          <p>
            Status:{' '}
            <strong>{on ? 'Enabled' : 'Disabled'}</strong> ({LEXICAL_EDITOR_MODULE_ID})
          </p>
          <p className="layout-muted">
            Toggle under <Link href="/admin/settings">Site Settings → Modules</Link>. Public{' '}
            <code>RichText</code> still renders legacy Lexical JSON when present so old pages do not
            go blank; TipTap HTML is the write path for new/edited bodies.
          </p>
          <ul className="admin-lede">
            <li>
              Config export: <code>@/modules/lexical-editor/api</code> →{' '}
              <code>pagesLexicalEditor</code>
            </li>
            <li>Dependency: <code>@payloadcms/richtext-lexical</code> (kept while this pack exists)</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
