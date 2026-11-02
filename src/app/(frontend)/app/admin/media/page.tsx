import React from 'react'
import Link from 'next/link'

import { listMedia } from '@/core/media/resolve'
import { getMediaStorageInfo } from '@/core/media/storage'

import { MediaLibraryClient } from './media-library'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Media — Starforge',
  description: 'Starforge media library around Payload Media (folders, resize, WebP).',
}

type Search = Promise<{ folder?: string; purpose?: string; q?: string }>

export default async function AdminMediaPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams
  const folder = (params.folder ?? 'all').trim() || 'all'
  const purpose = (params.purpose ?? 'all').trim() || 'all'
  const q = (params.q ?? '').trim()

  const storage = getMediaStorageInfo()
  let docs: Awaited<ReturnType<typeof listMedia>>['docs'] = []
  let totalDocs = 0
  let listError: string | null = null

  try {
    const result = await listMedia({
      folder: folder === 'all' ? undefined : folder,
      purpose: purpose === 'all' ? undefined : purpose,
      q: q || undefined,
      limit: 60,
    })
    docs = result.docs
    totalDocs = result.totalDocs
  } catch (err) {
    listError = err instanceof Error ? err.message : 'Failed to load media.'
  }

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Media</h2>
      <p className="lede admin-lede">
        Single Payload media library with Starforge pipeline (folders, max size, WebP for photos,
        PNG logos). Bind from Logo, Styles, and Forms via the media picker — raw URL is fallback
        only. Full CMS edit:{' '}
        <Link href="/admin/collections/media">CMS → Media</Link>.
      </p>
      {listError ? (
        <p className="form-error" role="alert">
          {listError}
        </p>
      ) : null}
      <MediaLibraryClient
        initialDocs={docs}
        totalDocs={totalDocs}
        storage={storage}
        folder={folder}
        purpose={purpose}
        q={q}
      />
    </section>
  )
}
