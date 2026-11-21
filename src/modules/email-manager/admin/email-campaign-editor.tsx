'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  deleteEmailCampaignAction,
  sendEmailCampaignAction,
  updateEmailCampaignAction,
  type EmailAdminActionState,
} from '../actions'
import {
  EMAIL_BROADCAST_RECIPIENT_CAP,
  type BroadcastRecipientAdminFilter,
} from '../types'
import { EmailTemplateFormFields } from './email-template-fields'

export type CampaignEditorTemplateOption = {
  id: string
  label: string
  subject: string
  bodyText: string
  bodyHtml: string
  updatedAt: string
}

export type CampaignEditorBroadcastProgress = {
  status: string
  totalCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  nextRunAt: string | null
}

export type CampaignEditorBroadcastRecipientRow = {
  id: string
  email: string
  status: string
  error: string | null
  sentAt: string | null
}

export type CampaignEditorBroadcastRecipients = {
  rows: CampaignEditorBroadcastRecipientRow[]
  total: number
}

export type CampaignEditorCampaign = {
  id: string
  label: string
  templateId: string | null
  status: string
  updatedAt: string
}

type Props = {
  campaign: CampaignEditorCampaign
  templates: CampaignEditorTemplateOption[]
  richEditorEnabled: boolean
  recipientsText: string
  /** Saved recipient count from the server — confirm dialog uses this, not the textarea. */
  savedRecipientCount: number
  broadcast: CampaignEditorBroadcastProgress | null
  /** Present when the campaign has a broadcast — rows from sf_email_broadcast_recipients. */
  broadcastRecipients: CampaignEditorBroadcastRecipients | null
  /** Close the list expand (Cancel / after delete). */
  onClose: () => void
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

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`
  } catch {
    return '—'
  }
}

function filterBroadcastRows(
  rows: CampaignEditorBroadcastRecipientRow[],
  filter: BroadcastRecipientAdminFilter,
): CampaignEditorBroadcastRecipientRow[] {
  if (filter === 'all') return rows
  if (filter === 'queued') {
    return rows.filter((row) => row.status === 'queued' || row.status === 'sending')
  }
  return rows.filter((row) => row.status === filter)
}

/**
 * Campaign editor mosaic — half-width cards, used as a list expand (Subscriptions chrome).
 */
export function EmailCampaignEditor({
  campaign,
  templates,
  richEditorEnabled,
  recipientsText,
  savedRecipientCount,
  broadcast,
  broadcastRecipients,
  onClose,
}: Props) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [label, setLabel] = useState(campaign.label)
  const [templateId, setTemplateId] = useState(campaign.templateId ?? '')
  const [recipients, setRecipients] = useState(recipientsText)
  const [recipientFilter, setRecipientFilter] =
    useState<BroadcastRecipientAdminFilter>('failed')
  const isDraft = campaign.status === 'draft'
  const selectedTemplate = templates.find((tpl) => tpl.id === templateId) ?? null

  // Server snapshot only. A form action must not rewind these while a save is in flight.
  useEffect(() => {
    setLabel(campaign.label)
    setTemplateId(campaign.templateId ?? '')
    setRecipients(recipientsText)
  }, [campaign.id, campaign.updatedAt, campaign.label, campaign.templateId, recipientsText])

  const [updateState, updateAction, updatePending] = useActionState(
    updateEmailCampaignAction,
    initial,
  )
  const [sendState, sendAction, sendPending] = useActionState(
    sendEmailCampaignAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEmailCampaignAction,
    initial,
  )

  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(sendState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (deleteState.ok) {
      onClose()
      router.refresh()
      return
    }
    if (updateState.ok || sendState.ok) {
      router.refresh()
    }
  }, [updateState, sendState, deleteState, router, onClose])

  const filteredRecipients = useMemo(() => {
    if (!broadcastRecipients) return []
    return filterBroadcastRows(broadcastRecipients.rows, recipientFilter)
  }, [broadcastRecipients, recipientFilter])

  const busy = updatePending || sendPending || deletePending
  const formId = `email-campaign-edit-${campaign.id}`

  return (
    <div className="sf-email-campaign-editor sf-events-form-mosaic">
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          updateAction(new FormData(event.currentTarget))
        }}
      >
        <input type="hidden" name="id" value={campaign.id} />
      </form>

      {!isDraft ? (
        <fieldset className="settings-fieldset sf-events-form-section">
          <legend>Broadcast progress</legend>
          {broadcast ? (
            <>
              <p className="settings-hint">
                Broadcast status: <strong>{broadcast.status}</strong>
                {' · '}
                Sent {broadcast.sentCount} / {broadcast.totalCount}
                {' · '}
                Failed {broadcast.failedCount}
                {' · '}
                Skipped {broadcast.skippedCount}
                {' · '}
                Next run {formatUtc(broadcast.nextRunAt)}
              </p>
              <p className="settings-hint">
                Pause, Resume, and Cancel live on{' '}
                <Link href="/admin/email/broadcasts">Email → Broadcasts</Link>.
              </p>
            </>
          ) : (
            <p className="settings-hint">
              Status is “{campaign.status}”. Broadcast counters are not available yet.
            </p>
          )}
        </fieldset>
      ) : null}

      {broadcast && broadcastRecipients ? (
        <section
          className="outlines-create sf-events-form-section-wide"
          aria-label="Broadcast recipients"
        >
          <h3>Recipient status</h3>
          <div className="admin-control-row">
            <label className="settings-field">
              <span>Status</span>
              <select
                value={recipientFilter}
                aria-label="Broadcast recipient status filter"
                onChange={(e) =>
                  setRecipientFilter(e.target.value as BroadcastRecipientAdminFilter)
                }
              >
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="sent">Sent</option>
                <option value="queued">Waiting</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
          {broadcastRecipients.total > broadcastRecipients.rows.length ? (
            <p className="settings-hint">
              Showing {broadcastRecipients.rows.length} of {broadcastRecipients.total} loaded
              addresses (filter applies to this set).
            </p>
          ) : null}
          <div className="outlines-table-wrap" aria-label="Broadcast recipients">
            <table className="outlines-table">
              <thead>
                <tr>
                  <th scope="col">Address</th>
                  <th scope="col">Status</th>
                  <th scope="col">Error</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      No addresses with this status.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((row) => {
                    const errorFull = row.error?.trim() || ''
                    const errorShown =
                      errorFull.length > 120 ? `${errorFull.slice(0, 120)}…` : errorFull
                    return (
                      <tr key={row.id} title={errorFull || undefined}>
                        <td>
                          <code>{row.email}</code>
                        </td>
                        <td>{row.status}</td>
                        <td>{errorShown || '—'}</td>
                        <td>{formatUtc(row.sentAt)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Campaign</legend>
        <label className="settings-field">
          <span>Label</span>
          <input
            form={formId}
            type="text"
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={200}
            autoComplete="off"
            disabled={busy || !isDraft}
          />
        </label>
        <label className="settings-field">
          <span>Template</span>
          <select
            form={formId}
            name="templateId"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            required
            disabled={busy || !isDraft || templates.length === 0}
          >
            <option value="" disabled>
              {templates.length === 0 ? 'No templates yet' : 'Select a template'}
            </option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.label}
              </option>
            ))}
          </select>
        </label>
        {selectedTemplate ? (
          <p className="settings-hint">
            Words live on the template.{' '}
            <Link href={`/admin/email/templates/${selectedTemplate.id}`}>Edit template</Link>.
          </p>
        ) : (
          <p className="settings-hint">
            Create a template under{' '}
            <Link href="/admin/email/templates">Email → Templates</Link> if the list is empty.
          </p>
        )}
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Recipients</legend>
        <label className="settings-field">
          <span>Addresses</span>
          <textarea
            form={formId}
            name="recipients"
            rows={10}
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder={'one@example.com\ntwo@example.com'}
            disabled={busy || !isDraft}
          />
          <span className="settings-hint">
            One address per line, or comma-separated. Cap {EMAIL_BROADCAST_RECIPIENT_CAP}. Save
            stores the draft; Send queues through broadcast pace.
          </span>
        </label>
      </fieldset>

      {selectedTemplate ? (
        <EmailTemplateFormFields
          key={`${selectedTemplate.id}-${selectedTemplate.updatedAt}`}
          row={{
            subject: selectedTemplate.subject,
            bodyText: selectedTemplate.bodyText,
            bodyHtml: selectedTemplate.bodyHtml,
          }}
          categories={[]}
          busy={true}
          richEditorEnabled={richEditorEnabled}
          hideIdentity
          wideSections={false}
        />
      ) : null}

      <Feedback state={updateState} />
      <Feedback state={sendState} />
      <Feedback state={deleteState} />

      <div className="sf-events-form-actions page-settings-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        {isDraft ? (
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        ) : null}
        {isDraft ? (
          <button
            type="button"
            className="gantry-toolbar-btn"
            disabled={busy || templates.length === 0}
            onClick={() => setConfirmSend(true)}
          >
            {sendPending ? 'Queuing…' : 'Send'}
          </button>
        ) : null}
        <button
          type="submit"
          form={formId}
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy || !isDraft || templates.length === 0}
        >
          {updatePending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <AdminConfirmDialog
        open={confirmDelete}
        title="Delete campaign"
        message={`Delete draft campaign “${campaign.label}”? This cannot be undone.`}
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (deletePending) return
          setConfirmDelete(false)
          const data = new FormData()
          data.set('id', campaign.id)
          void deleteAction(data)
        }}
      />

      <AdminConfirmDialog
        open={confirmSend}
        title="Send campaign"
        message={`Queue this campaign to ${savedRecipientCount} saved recipient${savedRecipientCount === 1 ? '' : 's'}? Unsaved edits in the form are saved first.`}
        confirmLabel={sendPending ? 'Queuing…' : 'Send'}
        cancelLabel="Cancel"
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          if (sendPending) return
          setConfirmSend(false)
          const form = document.getElementById(formId) as HTMLFormElement | null
          if (!form) return
          const data = new FormData(form)
          void sendAction(data)
        }}
      />
    </div>
  )
}
