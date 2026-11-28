'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createDocumentTemplateAction,
  updateDocumentTemplateAction,
  type DocumentsAdminActionState,
} from '../actions'
import { DOCUMENT_SUBJECT_KINDS, type DocumentSubjectKind } from '../links-rules'
import type { DocumentTemplateRecord } from '../render-rules'
import { DocumentsSubjectLinksPanel } from './subject-links-panel'
import type { DocumentLinkRecord } from '../links'

const initial: DocumentsAdminActionState = {}

const SUBJECT_LABELS: Record<DocumentSubjectKind, string> = {
  user: 'User',
  onboarding: 'Onboarding',
  fleet_vehicle: 'Fleet vehicle',
}

const RENDER_SOURCE_OPTIONS = ['values-pdf'] as const

type StatusFilter = 'all' | 'enabled' | 'disabled'
type TemplateSort = 'title' | 'newest'

type SubjectFiles = {
  subjectKind: DocumentSubjectKind
  subjectId: string
  links: DocumentLinkRecord[]
}

type Props = {
  templates: DocumentTemplateRecord[]
  initialSubjectKind?: DocumentSubjectKind | ''
  subjectFiles?: SubjectFiles | null
}

function timeMs(value: Date | string | undefined): number {
  if (!value) return 0
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function Feedback({ state }: { state: DocumentsAdminActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message || 'Saved.'}
      </p>
    )
  }
  return null
}

function templateRemountKey(row: DocumentTemplateRecord): string {
  return [row.id, row.title, row.subjectKind, row.renderSource, row.enabled ? 1 : 0].join(':')
}

