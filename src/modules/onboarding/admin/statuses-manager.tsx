'use client'

import React, { startTransition, useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createOnboardingStatusAction,
  deleteOnboardingStatusAction,
  updateOnboardingStatusAction,
  type OnboardingAdminActionState,
} from '../actions'
const initial: OnboardingAdminActionState = {}

type FormOption = { id: string; label: string }

type StatusRow = {
  id: string
  key: string
  name: string
  bookable: boolean
  formDefinitionId: string
  sortOrder: number
  updatedAt: string
}

type Props = {
  statuses: StatusRow[]
  formOptions: FormOption[]
}

function Feedback({ state }: { state: OnboardingAdminActionState }) {
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

function withCurrentOption(options: FormOption[], currentId: string): FormOption[] {
  const id = currentId.trim()
  if (!id) return options
  if (options.some((opt) => opt.id === id)) return options
  return [...options, { id, label: `${id} (missing)` }]
}

function StatusFields({
  row,
  formOptions,
  pending,
}: {
  row?: StatusRow
  formOptions: FormOption[]
  pending: boolean
}) {
  const [name, setName] = useState(row?.name ?? '')
  const [key, setKey] = useState(row?.key ?? '')
  const [bookable, setBookable] = useState(row?.bookable === true)
  const [formDefinitionId, setFormDefinitionId] = useState(row?.formDefinitionId ?? '')
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0))
  const formChoices = withCurrentOption(formOptions, formDefinitionId)
  const formDeepLinkId = formDefinitionId.trim()

  useEffect(() => {
    setName(row?.name ?? '')
    setKey(row?.key ?? '')
    setBookable(row?.bookable === true)
    setFormDefinitionId(row?.formDefinitionId ?? '')
    setSortOrder(String(row?.sortOrder ?? 0))
  }, [row])

  return (
    <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
      <legend>Status</legend>
      <label className="settings-field">
        <span>Name</span>
        <input
          type="text"
          name="name"
          value={name}
          required
          disabled={pending}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Key</span>
        <input
          type="text"
          name="key"
          value={key}
          disabled={pending}
          autoComplete="off"
          placeholder="active"
          onChange={(e) => setKey(e.target.value)}
        />
        <span className="settings-hint">Leave blank on create to build it from the name.</span>
      </label>
      <label className="settings-field">
        <span>Sort order</span>
        <input
          type="number"
          name="sortOrder"
          min={0}
          step={1}
          value={sortOrder}
          disabled={pending}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </label>
      <label className="settings-field settings-flag">
        <span>Bookable</span>
        <input
          type="checkbox"
          name="bookable"
          value="1"
          checked={bookable}
          disabled={pending}
          onChange={(e) => setBookable(e.target.checked)}
        />
        <span className="settings-hint">
          When on, the person is bookable without Fleet vehicle access. Seeded Active is on.
        </span>
      </label>
      <label className="settings-field">
        <span>Forms definition</span>
        {formOptions.length > 0 || formDefinitionId ? (
          <select
            name="formDefinitionId"
            value={formDefinitionId}
            disabled={pending}
            onChange={(e) => setFormDefinitionId(e.target.value)}
          >
            <option value="">None</option>
            {formChoices.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            name="formDefinitionId"
            value={formDefinitionId}
            disabled={pending}
            placeholder="Optional Forms definition id"
            autoComplete="off"
            onChange={(e) => setFormDefinitionId(e.target.value)}
          />
        )}
        <span className="settings-hint">
          Optional intake for this step. Banned and similar statuses may have none.{' '}
          {formDeepLinkId ? (
            <Link href={`/admin/forms/${encodeURIComponent(formDeepLinkId)}`}>Edit form</Link>
          ) : (
            <Link href="/admin/forms">Open Forms</Link>
          )}
        </span>
      </label>
    </fieldset>
  )
}

function AddStatusPanel({ formOptions }: { formOptions: FormOption[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createOnboardingStatusAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-onboarding-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add status">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-onboarding-add-status-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Click Add + to create a status — bookable flag and optional Forms definition.
            </p>
          ) : null}
        </div>
      </section>
      {createOpen ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-onboarding-add-status-form"
            action={action}
            aria-label="Create status"
            className="sf-events-form-mosaic-form"
          >
            <StatusFields formOptions={formOptions} pending={pending} />
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
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
              form="sf-onboarding-add-status-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EditStatusForm({
  row,
  formOptions,
  onClose,
  onDeleted,
}: {
  row: StatusRow
  formOptions: FormOption[]
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateOnboardingStatusAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingStatusAction,
    initial,
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  useEffect(() => {
    if (!deleteState.ok) return
    onDeleted()
    router.refresh()
  }, [deleteState.ok, onDeleted, router])

  const busy = pending || deletePending
  const formId = `sf-onboarding-edit-status-${row.id}`
  const feedback = state.error ? state : deleteState.error ? deleteState : state

  return (
    <div className="sf-events-form-mosaic" aria-label={`Edit ${row.name}`}>
      <form id={formId} action={action} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={row.id} />
        <StatusFields row={row} formOptions={formOptions} pending={busy} />
      </form>
      <Feedback state={feedback} />
      <div className="sf-events-form-actions admin-action-row page-settings-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <AdminConfirmDialog
        open={confirmDelete}
        title="Delete status"
        message={`Delete “${row.name}”? People using it must be reassigned first.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          const fd = new FormData()
          fd.set('id', row.id)
          startTransition(() => {
            void deleteAction(fd)
          })
        }}
      />
    </div>
  )
}

export function StatusesManager({ statuses, formOptions }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = statuses.find((s) => s.id === openId) ?? null

  return (
    <div className="sf-onboarding-statuses-manager">
      <AddStatusPanel formOptions={formOptions} />

      <section className="outlines-create" aria-label="Statuses">
        {statuses.length === 0 ? (
          <p className="settings-hint">No statuses yet.</p>
        ) : (
          <ul className="sf-ads-entity-list">
            {statuses.map((row) => {
              const isOpen = openId === row.id
              return (
                <li key={row.id} className="page-settings-panel">
                  <div className="page-settings-panel-head">
                    <div>
                      <strong>{row.name}</strong>
                      <p className="settings-hint">
                        {row.key}
                        {row.bookable ? ' · bookable' : ''}
                        {row.formDefinitionId ? ` · form ${row.formDefinitionId}` : ' · no form'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : row.id)}
                    >
                      {isOpen ? 'Close' : 'Edit'}
                    </button>
                  </div>
                  {isOpen && open ? (
                    <div className="page-settings-panel-body">
                      <EditStatusForm
                        row={open}
                        formOptions={formOptions}
                        onClose={() => setOpenId(null)}
                        onDeleted={() => setOpenId(null)}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export type { StatusRow }
