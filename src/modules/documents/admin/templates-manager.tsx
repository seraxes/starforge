'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createDocumentTemplateAction,
  updateDocumentTemplateAction,
  type DocumentsAdminActionState,
} from '../actions'
import { DOCUMENT_SUBJECT_KINDS } from '../links-rules'
import type { DocumentTemplateRecord } from '../render-rules'

const initial: DocumentsAdminActionState = {}

const SUBJECT_LABELS: Record<(typeof DOCUMENT_SUBJECT_KINDS)[number], string> = {
  user: 'User',
  onboarding: 'Onboarding',
  fleet_vehicle: 'Fleet vehicle',
}

const RENDER_SOURCE_OPTIONS = ['values-pdf'] as const

type Props = {
  templates: DocumentTemplateRecord[]
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

function TemplateEditCard({ row }: { row: DocumentTemplateRecord }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateDocumentTemplateAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  // Controlled so a successful useActionState reset cannot snap selects back.
  const [title, setTitle] = useState(row.title)
  const [subjectKind, setSubjectKind] = useState(row.subjectKind)
  const [renderSource, setRenderSource] = useState(row.renderSource)
  const [enabled, setEnabled] = useState(row.enabled)

  useEffect(() => {
    setTitle(row.title)
    setSubjectKind(row.subjectKind)
    setRenderSource(row.renderSource)
    setEnabled(row.enabled)
  }, [row.title, row.subjectKind, row.renderSource, row.enabled])

  const renderOptions = Array.from(
    new Set<string>([...RENDER_SOURCE_OPTIONS, renderSource].filter(Boolean)),
  )

  return (
    <section className="page-settings-panel" key={templateRemountKey(row)}>
      <header className="page-settings-panel-head">
        <h3>{row.title || row.id}</h3>
      </header>
      <div className="page-settings-panel-body">
        <form action={formAction} className="sf-events-form-mosaic-form">
          <input type="hidden" name="id" value={row.id} />
          <label className="settings-field">
            <span>Id</span>
            <input type="text" value={row.id} disabled readOnly />
            <span className="settings-hint">Stable key for render callers.</span>
          </label>
          <label className="settings-field">
            <span>Title</span>
            <input
              type="text"
              name="title"
              value={title}
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
              onChange={(event) =>
                setSubjectKind(event.target.value as (typeof DOCUMENT_SUBJECT_KINDS)[number])
              }
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
          <Feedback state={state} />
          <div className="page-settings-actions admin-action-row">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
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

  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [subjectKind, setSubjectKind] =
    useState<(typeof DOCUMENT_SUBJECT_KINDS)[number]>('onboarding')
  const [renderSource, setRenderSource] = useState<string>(RENDER_SOURCE_OPTIONS[0])
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((key) => key + 1)
    setId('')
    setTitle('')
    setSubjectKind('onboarding')
    setRenderSource(RENDER_SOURCE_OPTIONS[0])
    setEnabled(true)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-documents-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add template">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-documents-add-template-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add template +'}
          </button>
        </div>
        {createOpen ? (
          <form
            key={formKey}
            id="sf-documents-add-template-form"
            action={formAction}
            className="sf-events-form-mosaic-form"
          >
            <label className="settings-field">
              <span>Id</span>
              <input
                type="text"
                name="id"
                value={id}
                required
                disabled={pending}
                autoComplete="off"
                placeholder="training-report"
                onChange={(event) => setId(event.target.value)}
              />
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
                onChange={(event) =>
                  setSubjectKind(event.target.value as (typeof DOCUMENT_SUBJECT_KINDS)[number])
                }
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
                {RENDER_SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
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
            <Feedback state={state} />
            <div className="page-settings-actions admin-action-row">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={pending}
              >
                {pending ? 'Creating…' : 'Create template'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}

/** Staff templates list + create (Events / Page Settings chrome). */
export function DocumentsTemplatesManager({ templates }: Props) {
  return (
    <div className="sf-documents-templates">
      <AddTemplatePanel />
      <div className="admin-settings-mosaic" style={{ marginTop: '1rem' }}>
        {templates.length === 0 ? (
          <p className="layout-muted">No templates yet. Add one to render into Media.</p>
        ) : (
          templates.map((row) => <TemplateEditCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  )
}
