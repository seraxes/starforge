'use client'

import React, { useActionState, useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import { getAdminOverlayPortalTarget } from '@/components/admin/useFloatingSettingsPanel'

import {
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  testEmailSendAction,
  type EmailAdminActionState,
} from '../actions'
import { EmailTemplateFormFields } from './email-template-fields'

type TemplateRow = {
  id: string
  label: string
  moduleCategory: string
  subject: string
  bodyText: string
  bodyHtml: string
  updatedAt: string
}

type Props = {
  category: string
  categories: string[]
  templates: TemplateRow[]
  mailerEnabled: boolean
  mailerLabel: string
  /** product:rich-editor gate — Email Manager requires it for HTML bodies. */
  richEditorEnabled: boolean
}

const initial: EmailAdminActionState = {}

function Feedback({ state }: { state: EmailAdminActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

function FormDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const titleId = useId()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(getAdminOverlayPortalTarget())
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!portalTarget) return null

  return createPortal(
    <div
      className="sf-admin-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sf-admin-confirm-dialog sf-admin-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-admin-confirm-head">
          <h3 id={titleId}>{title}</h3>
        </header>
        {children}
      </div>
    </div>,
    portalTarget,
  )
}

function TestSendDialog({
  mailerEnabled,
  mailerLabel,
  onClose,
}: {
  mailerEnabled: boolean
  mailerLabel: string
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(testEmailSendAction, initial)
  useNotifySavedOnOk(state)

  return (
    <FormDialog title="Test send" onClose={onClose}>
      <form action={action} className="sf-admin-form-dialog-body">
        <p className="settings-hint">
          Uses platform Mailer ({mailerLabel}
          {!mailerEnabled ? ' — disabled in Chrome' : ''}). Console provider logs only; SMTP /
          Resend soft-fail when secrets are missing.
        </p>
        <label className="settings-field">
          <span>To</span>
          <input type="email" name="to" required autoComplete="off" disabled={pending} />
        </label>
        <label className="settings-field">
          <span>Subject</span>
          <input
            type="text"
            name="subject"
            defaultValue="Starforge Email Manager test"
            maxLength={500}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Body</span>
          <textarea
            name="text"
            rows={3}
            defaultValue="Test message from Email Manager."
            disabled={pending}
          />
        </label>
        <Feedback state={state} />
        <div className="page-settings-actions sf-events-form-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </form>
    </FormDialog>
  )
}

export function EmailTemplatesManager({
  category,
  categories,
  templates,
  mailerEnabled,
  mailerLabel,
  richEditorEnabled,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null)

  const [createState, createAction, createPending] = useActionState(
    createEmailTemplateAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailTemplateAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (!createState.ok || !createState.id) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.push(`/admin/email/templates/${createState.id}`)
  }, [createState, router])

  useEffect(() => {
    if (!deleteState.ok) return
    setDeleteTarget(null)
    router.refresh()
  }, [deleteState.ok, router])

  const busy = createPending || deletePending
  const createFormId = 'sf-email-template-create-form'

  return (
    <div className="sf-email-templates-manager">
      <div className={`sf-email-templates-add-panel${createOpen ? ' is-open' : ''}`}>
        <section className="outlines-create sf-events-add-panel" aria-label="Add template">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              aria-expanded={createOpen}
              aria-controls={createFormId}
              onClick={() => setCreateOpen((open) => !open)}
            >
              {createOpen ? 'Close' : 'Add +'}
            </button>
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setTestOpen(true)}
            >
              Test send
            </button>
            {!createOpen ? (
              <p className="settings-hint sf-events-add-hint">
                Add opens the full template form. Edit opens a dedicated page. Test send uses{' '}
                {mailerLabel}
                {!mailerEnabled ? ' (disabled in Chrome)' : ''}.
              </p>
            ) : null}
          </div>
        </section>

        {createOpen ? (
          <div className="sf-email-template-create sf-events-form-mosaic">
            <form
              key={formKey}
              id={createFormId}
              action={createAction}
              aria-label="Create template"
              className="sf-events-form-mosaic-form"
            >
              <EmailTemplateFormFields
                categories={categories}
                defaultCategory={category === 'all' ? 'forms' : category}
                busy={busy}
                richEditorEnabled={richEditorEnabled}
              />
            </form>
            <Feedback state={createState} />
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={createFormId}
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={busy}
              >
                {createPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <section className="outlines-create" aria-label="Filter templates">
        <h3>Filter</h3>
        <div className="sf-events-filters" role="group" aria-label="Module category">
          <Link
            href="/admin/email/templates"
            className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
              category === 'all' ? ' is-active' : ''
            }`}
            aria-current={category === 'all' ? 'true' : undefined}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/admin/email/templates?category=${encodeURIComponent(cat)}`}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                category === cat ? ' is-active' : ''
              }`}
              aria-current={category === cat ? 'true' : undefined}
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <Feedback state={deleteState} />

      <section
        className="outlines-create"
        aria-label={`Templates list${category !== 'all' ? ` — ${category}` : ''}`}
      >
        <h3>Templates</h3>
        <div className="outlines-table-wrap">
          <table className="outlines-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Module</th>
                <th scope="col">Subject</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    No templates yet. Use Add +, or seed Forms starters from{' '}
                    <Link href="/admin/email">Rules</Link>.
                  </td>
                </tr>
              ) : (
                templates.map((tpl) => (
                  <tr key={tpl.id}>
                    <td>
                      <strong>{tpl.label}</strong>
                    </td>
                    <td>{tpl.moduleCategory}</td>
                    <td>{tpl.subject}</td>
                    <td>{formatUpdated(tpl.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <Link
                          href={`/admin/email/templates/${encodeURIComponent(tpl.id)}`}
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                          disabled={busy}
                          onClick={() => setDeleteTarget(tpl)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {testOpen ? (
        <TestSendDialog
          mailerEnabled={mailerEnabled}
          mailerLabel={mailerLabel}
          onClose={() => setTestOpen(false)}
        />
      ) : null}

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete template"
        message={
          deleteTarget
            ? `Delete template “${deleteTarget.label}”? Rules that point at it will fail until retargeted.`
            : ''
        }
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget || deletePending) return
          const id = deleteTarget.id
          setDeleteTarget(null)
          const data = new FormData()
          data.set('id', id)
          void deleteAction(data)
        }}
      />
    </div>
  )
}
