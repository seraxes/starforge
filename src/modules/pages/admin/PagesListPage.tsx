import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPageTags, listPages } from '../store'
import type { PageListSort, PageStatus } from '../types'
import { PagesList } from './pages-list'
import { PagesTagsPanel } from './pages-tags-panel'

export const metadata = {
  title: 'Pages — Starforge',
  description: 'Brochure pages (Pages module).',
}

type Search = Promise<{
  q?: string
  sort?: string
  dir?: string
  status?: string
  tag?: string
  updated?: string
}>

function asSort(raw: string | undefined): PageListSort {
  if (raw === 'title' || raw === 'slug' || raw === 'status' || raw === 'updated') return raw
  return 'updated'
}

function asStatus(raw: string | undefined): PageStatus | '' {
  if (raw === 'draft' || raw === 'published') return raw
  return ''
}

function asUpdatedDays(raw: string | undefined): number | null {
  if (raw === '7' || raw === '30' || raw === '90') return Number(raw)
  return null
}

/** product:pages list. */
export default async function PagesListPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pages)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const q = (params.q ?? '').trim()
  const sort = asSort(params.sort)
  const dir = params.dir === 'asc' ? 'asc' : 'desc'
  const status = asStatus(params.status)
  const tagId = (params.tag ?? '').trim()
  const updatedWithinDays = asUpdatedDays(params.updated)
  const t = await getTranslations('product:pages')

  let error = ''
  let rows: Awaited<ReturnType<typeof listPages>> = []
  let tags: Awaited<ReturnType<typeof listPageTags>> = []
  try {
    ;[rows, tags] = await Promise.all([
      listPages({ q, sort, dir, status, tagId, updatedWithinDays }),
      listPageTags(),
    ])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not load pages.'
  }

  return (
    <section className="admin-section admin-layouts-full">
      <h2>{t('listHeading')}</h2>
      <p className="lede admin-lede">
        {t('listLede')}{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : (
        <PagesList
          rows={rows.map((row) => ({
            id: row.id,
            title: row.title || row.slug,
            slug: row.slug,
            status: row.status,
            updatedAt: row.updatedAt.toISOString(),
          }))}
          q={q}
          sort={sort}
          dir={dir}
          status={status}
          tagId={tagId}
          updatedWithin={updatedWithinDays ? String(updatedWithinDays) : ''}
          tags={tags.map((tag) => ({ id: tag.id, title: tag.title }))}
          chrome={{
            addPage: t('addPage'),
            searchLabel: t('searchLabel'),
            searchButton: t('searchButton'),
            sortLabel: t('sortLabel'),
            sortUpdated: t('sortUpdated'),
            sortTitle: t('sortTitle'),
            sortSlug: t('sortSlug'),
            sortStatus: t('sortStatus'),
            filterStatus: t('filterStatus'),
            filterTag: t('filterTag'),
            filterUpdated: t('filterUpdated'),
            filterAny: t('filterAny'),
            filter7: t('filter7'),
            filter30: t('filter30'),
            filter90: t('filter90'),
            colTitle: t('colTitle'),
            colSlug: t('colSlug'),
            colStatus: t('colStatus'),
            colUpdated: t('colUpdated'),
            emptyList: t('emptyList'),
            statusDraft: t('statusDraft'),
            statusPublished: t('statusPublished'),
            edit: t('edit'),
            delete: t('delete'),
            confirmDelete: t('confirmDelete'),
          }}
        />
      )}
      {error ? null : (
        <PagesTagsPanel
          tags={tags.map((tag) => ({
            id: tag.id,
            title: tag.title,
            pageCount: tag.pageCount,
          }))}
          chrome={{
            tagsHeading: t('tagsHeading'),
            tagsLede: t('tagsLede'),
            tagTitle: t('tagTitle'),
            tagAdd: t('tagAdd'),
            tagRename: t('tagRename'),
            tagDelete: t('tagDelete'),
            tagConfirmDelete: t('tagConfirmDelete'),
            tagEmpty: t('tagEmpty'),
          }}
        />
      )}
    </section>
  )
}
