'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { deletePageAction, type PagesAdminActionState } from '../actions'
import { PAGE_LIST_LIMITS, type PageListLimit, type PageListSort, type PageStatus } from '../types'

type Row = {
  id: string
  title: string
  slug: string
  status: PageStatus
  categoryTitle: string
  createdAt: string
  publishedAt: string
  creatorName: string
  publisherName: string
  updatedAt: string
}

type TagOption = { id: string; title: string }
type CategoryOption = { id: string; title: string }

type Chrome = {
  addPage: string
  searchLabel: string
  searchButton: string
  sortLabel: string
  sortUpdated: string
  sortTitle: string
  sortSlug: string
  sortStatus: string
  sortCreated: string
  sortPublished: string
  filterStatus: string
  filterTag: string
  filterCategory: string
  filterUpdated: string
  filterAny: string
  filter7: string
  filter30: string
  filter90: string
  filterLimit: string
  colTitle: string
  colSlug: string
  colCategory: string
  colStatus: string
  colCreated: string
  colPublished: string
  colCreator: string
  colPublisher: string
  colUpdated: string
  emptyList: string
  statusDraft: string
  statusPublished: string
  statusUnpublished: string
  metaUnknown: string
  categoryNone: string
  edit: string
  delete: string
  confirmDelete: string
  pagePrev: string
  pageNext: string
  pageStatus: string
  resultsStatus: string
}

const initial: PagesAdminActionState = {}

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

function statusLabel(status: PageStatus, chrome: Chrome): string {
  if (status === 'published') return chrome.statusPublished
  if (status === 'unpublished') return chrome.statusUnpublished
  return chrome.statusDraft
}

function DeleteButton({
  id,
  label,
  confirm,
}: {
  id: string
  label: string
  confirm: string
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(deletePageAction, initial)
  useNotifySavedOnOk(state, { successMessage: state.message })
  React.useEffect(() => {
    if (state.deleted) router.push('/admin/pages')
  }, [state.deleted, router])

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="gantry-toolbar-btn" type="submit" disabled={pending}>
        {label}
      </button>
    </form>
  )
}

function listHref(input: {
  q: string
  sort: PageListSort
  dir: 'asc' | 'desc'
  status: string
  tagId: string
  categoryId: string
  updatedWithin: string
  limit: PageListLimit
  page: number
}): string {
  const params = new URLSearchParams()
  if (input.q) params.set('q', input.q)
  if (input.status) params.set('status', input.status)
  if (input.categoryId) params.set('category', input.categoryId)
  if (input.tagId) params.set('tag', input.tagId)
  if (input.updatedWithin) params.set('updated', input.updatedWithin)
  if (input.sort !== 'updated') params.set('sort', input.sort)
  if (input.dir !== 'desc') params.set('dir', input.dir)
  if (input.limit !== 20) params.set('limit', String(input.limit))
  if (input.page > 1) params.set('page', String(input.page))
  const qs = params.toString()
  return qs ? `/admin/pages?${qs}` : '/admin/pages'
}

