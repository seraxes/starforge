'use client'

import React, { useActionState, useEffect } from 'react'
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

function PartyFields({
  row,
  busy,
}: {
  row?: PartyRow
  busy: boolean
}) {
  const [avatarMediaId, setAvatarMediaId] = React.useState(row?.avatarMediaId ?? '')

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
        />
      </label>
      <label className="settings-field">
        <span>Kind</span>
        <select name="kind" defaultValue={row?.kind ?? 'organizer'} disabled={busy}>
          {EVENT_PARTY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
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
      <label className="settings-field settings-field-wide">
        <span>Blurb</span>
        <textarea
          name="blurb"
          rows={2}
          maxLength={2000}
          defaultValue={row?.blurb ?? ''}
          disabled={busy}
        />
      </label>
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
    </>
  )
}

export function PartiesManager({ parties }: Props) {
  const router = useRouter()
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
    if (createState.ok || updateState.ok || deleteState.ok) router.refresh()
  }, [createState, updateState, deleteState, router])

  const busy = createPending || updatePending || deletePending

  return (
    <div className="sf-events-parties-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Create party">
        <h3>Add party</h3>
        <p className="settings-hint">
          Lightweight profiles for organizers, speakers, and sponsors — link them from each
          event editor.
        </p>
        <form action={createAction} className="outlines-create-form admin-create-form">
          <PartyFields busy={busy} />
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={createPending}
            >
              {createPending ? 'Adding…' : 'Add party'}
            </button>
          </div>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      {parties.length === 0 ? (
        <section className="outlines-create">
          <h3>No parties yet</h3>
          <p className="admin-empty">Add an organizer team or speaker above.</p>
        </section>
      ) : (
        parties.map((row) => (
          <section
            key={row.id}
            className="outlines-create"
            aria-label={`Edit party ${row.name}`}
          >
            <h3>
              {row.name} <span className="settings-hint">({row.kind})</span>
            </h3>
            <form
              id={`party-edit-${row.id}`}
              action={updateAction}
              className="outlines-create-form admin-create-form"
            >
              <input type="hidden" name="id" value={row.id} />
              <PartyFields key={`${row.id}-${row.updatedAt}`} row={row} busy={busy} />
            </form>
            <div className="admin-action-row">
              <button
                type="submit"
                form={`party-edit-${row.id}`}
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={busy}
              >
                {updatePending ? 'Saving…' : 'Save'}
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                  disabled={busy}
                  onClick={(e) => {
                    if (!window.confirm(`Delete party “${row.name}”?`)) e.preventDefault()
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
  )
}
