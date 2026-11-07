'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import type { MapClientConfig } from '@/core/maps/types'
import { MediaPicker } from '@/modules/media/api'
import { VenueLocationMap } from '@/modules/maps/VenueLocationMap'
import { RichEditor } from '@/modules/rich-editor/api'

import {
  createVenueAction,
  deleteVenueAction,
  geocodeVenueAction,
  updateVenueAction,
  type EventsAdminActionState,
} from '../actions'
import { GalleryFields } from './events-form-fields'

type VenueRow = {
  id: string
  name: string
  address: string
  description: string
  latitude: number | null
  longitude: number | null
  coverMediaId: string
  galleryMediaIds: string[]
  accessTags: string[]
  updatedAt: string
}

type Props = {
  venues: VenueRow[]
  groups: UserGroupOption[]
  mapsEnabled?: boolean
  mapClientConfig?: MapClientConfig | null
  richEditorEnabled?: boolean
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

function VenueCoverField({
  coverMediaId: initialCover,
  disabled,
}: {
  coverMediaId: string
  disabled?: boolean
}) {
  const [coverMediaId, setCoverMediaId] = useState(initialCover)
  return (
    <div className="settings-field">
      <MediaPicker
        label="Cover"
        value={{ mediaId: coverMediaId, url: '', alt: '' }}
        defaultFolder="general"
        defaultPurpose="photo"
        disabled={disabled}
        includeHiddenInputs={false}
        allowUrlFallback={false}
        hint="Shared Media Manager — not a per-module library."
        onChange={(next) => setCoverMediaId(next.mediaId)}
      />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />
    </div>
  )
}

function VenueFormFields({
  row,
  groups,
  busy,
  mapsEnabled,
  mapClientConfig,
  richEditorEnabled,
}: {
  row?: VenueRow
  groups: UserGroupOption[]
  busy: boolean
  mapsEnabled: boolean
  mapClientConfig: MapClientConfig | null
  richEditorEnabled: boolean
}) {
  const [latitude, setLatitude] = useState(
    typeof row?.latitude === 'number' ? String(row.latitude) : '',
  )
  const [longitude, setLongitude] = useState(
    typeof row?.longitude === 'number' ? String(row.longitude) : '',
  )
  const [accessTags, setAccessTags] = useState(
    row?.accessTags?.length ? [...row.accessTags] : ['public'],
  )

  const latNum = latitude.trim() === '' ? null : Number(latitude)
  const lngNum = longitude.trim() === '' ? null : Number(longitude)
  const latOk = latNum != null && Number.isFinite(latNum) ? latNum : null
  const lngOk = lngNum != null && Number.isFinite(lngNum) ? lngNum : null

  return (
    <div className="sf-events-form-mosaic sf-venues-form-mosaic">
      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
        <legend>Basics</legend>
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
        <div className="settings-field settings-field-wide">
          <RichEditor
            name="description"
            label="Description"
            defaultValue={row?.description ?? ''}
            disabled={busy}
            enabled={richEditorEnabled}
            preset="full"
            placeholder="Venue description…"
          />
        </div>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
        <legend>Location</legend>
        <div className="sf-venues-location-grid">
          <label className="settings-field">
            <span>Latitude</span>
            <input
              type="number"
              name="latitude"
              step="any"
              min={-90}
              max={90}
              value={latitude}
              disabled={busy}
              onChange={(e) => setLatitude(e.target.value)}
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
              value={longitude}
              disabled={busy}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </label>
        </div>
        {mapsEnabled && mapClientConfig ? (
          <VenueLocationMap
            clientConfig={mapClientConfig}
            latitude={latOk}
            longitude={lngOk}
            disabled={busy}
            height="16rem"
            onPick={(lat, lng) => {
              setLatitude(String(Number(lat.toFixed(6))))
              setLongitude(String(Number(lng.toFixed(6))))
            }}
          />
        ) : (
          <p className="settings-hint">
            Enable <strong>Maps</strong> under Settings → Modules to place a pin on the map.
            Lat/lng inputs still work without it.
          </p>
        )}
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Cover</legend>
        <VenueCoverField
          key={row ? `${row.id}-cover-${row.updatedAt}` : 'new-cover'}
          coverMediaId={row?.coverMediaId ?? ''}
          disabled={busy}
        />
      </fieldset>

      <GalleryFields
        key={row ? `${row.id}-gallery-${row.updatedAt}` : 'new-gallery'}
        galleryMediaIds={row?.galleryMediaIds ?? []}
        disabled={busy}
      />

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Visibility</legend>
        <AccessTagsField
          value={accessTags}
          groups={groups}
          disabled={busy}
          legend="Who can see"
          onChange={setAccessTags}
        />
        <input type="hidden" name="accessTagsJson" value={JSON.stringify(accessTags)} />
      </fieldset>
    </div>
  )
}

export function VenuesManager({
  venues,
  groups,
  mapsEnabled = false,
  mapClientConfig = null,
  richEditorEnabled = true,
}: Props) {
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
              Same card layout as Events — description, gallery, map pin.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-venues-add-form"
            action={createAction}
            className="sf-events-add-inline-form"
          >
            <VenueFormFields
              groups={groups}
              busy={busy}
              mapsEnabled={mapsEnabled}
              mapClientConfig={mapClientConfig}
              richEditorEnabled={richEditorEnabled}
            />
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
          >
            <input type="hidden" name="id" value={editing.id} />
            <VenueFormFields
              row={editing}
              groups={groups}
              busy={busy}
              mapsEnabled={mapsEnabled}
              mapClientConfig={mapClientConfig}
              richEditorEnabled={richEditorEnabled}
            />
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
