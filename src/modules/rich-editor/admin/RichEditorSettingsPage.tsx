import React from 'react'
import Link from 'next/link'

import { getSiteSettings } from '@/core/settings'
import { isRichEditorEnabled, RICH_EDITOR_MODULE_ID } from '@/modules/rich-editor/api.server'

export const metadata = {
  title: 'Rich editor settings — Starforge',
  description: 'TipTap rich editor module info and Site Settings toggle.',
}

/** product:rich-editor info / settings (toggle lives under Site Settings → Modules). */
export default async function RichEditorSettingsPage() {
  const settings = await getSiteSettings()
  const on = isRichEditorEnabled(settings)

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Rich editor</h2>
      <p className="lede admin-lede">
        Shared TipTap editor (sanitized HTML) for module content fields. Visual + HTML source modes.
        Bind via <code>@/modules/rich-editor/api</code>.
      </p>

      <div className="page-settings-panel">
        <div className="page-settings-panel-body">
          <p>
            Status:{' '}
            <strong>{on ? 'Enabled' : 'Disabled'}</strong> ({RICH_EDITOR_MODULE_ID})
          </p>
          <p className="layout-muted">
            Turn the module on/off under{' '}
            <Link href="/admin/settings">Site Settings → Modules</Link>. When off, hosts that pass{' '}
            <code>enabled={'{false}'}</code> show a plain textarea fallback.
          </p>
          <ul className="admin-lede">
            <li>Visual: headings, marks, lists, link, align, color, callout, image, gallery, video</li>
            <li>HTML tab: CodeMirror source (sanitized on emit / save)</li>
            <li>Payload Pages body: TipTap HTML field (legacy Lexical still renders publicly)</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
