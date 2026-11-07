'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { MediaPicker } from '@/modules/media/api'

import {
  createEventPartyAction,
  deleteEventPartyAction,
  updateEventPartyAction,
  type EventsAdminActionState,
} from '../actions'
import { EVENT_PARTY_KINDS } from '../types'

type PartyRow = {
  id: string
  name: string
  kind: string
  url: string
  blurb: string
  avatarMediaId: string
  updatedAt: string
}

type Props = { parties: PartyRow[] }

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

function PartyFields({ row, busy }: { row?: PartyRow; busy: boolean }) {
  const [avatarMediaId, setAvatarMediaId] = React.useState(row?.avatarMediaId ?? '')

  return (
    <div className="sf-events-form-mosaic sf-parties-form-mosaic">
      <fieldset className="settings-fieldset sf-events-form-section">
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
          />
        </label>
        <label className="settings-field">
          <span>Kind</span>
          <select name="kind" defaultValue={row?.kind ?? 'organizer'} disabled={busy}>
            {EVENT_PARTY_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === 'speaker' ? 'organizer (speaker)' : k}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>URL</span>
          <input
            type="url"
            name="url"
            maxLength={2000}
            defaultValue={row?.url ?? ''}
            disabled={busy}
            autoComplete="off"
            placeholder="https://"
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Avatar</legend>
        <div className="settings-field">
          <MediaPicker
            label="Avatar"
            value={{ mediaId: avatarMediaId, url: '', alt: '' }}
            defaultFolder="general"
            defaultPurpose="photo"
            disabled={busy}
            includeHiddenInputs={false}
            allowUrlFallback={false}
            onChange={(next) => setAvatarMediaId(next.mediaId)}
          />
          <input type="hidden" name="coverMediaId" value={avatarMediaId} />
        </div>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
        <legend>Description</legend>
        <label className="settings-field settings-field-wide">
          <span>Description</span>
          <textarea
            name="blurb"
            rows={6}
            maxLength={2000}
            defaultValue={row?.blurb ?? ''}
            disabled={busy}
            placeholder="Short public bio / description…"
          />
        </label>
      </fieldset>
    </div>
  )
}

export function PartiesManager({ parties }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createState, createAction, createPending] = useActionState(
    createEventPartyAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateEventPartyAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEventPartyAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      router.refresh()
      return
    }
    if (updateState.ok || deleteState.ok) {
      if (deleteState.ok) setEditingId(null)
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const busy = createPending || updatePending || deletePending
  const editing = editingId ? parties.find((p) => p.id === editingId) : null

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="sf-events-parties-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add party">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-parties-add-form"
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
              Organizer / sponsor profiles — link them from each event.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-parties-add-form"
            action={createAction}
            className="sf-events-add-inline-form"
          >
            <PartyFields busy={busy} />
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

      {parties.length === 0 ? (
        <section className="outlines-create">
          <h3>No parties yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> for an organizer or sponsor profile.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Parties list">
          <h3>Parties</h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">URL</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((row) => (
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
                    <td>{row.kind === 'speaker' ? 'organizer' : row.kind}</td>
                    <td className="sf-events-list-wrap">
                      {row.url ? (
                        <a href={row.url} rel="noopener noreferrer">
                          {row.url}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
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
                              if (!window.confirm(`Delete party “${row.name}”?`)) {
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
          aria-label={`Edit party ${editing.name}`}
        >
          <h3>Edit · {editing.name}</h3>
          <form
            key={`${editing.id}-${editing.updatedAt}`}
            id={`party-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <PartyFields row={editing} busy={busy} />
          </form>
          <div className="admin-action-row sf-events-form-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={`party-edit-${editing.id}`}
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
