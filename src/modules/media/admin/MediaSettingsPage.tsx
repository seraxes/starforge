import React from 'react'
import Link from 'next/link'

import { loadMediaPipelineRules } from '@/core/media/settings-store'

import { MediaAdminNav } from './media-admin-nav'
import { MediaSettingsForm } from './media-settings-form'

export const metadata = {
  title: 'Media settings — Starforge',
  description: 'Resize max W×H, JPEG/WebP quality, and PNG-for-logos pipeline rules.',
}

/** product:media settings admin page (M5 — pipeline rules host in the module pack). */
export default async function MediaSettingsPage() {
  const loaded = await loadMediaPipelineRules()

  return (
    <section className="admin-section admin-layouts-full">
      <MediaAdminNav active="settings" />
      <h2>Media settings</h2>
      <p className="lede admin-lede">
        Pipeline rules for decode / resize / re-encode (sharp). Stored in{' '}
        <code>sf_media_settings</code>; defaults match <code>MediaPipelineRules</code>. Library:{' '}
        <Link href="/admin/media">Media → Library</Link>. Payload collection:{' '}
        <Link href="/cms/admin/collections/media">CMS → Media</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (run <code>npm run db:core:push</code> for{' '}
          <code>sf_media_settings</code>). Source: {loaded.source}.
        </p>
      ) : null}
      <MediaSettingsForm rules={loaded.rules} />
      <p className="admin-lede layout-muted">
        Original preprocess honors max W×H / quality immediately. Derivative size fields sync into
        Media Settings storage; Payload <code>imageSizes</code> still need an app restart to match
        (see Derivative sizes panel).
      </p>
    </section>
  )
}