function TemplateFields({
  row,
  pending,
}: {
  row?: DocumentTemplateRecord
  pending: boolean
}) {
  const [id, setId] = useState(row?.id ?? '')
  const [title, setTitle] = useState(row?.title ?? '')
  const [subjectKind, setSubjectKind] = useState<DocumentSubjectKind>(row?.subjectKind ?? 'onboarding')
  const [renderSource, setRenderSource] = useState(row?.renderSource || RENDER_SOURCE_OPTIONS[0])
  const [enabled, setEnabled] = useState(row?.enabled ?? true)

  useEffect(() => {
    setId(row?.id ?? '')
    setTitle(row?.title ?? '')
    setSubjectKind(row?.subjectKind ?? 'onboarding')
    setRenderSource(row?.renderSource || RENDER_SOURCE_OPTIONS[0])
    setEnabled(row?.enabled ?? true)
  }, [row?.id, row?.title, row?.subjectKind, row?.renderSource, row?.enabled])

  const renderOptions = Array.from(
    new Set<string>([...RENDER_SOURCE_OPTIONS, renderSource].filter(Boolean)),
  )

  return (
    <>
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <label className="settings-field">
        <span>Id</span>
        <input
          type="text"
          name="id"
          value={row ? row.id : id}
          required
          disabled={pending || Boolean(row)}
          readOnly={Boolean(row)}
          autoComplete="off"
          placeholder="training-report"
          onChange={(event) => setId(event.target.value)}
        />
        {row ? <span className="settings-hint">Stable key for render callers.</span> : null}
      </label>
      <label className="settings-field">
        <span>Title</span>
        <input
          type="text"
          name="title"
          value={title}
          required
          disabled={pending}
          autoComplete="off"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Subject kind</span>
        <select
          name="subjectKind"
          value={subjectKind}
          disabled={pending}
          onChange={(event) => setSubjectKind(event.target.value as DocumentSubjectKind)}
        >
          {DOCUMENT_SUBJECT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SUBJECT_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Render source</span>
        <select
          name="renderSource"
          value={renderSource}
          disabled={pending}
          onChange={(event) => setRenderSource(event.target.value)}
        >
          {renderOptions.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <span className="settings-hint">How this template builds the PDF. No file bytes here.</span>
      </label>
      <label className="settings-field settings-flag">
        <span>Enabled</span>
        <input
          type="checkbox"
          name="enabled"
          value="1"
          checked={enabled}
          disabled={pending}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>
    </>
  )
}

function TemplateEditCard({
  row,
  onClose,
}: {
  row: DocumentTemplateRecord
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateDocumentTemplateAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <section className="page-settings-panel" key={templateRemountKey(row)}>
      <header className="page-settings-panel-head">
        <h3>{row.title || row.id}</h3>
      </header>
      <div className="page-settings-panel-body">
        <form id={`sf-documents-edit-${row.id}`} action={formAction} className="sf-events-form-mosaic-form">
          <TemplateFields row={row} pending={pending} />
          <Feedback state={state} />
        </form>
        <div className="page-settings-actions admin-action-row">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pending}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="submit"
            form={`sf-documents-edit-${row.id}`}
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

function AddTemplatePanel() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, formAction, pending] = useActionState(createDocumentTemplateAction, initial)
  useNotifySavedOnOk(state)

  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((key) => key + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-subscriptions-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add template">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-documents-add-template-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Add a template. Media keeps the file. This list stores the template.
            </p>
          ) : null}
        </div>
      </section>
      {createOpen ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-documents-add-template-form"
            action={formAction}
            className="sf-events-form-mosaic-form"
            aria-label="Create template"
          >
            <TemplateFields pending={pending} />
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sf-documents-add-template-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Staff templates: Add +, filters, then a list. Edit opens one card under the list. */
export function DocumentsTemplatesManager({
  templates,
  initialSubjectKind = '',
  subjectFiles = null,
}: Props) {
  const [query, setQuery] = useState('')
  const [subjectKind, setSubjectKind] = useState<DocumentSubjectKind | ''>(initialSubjectKind)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<TemplateSort>('title')
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = templates.filter((row) => {
      if (subjectKind && row.subjectKind !== subjectKind) return false
      if (status === 'enabled' && !row.enabled) return false
      if (status === 'disabled' && row.enabled) return false
      if (!q) return true
      return row.title.toLowerCase().includes(q) || row.id.toLowerCase().includes(q)
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'newest') return timeMs(b.updatedAt) - timeMs(a.updatedAt) || a.title.localeCompare(b.title)
      return a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    })
  }, [templates, query, subjectKind, status, sort])

  const openRow = openId ? templates.find((row) => row.id === openId) ?? null : null

  return (
    <div className="sf-subscriptions-catalog">
      <AddTemplatePanel />

      <section className="outlines-create" aria-label="Filter templates">
        <h3>Filter</h3>
        <div className="sf-subscriptions-filterbar">
          <label className="settings-field">
            <span>Search</span>
            <input
              type="search"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Subject</span>
            <select
              value={subjectKind}
              onChange={(event) => setSubjectKind(event.target.value as DocumentSubjectKind | '')}
            >
              <option value="">All</option>
              {DOCUMENT_SUBJECT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {SUBJECT_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Order</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as TemplateSort)}>
              <option value="title">Title</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </section>

      {subjectFiles ? (
        <DocumentsSubjectLinksPanel
          subjectKind={subjectFiles.subjectKind}
          subjectId={subjectFiles.subjectId}
          links={subjectFiles.links}
        />
      ) : null}

      <section className="outlines-create" aria-label="Templates">
        <h3>Templates</h3>
        <p className="settings-hint sf-pages-list-count" role="status">
          {visible.length} of {templates.length}
        </p>
        {visible.length === 0 ? (
          <p className="admin-empty">
            {templates.length === 0
              ? 'No templates yet. Add one to render into Media.'
              : 'No templates match these filters.'}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Id</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Render source</th>
                  <th scope="col">Status</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="sf-pages-list-title-btn"
                        aria-expanded={openId === row.id}
                        onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
                      >
                        {row.title || row.id}
                      </button>
                    </td>
                    <td>
                      <code>{row.id}</code>
                    </td>
                    <td>{SUBJECT_LABELS[row.subjectKind]}</td>
                    <td>{row.renderSource || '—'}</td>
                    <td>{row.enabled ? 'Enabled' : 'Disabled'}</td>
                    <td>
                      <div className="admin-inline-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          aria-expanded={openId === row.id}
                          onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
                        >
                          {openId === row.id ? 'Close' : 'Edit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openRow ? (
        <TemplateEditCard key={templateRemountKey(openRow)} row={openRow} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  )
}
