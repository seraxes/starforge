import React from 'react'
import Link from 'next/link'

import { getMediaAnalysisPort } from '@/core/media/analysis'
import { ensureLegacyCategoryRoots, listMediaCategoryTree } from '@/core/media/category-store'
import { getMediaEncodePolicy } from '@/core/media/encode-policy'
import {
  normalizeMediaPurposeFilter,
  parseMediaTagFilter,
  serializeMediaTagFilter,
} from '@/core/media/library-query'
import { listMedia, listMediaTagOptions } from '@/core/media/resolve'
import { loadMediaPipelineRules } from '@/core/media/settings-store'
import { getMediaStorageInfo } from '@/core/media/storage'

import { MediaAdminNav } from './media-admin-nav'
import { MediaLibraryClient, type MediaLibraryView } from './media-library'

export const metadata = {
  title: 'Media library — Starforge',
  description:
    'Starforge media library around Payload Media (nested folders, tags, resize, WebP).',
}

type Search = Promise<{
  category?: string
  folder?: string
  purpose?: string
  tag?: string
  tagMode?: string
  q?: string
  view?: string
}>

function normalizeView(raw: string | undefined): MediaLibraryView {
  return raw === 'list' ? 'list' : 'mosaic'
}

/** product:media library admin page (M5 — lives in the module pack). */
export default async function MediaLibraryPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams
  // Prefer nested category; accept legacy ?folder= as fallback browse key via slug match below.
  let category = (params.category ?? 'all').trim() || 'all'
  const legacyFolder = (params.folder ?? '').trim()
  const purpose = normalizeMediaPurposeFilter(params.purpose)
  const tagFilter = parseMediaTagFilter(params.tag, params.tagMode)
  const tagSerialized = serializeMediaTagFilter(tagFilter)
  const tag = tagSerialized.tag ?? 'all'
  const tagMode = tagFilter.mode
  const q = (params.q ?? '').trim()
  const view = normalizeView(params.view)

  const storage = getMediaStorageInfo()
  const analysisAdapters = getMediaAnalysisPort()
    .list()
    .map((a) => a.id)
  const [pipeline, encodePolicy] = await Promise.all([
    loadMediaPipelineRules(),
    getMediaEncodePolicy(),
  ])
  const maxEdge = Math.max(pipeline.rules.maxWidth, pipeline.rules.maxHeight)
  let docs: Awaited<ReturnType<typeof listMedia>>['docs'] = []
  let totalDocs = 0
  let listError: string | null = null
  const tagOptions = await listMediaTagOptions()

  let categoryTree: Awaited<ReturnType<typeof listMediaCategoryTree>> = []
  try {
    await ensureLegacyCategoryRoots()
    categoryTree = await listMediaCategoryTree()
  } catch {
    categoryTree = []
  }

  if (category === 'all' && legacyFolder && legacyFolder !== 'all') {
    const flat: typeof categoryTree = []
    const walk = (nodes: typeof categoryTree) => {
      for (const n of nodes) {
        flat.push(n)
        if (n.children.length) walk(n.children)
      }
    }
    walk(categoryTree)
    const hit = flat.find((n) => n.slug === legacyFolder)
    if (hit) category = hit.id
  }

  try {
    const result = await listMedia({
      category: category === 'all' ? undefined : category,
      purpose: purpose === 'all' ? undefined : purpose,
      tag: tag === 'all' ? undefined : tag,
      tagMode,
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
      <MediaAdminNav active="library" />
      <h2>Media library</h2>
      <p className="lede admin-lede">
        Single Payload media library with nested folders, tags, max size, WebP for photos, and PNG
        logos. Bind from Logo, Styles, and Forms via the media picker — raw URL is fallback only.
        Pipeline rules: <Link href="/admin/media/settings">Media → Settings</Link>. Manage tags
        in <Link href="/cms/admin/collections/tags">CMS → Tags</Link>; categories in{' '}
        <Link href="/cms/admin/collections/categories">CMS → Categories</Link>; full CMS edit:{' '}
        <Link href="/cms/admin/collections/media">CMS → Media</Link>.
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
        category={category}
        purpose={purpose}
        tag={tag}
        tagMode={tagMode}
        q={q}
        view={view}
        tagOptions={tagOptions}
        categoryTree={categoryTree}
        analysisAdapters={analysisAdapters}
        maxEdge={maxEdge}
        canChooseDecode={encodePolicy.canChooseDecode}
        canChooseResize={encodePolicy.canChooseResize}
      />
    </section>
  )
}
