'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  updateRegistrationStatusAction,
  type EventsAdminActionState,
} from '../actions'

type EventOpt = { id: string; title: string }

type RegistrantRow = {
  id: string
  name: string
  email: string
  guests: number
  attendance: string
  status: string
  ticketTierId: string
  ticketTierTitle: string
  notes: string
  createdAt: string
}

type Props = {
  events: EventOpt[]
  eventId: string
  registrants: RegistrantRow[]
}

const STATUSES = ['registered', 'waitlisted', 'cancelled'] as const

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

function formatWhen(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

export function RegistrantsManager({ events, eventId, registrants }: Props) {
  const router = useRouter()
  const [statusState, statusAction, statusPending] = useActionState(
    updateRegistrationStatusAction,
    initial,
  )

  useNotifySavedOnOk(statusState)

  useEffect(() => {
    if (statusState.ok) router.refresh()
  }, [statusState, router])

  return (
    <div className="sf-events-registrants-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Select event">
        <h3>Event</h3>
        <div className="admin-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {events.length === 0 ? (
            <p className="admin-empty">
              Create an <Link href="/admin/events">event</Link> first.
            </p>
          ) : (
            events.map((ev) => (
              <Link
                key={ev.id}
                href={`/admin/events/registrants?eventId=${encodeURIComponent(ev.id)}`}
                className={
                  eventId === ev.id ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
                }
              >
                {ev.title}
              </Link>
            ))
          )}
        </div>
      </section>

      <Feedback state={statusState} />

      {!eventId || events.length === 0 ? null : registrants.length === 0 ? (
        <section className="outlines-create" aria-label="Registrants list">
          <h3>No registrants yet</h3>
          <p className="admin-empty">
            Signups from the public event form appear here. Manage{' '}
            <Link href={`/admin/events/tiers?eventId=${encodeURIComponent(eventId)}`}>
              ticket tiers
            </Link>{' '}
            for this event.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Registrants table">
          <h3>
            Registrants{' '}
            <span className="settings-hint">({registrants.length})</span>
          </h3>
          <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>Guests</th>
                  <th>Status</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrants.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.name || '—'}
                      {row.notes ? (
                        <div className="settings-hint" title={row.notes}>
                          note
                        </div>
                      ) : null}
                    </td>
                    <td>{row.email}</td>
                    <td>{row.ticketTierTitle || '—'}</td>
                    <td>
                      {row.guests}
                      <span className="settings-hint"> · {row.attendance}</span>
                    </td>
                    <td>{row.status}</td>
                    <td>{formatWhen(row.createdAt)}</td>
                    <td>
                      <form action={statusAction} className="admin-inline-form">
                        <input type="hidden" name="id" value={row.id} />
                        <select
                          name="status"
                          defaultValue={row.status}
                          disabled={statusPending}
                          aria-label={`Status for ${row.email}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={statusPending}
                        >
                          Update
                        </button>
                      </form>
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
