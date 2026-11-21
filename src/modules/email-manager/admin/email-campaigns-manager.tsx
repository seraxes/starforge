'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createEmailCampaignAction,
  deleteEmailCampaignAction,
  type EmailAdminActionState,
} from '../actions'
import {
  EmailCampaignEditor,
  type CampaignEditorBroadcastProgress,
  type CampaignEditorBroadcastRecipients,
  type CampaignEditorTemplateOption,
} from './email-campaign-editor'

type CampaignRow = {
  id: string
  label: string
  templateId: string | null
  templateLabel: string
  recipientCount: number
  status: string
  updatedAt: string
  recipientsText: string
  broadcast: CampaignEditorBroadcastProgress | null
  broadcastRecipients: CampaignEditorBroadcastRecipients | null
}

type Props = {
  campaigns: CampaignRow[]
  templates: CampaignEditorTemplateOption[]
  richEditorEnabled: boolean
  unavailable?: boolean
  unavailableError?: string
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
    return `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`
  } catch {
    return '—'
  }
}

function progressLabel(row: CampaignRow): string {
  if (!row.broadcast) {
    return String(row.recipientCount)
  }
  const base = `${row.broadcast.sentCount}/${row.broadcast.totalCount}`
  if (row.broadcast.failedCount > 0) {
    return `${base} (${row.broadcast.failedCount} failed)`
  }
  return base
}

export function EmailCampaignsManager({
  campaigns,
  templates,
  richEditorEnabled,
  unavailable,
  unavailableError,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null)

  const [createState, createAction, createPending] = useActionState(
    createEmailCampaignAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailCampaignAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (!createState.ok || !createState.id) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    setEditingId(createState.id)
    router.refresh()
  }, [createState, router])

  useEffect(() => {
    if (!deleteState.ok) return
    setDeleteTarget(null)
    setEditingId(null)
    router.refresh()
  }, [deleteState.ok, router])

  const editing = useMemo(
    () => (editingId ? campaigns.find((row) => row.id === editingId) ?? null : null),
    [campaigns, editingId],
  )

  const busy = createPending || deletePending
  const createFormId = 'sf-email-campaign-create-form'

  function toggleEdit(id: string) {
    setCreateOpen(false)
    setEditingId((current) => (current === id ? null : id))
  }

  return (
    <div className="sf-email-campaigns-manager">
      <div className={`sf-email-campaigns-add-panel${createOpen ? ' is-open' : ''}`}>
        <section className="outlines-create sf-events-add-panel" aria-label="Add campaign">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              aria-expanded={createOpen}
              aria-controls={createFormId}
              onClick={() => {
                if (createOpen) {
                  setCreateOpen(false)
                  return
                }
                setEditingId(null)
                setCreateOpen(true)
              }}
            >
              {createOpen ? 'Close' : 'Add +'}
            </button>
            {!createOpen ? (
              <p className="settings-hint sf-events-add-hint">
                Add a name, then expand the row to pick a template and paste recipients. Send
                happens on the expand.
              </p>
            ) : null}
          </div>
        </section>

        {createOpen ? (
          <div className="sf-email-campaign-create sf-events-form-mosaic">
            <form
              key={formKey}
              id={createFormId}
              action={createAction}
              aria-label="Create campaign"
              className="sf-events-form-mosaic-form"
            >
              <fieldset className="settings-fieldset sf-events-form-section">
                <legend>Campaign</legend>
                <label className="settings-field">
                  <span>Name</span>
                  <input
                    type="text"
                    name="label"
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Untitled campaign"
                    disabled={busy}
                  />
                </label>
              </fieldset>
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

      <Feedback state={deleteState} />

      {unavailable ? (
        <p className="admin-inline-error" role="alert">
          {unavailableError || 'Campaigns table unavailable.'}
        </p>
      ) : null}

      <section className="outlines-create" aria-label="Campaigns list">
        <h3>Campaigns</h3>
        <div className="outlines-table-wrap" aria-label="Campaigns list">
          <table className="outlines-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Template</th>
                <th scope="col">Recipients</th>
                <th scope="col">Progress</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    No campaigns yet. Use Add + to create a draft.
                  </td>
                </tr>
              ) : (
                campaigns.map((row) => (
                  <tr
                    key={row.id}
                    className={editingId === row.id ? 'is-editing' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="sf-events-list-title sf-events-list-title-btn"
                        aria-expanded={editingId === row.id}
                        onClick={() => toggleEdit(row.id)}
                      >
                        {row.label}
                      </button>
                    </td>
                    <td>{row.templateLabel}</td>
                    <td>{row.recipientCount}</td>
                    <td>{progressLabel(row)}</td>
                    <td>{row.status}</td>
                    <td>{formatUpdated(row.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          aria-expanded={editingId === row.id}
                          onClick={() => toggleEdit(row.id)}
                        >
                          {editingId === row.id ? 'Close' : 'Edit'}
                        </button>
                        {row.status === 'draft' ? (
                          <button
                            type="button"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                            disabled={busy}
                            onClick={() => setDeleteTarget(row)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <EmailCampaignEditor
          key={`${editing.id}-${editing.updatedAt}`}
          campaign={{
            id: editing.id,
            label: editing.label,
            templateId: editing.templateId,
            status: editing.status,
            updatedAt: editing.updatedAt,
          }}
          templates={templates}
          richEditorEnabled={richEditorEnabled}
          recipientsText={editing.recipientsText}
          savedRecipientCount={editing.recipientCount}
          broadcast={editing.broadcast}
          broadcastRecipients={editing.broadcastRecipients}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete campaign"
        message={
          deleteTarget
            ? `Delete draft campaign “${deleteTarget.label}”? This cannot be undone.`
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
