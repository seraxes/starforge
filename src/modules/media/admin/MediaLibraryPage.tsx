import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { getMediaAnalysisPort } from '@/core/media/analysis'
import { ensureLegacyCategoryRoots, listMediaCategoryTree } from '@/core/media/category-store'
import { getMediaEncodePolicy } from '@/core/media/encode-policy'
import {
  normalizeMediaPurposeFilter,
  parseMediaTagFilter,
  serializeMediaTagFilter,
} from '@/core/media/library-query'
import { MEDIA_LIBRARY_PAGE_SIZE } from '@/core/media/library-files'
import { listMedia, listMediaTagOptions } from '@/core/media/resolve'
import { loadMediaPipelineRules } from '@/core/media/settings-store'
import { syncMediaCategoryFolders } from '@/core/media/place-asset'
import { getMediaStorageInfo } from '@/core/media/storage'

import { MediaAdminNav } from './media-admin-nav'
import { buildMediaLibraryChrome } from './media-chrome'
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
  page?: string
}>

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), 10000)
}

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
  let page = parsePage(params.page)

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
  let totalPages = 1
  let listError: string | null = null
  const tagOptions = await listMediaTagOptions()

  try {
    await syncMediaCategoryFolders()
  } catch {
    // The list still loads. A later open files anything this pass missed.
  }

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
    const query = {
      category: category === 'all' ? undefined : category,
      purpose: purpose === 'all' ? undefined : purpose,
      tag: tag === 'all' ? undefined : tag,
      tagMode,
      q: q || undefined,
      limit: MEDIA_LIBRARY_PAGE_SIZE,
      page,
    }
    let result = await listMedia(query)
    if (result.totalPages > 0 && page > result.totalPages) {
      page = result.totalPages
      result = await listMedia({ ...query, page })
    }
    docs = result.docs
    totalDocs = result.totalDocs
    totalPages = result.totalPages || 1
    page = result.page || page
  } catch (err) {
    listError = err instanceof Error ? err.message : 'Failed to load media.'
  }

  const t = await getTranslations('product:media')
  const chrome = buildMediaLibraryChrome(
    (key, values) => (values ? t(key, values) : t(key)),
    { maxEdge },
  )

  return (
    <section className="admin-section admin-layouts-full">
      <MediaAdminNav active="library" />
      <h2>Media library</h2>
      <p className="lede admin-lede">
        {chrome.libraryLede} <Link href="/admin/media/settings">{chrome.settingsLink}</Link>.
      </p>
      <p className="layout-muted">
        {storage.kind === 'local' ? chrome.folderHintLocal : chrome.folderHintS3}
      </p>
      {listError ? (
        <p className="form-error" role="alert">
          {listError}
        </p>
      ) : null}
      <MediaLibraryClient
        initialDocs={docs}
        totalDocs={totalDocs}
        page={page}
        totalPages={totalPages}
        pageSize={MEDIA_LIBRARY_PAGE_SIZE}
        chrome={chrome}
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
