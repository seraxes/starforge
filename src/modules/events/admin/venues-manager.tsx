'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { UserGroupOption } from '@/core/acl/types'

import {
  createVenueAction,
  deleteVenueAction,
  geocodeVenueAction,
  updateVenueAction,
  type EventsAdminActionState,
} from '../actions'
import { CoverAndAccessFields } from './events-form-fields'

type VenueRow = {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
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

function formatAccess(tags: string[]): string {
  if (!tags.length || tags.includes('public')) return 'Public'
  if (tags.includes('registered')) return 'Registered'
  const groups = tags.filter((t) => t.startsWith('group:')).length
  if (groups > 0) return groups === 1 ? '1 group' : `${groups} groups`
  return tags.join(', ')
}

function formatCoords(lat: number | null, lng: number | null): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '—'
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function VenueFormFields({
  row,
  groups,
  busy,
}: {
  row?: VenueRow
  groups: UserGroupOption[]
  busy: boolean
}) {
  return (
    <>
      <label className="settings-field">
        <span>Name</span>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          defaultValue={row?.name ?? ''}
          disabled={busy}
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
          defaultValue={row?.address ?? ''}
          disabled={busy}
          autoComplete="off"
          placeholder="Street, city, country"
        />
      </label>
      <label className="settings-field">
        <span>Latitude</span>
        <input
          type="number"
          name="latitude"
          step="any"
          min={-90}
          max={90}
          defaultValue={row?.latitude ?? ''}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Longitude</span>
        <input
          type="number"
          name="longitude"
          step="any"
          min={-180}
          max={180}
          defaultValue={row?.longitude ?? ''}
          disabled={busy}
        />
      </label>
      <CoverAndAccessFields
        key={row ? `${row.id}-${row.updatedAt}` : 'new'}
        coverMediaId={row?.coverMediaId ?? ''}
        accessTags={row?.accessTags ?? ['public']}
        groups={groups}
        disabled={busy}
      />
    </>
  )
}

export function VenuesManager({ venues, groups }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
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
  const [geocodeState, geocodeAction, geocodePending] = useActionState(
    geocodeVenueAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(geocodeState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      router.refresh()
      return
    }
    if (updateState.ok || deleteState.ok || geocodeState.ok) {
      if (deleteState.ok) setEditingId(null)
      router.refresh()
    }
  }, [createState, updateState, deleteState, geocodeState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const busy = createPending || updatePending || deletePending || geocodePending
  const editing = editingId ? venues.find((v) => v.id === editingId) : null

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="sf-events-venues-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add venue">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-venues-add-form"
            onClick={() => {
              if (createOpen) resetCreate()
              else {
                setEditingId(null)
                setCreateOpen(true)
              }
            }}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Places for events — address, map coords, cover, ACL.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-venues-add-form"
            action={createAction}
            className="outlines-create-form admin-create-form sf-events-add-inline-form"
          >
            <VenueFormFields groups={groups} busy={busy} />
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
                onClick={resetCreate}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={createPending}
              >
                {createPending ? 'Adding…' : 'Save'}
              </button>
            </div>
            <Feedback state={createState} />
          </form>
        ) : null}
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />
      <Feedback state={geocodeState} />

      {venues.length === 0 ? (
        <section className="outlines-create" aria-label="Venues list">
          <h3>No venues yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> to create a place for events.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Venues list">
          <h3>Venues</h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Address</th>
                  <th scope="col">Coords</th>
                  <th scope="col">Access</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((row) => (
                  <tr
                    key={row.id}
                    className={editingId === row.id ? 'is-editing' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="sf-events-list-title sf-events-list-title-btn"
                        onClick={() => {
                          setCreateOpen(false)
                          setEditingId((id) => (id === row.id ? null : row.id))
                        }}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="sf-events-list-wrap">{row.address || '—'}</td>
                    <td className="sf-events-list-num">
                      {formatCoords(row.latitude, row.longitude)}
                    </td>
                    <td>{formatAccess(row.accessTags)}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          onClick={() => {
                            setCreateOpen(false)
                            setEditingId((id) => (id === row.id ? null : row.id))
                          }}
                        >
                          {editingId === row.id ? 'Close' : 'Edit'}
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                            disabled={busy}
                            onClick={(e) => {
                              if (!window.confirm(`Delete venue “${row.name}”?`)) {
                                e.preventDefault()
                              }
                            }}
                          >
                            {deletePending ? '…' : 'Delete'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <section
          className="outlines-create sf-events-inline-editor"
          aria-label={`Edit venue ${editing.name}`}
        >
          <h3>Edit · {editing.name}</h3>
          <form
            key={`${editing.id}-${editing.updatedAt}`}
            id={`venue-edit-${editing.id}`}
            action={updateAction}
            className="outlines-create-form admin-create-form"
          >
            <input type="hidden" name="id" value={editing.id} />
            <VenueFormFields row={editing} groups={groups} busy={busy} />
          </form>
          <div className="admin-action-row">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
            <form action={geocodeAction}>
              <input type="hidden" name="id" value={editing.id} />
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {geocodePending ? 'Geocoding…' : 'Geocode'}
              </button>
            </form>
            <button
              type="submit"
              form={`venue-edit-${editing.id}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {updatePending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
