'use client'

import React, { useActionState, useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import { getAdminOverlayPortalTarget } from '@/components/admin/useFloatingSettingsPanel'

import {
  deleteEmailTemplateAction,
  updateEmailTemplateAction,
  type EmailAdminActionState,
} from '../actions'
import {
  EmailTemplateFormFields,
  type EmailTemplateFormRow,
} from './email-template-fields'

type Props = {
  template: EmailTemplateFormRow & { id: string; updatedAt: string }
  categories: string[]
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

function DetailsDialog({
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

/**
 * Full-page template editor — Message + HTML on the mosaic; label/category in the
 * Details popup (Subscriptions form-dialog chrome).
 */
export function EmailTemplateEditor({ template, categories, richEditorEnabled }: Props) {
  const router = useRouter()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [identity, setIdentity] = useState({
    label: template.label ?? '',
    moduleCategory: template.moduleCategory ?? 'other',
  })
  const [draftIdentity, setDraftIdentity] = useState(identity)

  const [updateState, updateAction, updatePending] = useActionState(
    updateEmailTemplateAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailTemplateAction,
    initial,
  )

  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    const next = {
      label: template.label ?? '',
      moduleCategory: template.moduleCategory ?? 'other',
    }
    setIdentity(next)
    setDraftIdentity(next)
  }, [template.id, template.label, template.moduleCategory, template.updatedAt])

  useEffect(() => {
    if (deleteState.ok) {
      router.push('/admin/email/templates')
      return
    }
    if (updateState.ok) {
      if (updateState.after === 'save') {
        router.push('/admin/email/templates')
        return
      }
      router.refresh()
    }
  }, [updateState, deleteState, router])

  const busy = updatePending || deletePending
  const formId = `email-template-edit-${template.id}`
  const rowForFields: EmailTemplateFormRow = {
    ...template,
    label: identity.label,
    moduleCategory: identity.moduleCategory,
  }

  return (
    <div className="sf-email-template-editor sf-events-form-mosaic">
      <div className="sf-events-form-mosaic-intro settings-hint">
        <strong>Apply</strong> saves and stays · <strong>Save</strong> saves and returns to the
        list · <strong>Cancel</strong> discards. Label and module live under Details. Updated{' '}
        {Number.isNaN(new Date(template.updatedAt).getTime())
          ? '—'
          : `${new Date(template.updatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC`}
        .
      </div>

      <div className="sf-events-form-section-wide admin-inline-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => {
            setDraftIdentity(identity)
            setDetailsOpen(true)
          }}
        >
          Details
        </button>
        <span className="settings-hint">
          {identity.label || 'Untitled'} · {identity.moduleCategory}
        </span>
      </div>

      <form id={formId} action={updateAction} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="label" value={identity.label} readOnly />
        <input type="hidden" name="moduleCategory" value={identity.moduleCategory} readOnly />
        <EmailTemplateFormFields
          key={`${template.id}-${template.updatedAt}`}
          row={rowForFields}
          categories={categories}
          busy={busy}
          richEditorEnabled={richEditorEnabled}
          hideIdentity
        />
      </form>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      <div className="sf-events-form-actions page-settings-actions">
        <Link
          href="/admin/email/templates"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          onClick={(e) => {
            if (
              !window.confirm(
                'Discard unsaved changes and return to the templates list?',
              )
            ) {
              e.preventDefault()
            }
          }}
        >
          Cancel
        </Link>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-danger"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
        <button
          type="submit"
          form={formId}
          name="after"
          value="save"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
        >
          {updatePending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="submit"
          form={formId}
          name="after"
          value="apply"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy}
        >
          {updatePending ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {detailsOpen ? (
        <DetailsDialog title="Template details" onClose={() => setDetailsOpen(false)}>
          <form
            className="sf-admin-form-dialog-body"
            onSubmit={(event) => {
              event.preventDefault()
              const nextLabel = draftIdentity.label.trim()
              if (!nextLabel) return
              setIdentity({
                label: nextLabel,
                moduleCategory: draftIdentity.moduleCategory.trim() || 'other',
              })
              setDetailsOpen(false)
            }}
          >
            <p className="settings-hint">
              Name and module tag for the list. Subject and bodies stay on the full editor.
            </p>
            <label className="settings-field">
              <span>Label</span>
              <input
                type="text"
                value={draftIdentity.label}
                onChange={(event) =>
                  setDraftIdentity((prev) => ({ ...prev, label: event.target.value }))
                }
                required
                maxLength={200}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <label className="settings-field">
              <span>Module category</span>
              <select
                value={draftIdentity.moduleCategory}
                onChange={(event) =>
                  setDraftIdentity((prev) => ({
                    ...prev,
                    moduleCategory: event.target.value,
                  }))
                }
                disabled={busy}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <div className="page-settings-actions sf-events-form-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                onClick={() => setDetailsOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save">
                Apply
              </button>
            </div>
          </form>
        </DetailsDialog>
      ) : null}

      <AdminConfirmDialog
        open={confirmDelete}
        title="Delete template"
        message={`Delete template “${identity.label || template.label}”? Rules that point at it will fail until retargeted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          const data = new FormData()
          data.set('id', template.id)
          void deleteAction(data)
        }}
      />
    </div>
  )
}
