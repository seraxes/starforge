'use client'

import React, { startTransition, useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createPackageAction,
  deletePackageAction,
  updatePackageAction,
  type AdsActionState,
} from '../actions'
import type { AdsPackageRecord } from '../types'

const initial: AdsActionState = {}

type Props = {
  packages: AdsPackageRecord[]
  currency: string
}

function Feedback({ state }: { state: AdsActionState }) {
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
        Saved.
      </p>
    )
  }
  return null
}

function PackageFields({
  row,
  pending,
  currency,
}: {
  row?: AdsPackageRecord
  pending: boolean
  currency: string
}) {
  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Package</legend>
      <div className="sf-ads-package-fields">
        <label className="settings-field">
          <span>Title</span>
          <input
            type="text"
            name="title"
            defaultValue={row?.title ?? ''}
            required
            disabled={pending}
            autoComplete="off"
          />
        </label>
        <label className="settings-field">
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={row?.description ?? ''}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Price ({currency})</span>
          <input
            type="number"
            name="price"
            min={0}
            step={1}
            defaultValue={row?.price ?? 0}
            disabled={pending}
          />
          <span className="settings-hint">
            Major units. Payments will snapshot this later — no checkout in this slice.
          </span>
        </label>
        <label className="settings-field">
          <span>Credit grant</span>
          <input
            type="number"
            name="creditGrant"
            min={0}
            step={1}
            defaultValue={row?.creditGrant ?? 0}
            disabled={pending}
          />
          <span className="settings-hint">
            Credits to grant when a purchase is fulfilled (later Payments hook).
          </span>
        </label>
        <label className="settings-field">
          <span>Sort order</span>
          <input
            type="number"
            name="sortOrder"
            min={0}
            step={1}
            defaultValue={row?.sortOrder ?? 0}
            disabled={pending}
          />
        </label>
        <label className="settings-field settings-flag">
          <span>Active</span>
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={row ? row.active : true}
            disabled={pending}
          />
        </label>
      </div>
    </fieldset>
  )
}

function AddPackagePanel({ currency }: { currency: string }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createPackageAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-ads-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add package">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-ads-add-package-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Click Add + to create a package — currency {currency}.
            </p>
          ) : null}
        </div>
      </section>
      {createOpen ? (
        <div className="sf-ads-package-edit sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-ads-add-package-form"
            action={action}
            aria-label="Create package"
            className="sf-events-form-mosaic-form"
          >
            <PackageFields pending={pending} currency={currency} />
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
              form="sf-ads-add-package-form"
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

function EditPackageForm({
  row,
  currency,
  onClose,
  onDeleted,
}: {
  row: AdsPackageRecord
  currency: string
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updatePackageAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackageAction, initial)
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
  const formId = `sf-ads-edit-package-${row.id}`
  const feedback = state.error ? state : deleteState.error ? deleteState : state

  return (
    <div className="sf-ads-package-edit sf-events-form-mosaic" aria-label={`Edit ${row.title}`}>
      <form id={formId} action={action} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={row.id} />
        <PackageFields row={row} pending={busy} currency={currency} />
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
        title="Delete package"
        message={`Delete “${row.title}”? Campaigns that use it will block delete.`}
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

export function PackagesManager({ packages, currency }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = packages.find((p) => p.id === openId) ?? null

  return (
    <div className="sf-ads-packages-manager">
      <AddPackagePanel currency={currency} />

      <section className="outlines-create sf-ads-packages-list" aria-label="Packages">
        {packages.length === 0 ? (
          <p className="settings-hint">No packages yet.</p>
        ) : (
          <ul className="sf-ads-entity-list">
            {packages.map((row) => {
              const isOpen = openId === row.id
              return (
                <li key={row.id} className="page-settings-panel">
                  <div className="page-settings-panel-head">
                    <div>
                      <strong>{row.title}</strong>
                      <p className="settings-hint">
                        {row.price} {currency}
                        {row.creditGrant > 0 ? ` · ${row.creditGrant} credits` : ''}
                        {row.active ? '' : ' · inactive'}
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
                      <EditPackageForm
                        row={open}
                        currency={currency}
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
