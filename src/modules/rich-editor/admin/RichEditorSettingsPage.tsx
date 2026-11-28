import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { isRichEditorEnabled, RICH_EDITOR_MODULE_ID } from '@/modules/rich-editor/api.server'
import { loadRichEditorModuleSettings } from '../pack-settings'
import { RichEditorSettingsForm } from './rich-editor-settings-form'

export const metadata = {
  title: 'Rich editor settings — Starforge',
  description: 'TipTap rich editor module settings (emoji insert and Site Settings toggle).',
}

/** product:rich-editor info / settings (module toggle under Site Settings → Modules). */
export default async function RichEditorSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.richEditor)) {
    redirect('/admin/settings')
  }
  const on = isRichEditorEnabled(settings)
  const loaded = await loadRichEditorModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Rich editor</h2>
      <p className="lede admin-lede">
        Shared TipTap editor (sanitized HTML) for module content fields. Bind via{' '}
        <code>@/modules/rich-editor/api</code>. Module on/off:{' '}
        <Link href="/admin/settings">Site Settings → Modules</Link>.
      </p>

      <div className="admin-settings-mosaic">
        <div className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Module</h3>
          </header>
          <div className="page-settings-panel-body">
            <p>
              Status:{' '}
              <strong>{on ? 'Enabled' : 'Disabled'}</strong> ({RICH_EDITOR_MODULE_ID})
            </p>
            <p className="layout-muted">
              When the module is off, hosts that pass <code>enabled={'{false}'}</code> show a plain
              textarea fallback.
            </p>
            <ul className="admin-lede">
              <li>Visual: headings, marks, lists, link, align, color, callout, image, gallery, video</li>
              <li>HTML tab: CodeMirror source (sanitized on emit / save)</li>
              <li>Payload Pages body: TipTap HTML field (legacy Lexical still renders publicly)</li>
            </ul>
          </div>
        </div>
      </div>

      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run{' '}
          <code>npm run db:migrate</code> if <code>sf_module_settings</code> is missing.
        </p>
      ) : null}

      <RichEditorSettingsForm settings={loaded.settings} />
    </section>
  )
}
