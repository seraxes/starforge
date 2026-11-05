'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { UserGroupOption } from '@/core/acl/types'

import {
  createVenueAction,
  deleteVenueAction,
  updateVenueAction,
  type EventsAdminActionState,
} from '../actions'
import { CoverAndAccessFields } from './events-form-fields'

type VenueRow = {
  id: string
  name: string
  address: string
  coverMediaId: string
  accessTags: string[]
  updatedAt: string
}

type Props = {
  venues: VenueRow[]
  groups: UserGroupOption[]
}

const initial: EventsAdminActionState = {}

function Feedback({ state }: { state: EventsAdminActionState }) {
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

export function VenuesManager({ venues, groups }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createVenueAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateVenueAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteVenueAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  const busy = createPending || updatePending || deletePending

  return (
    <div className="sf-events-venues-manager admin-settings-mosaic">
      <section className="outlines-create page-settings-panel" aria-label="Create venue">
        <header className="page-settings-panel-head">
          <h3>Add venue</h3>
        </header>
        <div className="page-settings-panel-body">
          <form action={createAction} className="outlines-create-form admin-create-form">
            <label className="settings-field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="Venue name"
              />
            </label>
            <label className="settings-field">
              <span>Address</span>
              <input
                type="text"
                name="address"
                maxLength={2000}
                autoComplete="off"
                placeholder="Street, city, country"
              />
            </label>
            <CoverAndAccessFields
              coverMediaId=""
              accessTags={['public']}
              groups={groups}
              disabled={busy}
            />
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={createPending}
            >
              {createPending ? 'Adding…' : 'Add venue'}
            </button>
          </form>
          <Feedback state={createState} />
        </div>
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap admin-settings-panel-wide">
        {venues.length === 0 ? (
          <p className="admin-empty">No venues yet. Add one above.</p>
        ) : (
          venues.map((row) => (
            <section
              key={row.id}
              className="page-settings-panel"
              aria-label={`Edit venue ${row.name}`}
            >
              <header className="page-settings-panel-head">
                <h3>{row.name}</h3>
                <span className="settings-hint">Updated {formatUpdated(row.updatedAt)}</span>
              </header>
              <div className="page-settings-panel-body">
                <form action={updateAction} className="outlines-create-form admin-create-form">
                  <input type="hidden" name="id" value={row.id} />
                  <label className="settings-field">
                    <span>Name</span>
                    <input
                      type="text"
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={row.name}
                      disabled={busy}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Address</span>
                    <input
                      type="text"
                      name="address"
                      maxLength={2000}
                      defaultValue={row.address}
                      disabled={busy}
                    />
                  </label>
                  <CoverAndAccessFields
                    key={`${row.id}-${row.updatedAt}`}
                    coverMediaId={row.coverMediaId}
                    accessTags={row.accessTags}
                    groups={groups}
                    disabled={busy}
                  />
                  <div className="admin-inline-actions">
                    <button
                      type="submit"
                      className="gantry-toolbar-btn gantry-toolbar-btn-save"
                      disabled={busy}
                    >
                      {updatePending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
                <form action={deleteAction} className="admin-inline-actions">
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="gantry-btn"
                    disabled={busy}
                    onClick={(e) => {
                      if (!window.confirm(`Delete venue “${row.name}”?`)) {
                        e.preventDefault()
                      }
                    }}
                  >
                    {deletePending ? 'Deleting…' : 'Delete'}
                  </button>
                </form>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
