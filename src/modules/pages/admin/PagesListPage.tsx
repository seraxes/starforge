import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPageCategories } from '../categories'
import { listPageTags, listPages, listUserDisplayNames } from '../store'
import { isPageListLimit, type PageListLimit, type PageListSort, type PageStatus } from '../types'
import { PagesAdminNav } from './pages-admin-nav'
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
  category?: string
  updated?: string
  page?: string
  limit?: string
}>

function asSort(raw: string | undefined): PageListSort {
  if (
    raw === 'title' ||
    raw === 'slug' ||
    raw === 'status' ||
    raw === 'updated' ||
    raw === 'created' ||
    raw === 'published'
  ) {
    return raw
  }
  return 'updated'
}

function asStatus(raw: string | undefined): PageStatus | '' {
  if (raw === 'draft' || raw === 'published' || raw === 'unpublished') return raw
  return ''
}

function asUpdatedDays(raw: string | undefined): number | null {
  if (raw === '7' || raw === '30' || raw === '90') return Number(raw)
  return null
}

function asLimit(raw: string | undefined): PageListLimit {
  const n = Number(raw)
  return isPageListLimit(n) ? n : 20
}

function asPage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.trunc(n)
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
  const categoryId = (params.category ?? '').trim()
  const updatedWithinDays = asUpdatedDays(params.updated)
  const limit = asLimit(params.limit)
  const page = asPage(params.page)
  const t = await getTranslations('product:pages')

  let error = ''
  let list: Awaited<ReturnType<typeof listPages>> = {
    rows: [],
    total: 0,
    page: 1,
    limit,
    totalPages: 1,
  }
  let tags: Awaited<ReturnType<typeof listPageTags>> = []
  let categories: Awaited<ReturnType<typeof listPageCategories>> = []
  try {
    ;[list, tags, categories] = await Promise.all([
      listPages({ q, sort, dir, status, tagId, categoryId, updatedWithinDays, page, limit }),
      listPageTags(),
      listPageCategories(),
    ])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not load pages.'
  }

  const categoryTitleById = new Map(categories.map((category) => [category.id, category.title]))
  const names = error
    ? new Map<string, string>()
    : await listUserDisplayNames(
        list.rows.flatMap((row) => [row.createdByUserId, row.publishedByUserId]),
      )

  return (
    <section className="admin-section admin-layouts-full">
      <PagesAdminNav
        active="pages"
        chrome={{
          pages: t('navPages'),
          categories: t('navCategories'),
          pagesTitle: t('navPagesTitle'),
          categoriesTitle: t('navCategoriesTitle'),
        }}
      />
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
        <div className="sf-pages-list-layout">
          <PagesList
            rows={list.rows.map((row) => ({
              id: row.id,
              title: row.title || row.slug,
              slug: row.slug,
              status: row.status,
              categoryTitle: categoryTitleById.get(row.categoryId) ?? '',
              createdAt: row.createdAt.toISOString(),
              publishedAt: row.publishedAt ? row.publishedAt.toISOString() : '',
              creatorName: names.get(row.createdByUserId) ?? '',
              publisherName: names.get(row.publishedByUserId) ?? '',
              updatedAt: row.updatedAt.toISOString(),
            }))}
            q={q}
            sort={sort}
            dir={dir}
            status={status}
            tagId={tagId}
            categoryId={categoryId}
            updatedWithin={updatedWithinDays ? String(updatedWithinDays) : ''}
            limit={list.limit}
            page={list.page}
            total={list.total}
            totalPages={list.totalPages}
            tags={tags.map((tag) => ({ id: tag.id, title: tag.title }))}
            categories={categories.map((category) => ({
              id: category.id,
              title: category.title,
            }))}
            chrome={{
              addPage: t('addPage'),
              searchLabel: t('searchLabel'),
              searchButton: t('searchButton'),
              sortLabel: t('sortLabel'),
              sortUpdated: t('sortUpdated'),
              sortTitle: t('sortTitle'),
              sortSlug: t('sortSlug'),
              sortStatus: t('sortStatus'),
              sortCreated: t('sortCreated'),
              sortPublished: t('sortPublished'),
              filterStatus: t('filterStatus'),
              filterTag: t('filterTag'),
              filterCategory: t('filterCategory'),
              filterUpdated: t('filterUpdated'),
              filterAny: t('filterAny'),
              filter7: t('filter7'),
              filter30: t('filter30'),
              filter90: t('filter90'),
              filterLimit: t('filterLimit'),
              colTitle: t('colTitle'),
              colSlug: t('colSlug'),
              colCategory: t('colCategory'),
              colStatus: t('colStatus'),
              colCreated: t('colCreated'),
              colPublished: t('colPublished'),
              colCreator: t('colCreator'),
              colPublisher: t('colPublisher'),
              colUpdated: t('colUpdated'),
              emptyList: t('emptyList'),
              statusDraft: t('statusDraft'),
              statusPublished: t('statusPublished'),
              statusUnpublished: t('statusUnpublished'),
              metaUnknown: t('metaUnknown'),
              categoryNone: t('categoryNone'),
              edit: t('edit'),
              delete: t('delete'),
              confirmDelete: t('confirmDelete'),
              pagePrev: t('pagePrev'),
              pageNext: t('pageNext'),
              pageStatus: t('pageStatus'),
              resultsStatus: t('resultsStatus'),
            }}
          />
          <aside className="sf-pages-list-side">
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
                tagCancel: t('tagCancel'),
                tagConfirmDelete: t('tagConfirmDelete'),
                tagEmpty: t('tagEmpty'),
              }}
            />
          </aside>
        </div>
      )}
    </section>
  )
}
