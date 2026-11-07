'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createMapRoomAction,
  deleteMapRoomAction,
  updateMapRoomAction,
} from '../actions'

type RoomRow = {
  id: string
  eventId: string
  title: string
  active: boolean
  eventTitle: string
}

type EventOption = { id: string; label: string }

export function MapsRoomsManager({
  rooms,
  eventOptions,
}: {
  rooms: RoomRow[]
  eventOptions: EventOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [eventId, setEventId] = useState(eventOptions[0]?.id || '')
  const [title, setTitle] = useState('Live map')
  const [seed, setSeed] = useState(true)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')

  function resetCreate() {
    setCreateOpen(false)
    setError('')
    setTitle('Live map')
    setSeed(true)
    setEventId(eventOptions[0]?.id || '')
  }

  function create() {
    setError('')
    setOkMessage('')
    startTransition(async () => {
      const result = await createMapRoomAction({
        eventId,
        title,
        seedFromFactions: seed,
      })
      if (!result.ok) {
        setError(result.error)
        setCreateOpen(true)
        return
      }
      router.push(`/admin/maps/${result.roomId}`)
      router.refresh()
    })
  }

  return (
    <div className="sf-maps-rooms-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add live map room">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-maps-add-form"
            disabled={pending}
            onClick={() => {
              if (createOpen) resetCreate()
              else setCreateOpen(true)
            }}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Bind a closed tactical room to an event — teams and roster next.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <div id="sf-maps-add-form" className="sf-events-add-inline-form sf-events-form-mosaic">
            <label className="settings-field">
              <span>Event</span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={!eventOptions.length || pending}
              >
                {!eventOptions.length ? (
                  <option value="">All events already have a room</option>
                ) : (
                  eventOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="settings-field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Seed from factions</span>
              <span className="settings-hint">
                <input
                  type="checkbox"
                  checked={seed}
                  onChange={(e) => setSeed(e.target.checked)}
                  disabled={pending}
                />{' '}
                Create teams/roster from faction ticket types (still editable)
              </span>
            </label>
            {error ? (
              <p className="admin-inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={pending}
                onClick={resetCreate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={!eventId || pending}
                onClick={create}
              >
                {pending ? 'Creating…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {okMessage ? (
        <p className="admin-inline-ok" role="status">
          {okMessage}
        </p>
      ) : null}

      {rooms.length === 0 ? (
        <section className="outlines-create" aria-label="Live maps list">
          <h3>No live map rooms yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> to bind a room to an event.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Live maps list">
          <h3>Rooms</h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Event</th>
                  <th scope="col">Active</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      <Link
                        href={`/admin/maps/${room.id}`}
                        className="sf-events-list-title"
                      >
                        {room.title}
                      </Link>
                    </td>
                    <td className="sf-events-list-wrap">{room.eventTitle}</td>
                    <td>{room.active ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <Link
                          href={`/admin/maps/${room.id}`}
                          className="gantry-toolbar-btn"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              await updateMapRoomAction({
                                roomId: room.id,
                                active: !room.active,
                              })
                              setOkMessage(
                                room.active ? 'Room deactivated.' : 'Room activated.',
                              )
                              router.refresh()
                            })
                          }}
                        >
                          {room.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm('Delete this live map room?')) return
                            startTransition(async () => {
                              await deleteMapRoomAction(room.id)
                              setOkMessage('Room deleted.')
                              router.refresh()
                            })
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