export function PagesList({
  rows,
  q,
  sort,
  dir,
  status,
  tagId,
  categoryId,
  updatedWithin,
  limit,
  page,
  total,
  totalPages,
  tags,
  categories,
  chrome,
}: {
  rows: Row[]
  q: string
  sort: PageListSort
  dir: 'asc' | 'desc'
  status: string
  tagId: string
  categoryId: string
  updatedWithin: string
  limit: PageListLimit
  page: number
  total: number
  totalPages: number
  tags: TagOption[]
  categories: CategoryOption[]
  chrome: Chrome
}) {
  const rangeFrom = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeTo = total === 0 ? 0 : (page - 1) * limit + rows.length
  const filterState = {
    q,
    sort,
    dir,
    status,
    tagId,
    categoryId,
    updatedWithin,
    limit,
  }

  return (
    <div className="sf-pages-list-main">
      <form method="get" className="admin-inline-actions sf-pages-list-filters">
        <label className="settings-field">
          <span>{chrome.searchLabel}</span>
          <input type="search" name="q" defaultValue={q} />
        </label>
        <label className="settings-field">
          <span>{chrome.filterStatus}</span>
          <select name="status" defaultValue={status}>
            <option value="">{chrome.filterAny}</option>
            <option value="draft">{chrome.statusDraft}</option>
            <option value="published">{chrome.statusPublished}</option>
            <option value="unpublished">{chrome.statusUnpublished}</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{chrome.filterCategory}</span>
          <select name="category" defaultValue={categoryId}>
            <option value="">{chrome.filterAny}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>{chrome.filterTag}</span>
          <select name="tag" defaultValue={tagId}>
            <option value="">{chrome.filterAny}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.title}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>{chrome.filterUpdated}</span>
          <select name="updated" defaultValue={updatedWithin}>
            <option value="">{chrome.filterAny}</option>
            <option value="7">{chrome.filter7}</option>
            <option value="30">{chrome.filter30}</option>
            <option value="90">{chrome.filter90}</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{chrome.sortLabel}</span>
          <select name="sort" defaultValue={sort}>
            <option value="updated">{chrome.sortUpdated}</option>
            <option value="title">{chrome.sortTitle}</option>
            <option value="slug">{chrome.sortSlug}</option>
            <option value="status">{chrome.sortStatus}</option>
            <option value="created">{chrome.sortCreated}</option>
            <option value="published">{chrome.sortPublished}</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{'\u00a0'}</span>
          <select name="dir" defaultValue={dir} aria-label={chrome.sortLabel}>
            <option value="desc">↓</option>
            <option value="asc">↑</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{chrome.filterLimit}</span>
          <select name="limit" defaultValue={String(limit)}>
            {PAGE_LIST_LIMITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="page" value="1" />
        <button className="gantry-toolbar-btn" type="submit">
          {chrome.searchButton}
        </button>
        <Link className="gantry-toolbar-btn gantry-toolbar-btn-save" href="/admin/pages/new">
          {chrome.addPage}
        </Link>
      </form>

      <p className="settings-hint sf-pages-list-count" role="status">
        {chrome.resultsStatus
          .replace('{from}', String(rangeFrom))
          .replace('{to}', String(rangeTo))
          .replace('{total}', String(total))}
      </p>

      {rows.length === 0 ? (
        <p className="settings-hint">{chrome.emptyList}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{chrome.colTitle}</th>
                <th>{chrome.colSlug}</th>
                <th>{chrome.colCategory}</th>
                <th>{chrome.colStatus}</th>
                <th>{chrome.colCreated}</th>
                <th>{chrome.colPublished}</th>
                <th>{chrome.colCreator}</th>
                <th>{chrome.colPublisher}</th>
                <th>{chrome.colUpdated}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/pages/${row.id}`}>{row.title}</Link>
                  </td>
                  <td>
                    <code>{row.slug}</code>
                  </td>
                  <td>{row.categoryTitle || chrome.categoryNone}</td>
                  <td>{statusLabel(row.status, chrome)}</td>
                  <td suppressHydrationWarning>{formatUpdated(row.createdAt)}</td>
                  <td suppressHydrationWarning>
                    {row.publishedAt ? formatUpdated(row.publishedAt) : chrome.metaUnknown}
                  </td>
                  <td>{row.creatorName || chrome.metaUnknown}</td>
                  <td>{row.publisherName || chrome.metaUnknown}</td>
                  <td suppressHydrationWarning>{formatUpdated(row.updatedAt)}</td>
                  <td>
                    <div className="admin-inline-actions">
                      <Link className="gantry-toolbar-btn" href={`/admin/pages/${row.id}`}>
                        {chrome.edit}
                      </Link>
                      <DeleteButton
                        id={row.id}
                        label={chrome.delete}
                        confirm={chrome.confirmDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="sf-media-library-pager" role="navigation" aria-label="Pages">
          <Link
            className={`gantry-toolbar-btn gantry-toolbar-btn-muted${page <= 1 ? ' is-disabled' : ''}`}
            href={listHref({ ...filterState, page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            onClick={(event) => {
              if (page <= 1) event.preventDefault()
            }}
          >
            {chrome.pagePrev}
          </Link>
          <span className="layout-muted">
            {chrome.pageStatus
              .replace('{page}', String(page))
              .replace('{pages}', String(totalPages))}
          </span>
          <Link
            className={`gantry-toolbar-btn gantry-toolbar-btn-muted${page >= totalPages ? ' is-disabled' : ''}`}
            href={listHref({ ...filterState, page: Math.min(totalPages, page + 1) })}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            onClick={(event) => {
              if (page >= totalPages) event.preventDefault()
            }}
          >
            {chrome.pageNext}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
