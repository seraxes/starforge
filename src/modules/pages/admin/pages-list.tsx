'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { deletePageAction, type PagesAdminActionState } from '../actions'
import type { PageListSort } from '../types'

type Row = {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  updatedAt: string
}

type TagOption = { id: string; title: string }

type Chrome = {
  addPage: string
  searchLabel: string
  searchButton: string
  sortLabel: string
  sortUpdated: string
  sortTitle: string
  sortSlug: string
  sortStatus: string
  filterStatus: string
  filterTag: string
  filterUpdated: string
  filterAny: string
  filter7: string
  filter30: string
  filter90: string
  colTitle: string
  colSlug: string
  colStatus: string
  colUpdated: string
  emptyList: string
  statusDraft: string
  statusPublished: string
  edit: string
  delete: string
  confirmDelete: string
}

const initial: PagesAdminActionState = {}

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
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

export function PagesList({
  rows,
  q,
  sort,
  dir,
  status,
  tagId,
  updatedWithin,
  tags,
  chrome,
}: {
  rows: Row[]
  q: string
  sort: PageListSort
  dir: 'asc' | 'desc'
  status: string
  tagId: string
  updatedWithin: string
  tags: TagOption[]
  chrome: Chrome
}) {
  return (
    <>
      <form method="get" className="admin-inline-actions">
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
          </select>
        </label>
        <label className="settings-field">
          <span> </span>
          <select name="dir" defaultValue={dir}>
            <option value="desc">↓</option>
            <option value="asc">↑</option>
          </select>
        </label>
        <button className="gantry-toolbar-btn" type="submit">
          {chrome.searchButton}
        </button>
        <Link className="gantry-toolbar-btn gantry-toolbar-btn-save" href="/admin/pages/new">
          {chrome.addPage}
        </Link>
      </form>

      {rows.length === 0 ? (
        <p className="settings-hint">{chrome.emptyList}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{chrome.colTitle}</th>
                <th>{chrome.colSlug}</th>
                <th>{chrome.colStatus}</th>
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
                  <td>{row.status === 'published' ? chrome.statusPublished : chrome.statusDraft}</td>
                  <td>{formatUpdated(row.updatedAt)}</td>
                  <td>
                    <div className="admin-inline-actions">
                      <Link className="gantry-toolbar-btn" href={`/admin/pages/${row.id}`}>
                        {chrome.edit}
                      </Link>
                      <DeleteButton id={row.id} label={chrome.delete} confirm={chrome.confirmDelete} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
