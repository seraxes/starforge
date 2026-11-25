'use client'

import React, { startTransition, useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createPlacementAction,
  deletePlacementAction,
  updatePlacementAction,
  type AdsActionState,
} from '../actions'
import type { AdsPlacementRecord } from '../types'

const initial: AdsActionState = {}

type Props = {
  placements: AdsPlacementRecord[]
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

function PlacementFields({
  row,
  pending,
}: {
  row?: AdsPlacementRecord
  pending: boolean
}) {
  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Placement</legend>
      <div className="sf-ads-placement-fields">
        <label className="settings-field">
          <span>Label</span>
          <input
            type="text"
            name="label"
            defaultValue={row?.label ?? ''}
            required
            disabled={pending}
            autoComplete="off"
          />
        </label>
        <label className="settings-field">
          <span>Key</span>
          <input
            type="text"
            name="key"
            defaultValue={row?.key ?? ''}
            required
            disabled={pending}
            autoComplete="off"
            placeholder="social_feed"
          />
          <span className="settings-hint">
            Stable slug — lowercase letters, digits, underscore (e.g. social_feed).
          </span>
        </label>
        <label className="settings-field settings-flag">
          <span>Enabled</span>
          <input
            type="checkbox"
            name="enabled"
            value="1"
            defaultChecked={row ? row.enabled : true}
            disabled={pending}
          />
        </label>
      </div>
    </fieldset>
  )
}

function AddPlacementPanel() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createPlacementAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-ads-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add placement">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-ads-add-placement-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Click Add + to define where creatives may appear.
            </p>
          ) : null}
        </div>
      </section>
      {createOpen ? (
        <div className="sf-ads-placement-edit sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-ads-add-placement-form"
            action={action}
            aria-label="Create placement"
            className="sf-events-form-mosaic-form"
          >
            <PlacementFields pending={pending} />
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
              form="sf-ads-add-placement-form"
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

function EditPlacementForm({
  row,
  onClose,
  onDeleted,
}: {
  row: AdsPlacementRecord
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updatePlacementAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deletePlacementAction, initial)
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
  const formId = `sf-ads-edit-placement-${row.id}`
  const feedback = state.error ? state : deleteState.error ? deleteState : state

  return (
    <div className="sf-ads-placement-edit sf-events-form-mosaic" aria-label={`Edit ${row.label}`}>
      <form id={formId} action={action} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={row.id} />
        <PlacementFields row={row} pending={busy} />
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
        title="Delete placement"
        message={`Delete “${row.label}” (${row.key})?`}
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

export function PlacementsManager({ placements }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = placements.find((p) => p.id === openId) ?? null

  return (
    <div className="sf-ads-placements-manager">
      <AddPlacementPanel />

      <section className="outlines-create sf-ads-placements-list" aria-label="Placements">
        {placements.length === 0 ? (
          <p className="settings-hint">No placements yet.</p>
        ) : (
          <ul className="sf-ads-entity-list">
            {placements.map((row) => {
              const isOpen = openId === row.id
              return (
                <li key={row.id} className="page-settings-panel">
                  <div className="page-settings-panel-head">
                    <div>
                      <strong>{row.label}</strong>
                      <p className="settings-hint">
                        {row.key}
                        {row.enabled ? '' : ' · disabled'}
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
                      <EditPlacementForm
                        row={open}
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
