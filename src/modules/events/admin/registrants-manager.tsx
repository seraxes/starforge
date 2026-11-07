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
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
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

  const activeTitle = events.find((e) => e.id === eventId)?.title

  return (
    <div className="sf-events-registrants-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Select event">
        <h3>Event</h3>
        <p className="settings-hint">Pick an event to review signups and waitlist.</p>
        <div className="sf-events-filters">
          <div className="sf-events-filter-group" role="group" aria-label="Events">
            {events.length === 0 ? (
              <p className="admin-empty">
                Create an <Link href="/admin/events">event</Link> first.
              </p>
            ) : (
              events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/admin/events/registrants?eventId=${encodeURIComponent(ev.id)}`}
                  className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                    eventId === ev.id ? ' is-active' : ''
                  }`}
                  aria-current={eventId === ev.id ? 'true' : undefined}
                >
                  {ev.title}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <Feedback state={statusState} />

      {!eventId || events.length === 0 ? null : registrants.length === 0 ? (
        <section className="outlines-create" aria-label="Registrants list">
          <h3>No registrants yet</h3>
          <p className="admin-empty">
            Signups for {activeTitle || 'this event'} appear here. Manage{' '}
            <Link href={`/admin/events/tiers?eventId=${encodeURIComponent(eventId)}`}>
              ticket types
            </Link>{' '}
            or open the{' '}
            <Link href={`/admin/events/${encodeURIComponent(eventId)}`}>event editor</Link>.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Registrants table">
          <h3>
            Registrants
            {activeTitle ? ` · ${activeTitle}` : ''}{' '}
            <span className="settings-hint">({registrants.length})</span>
          </h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Tier</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Status</th>
                  <th scope="col">When</th>
                  <th scope="col">Actions</th>
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
                    <td className="sf-events-list-wrap">{row.email}</td>
                    <td>{row.ticketTierTitle || '—'}</td>
                    <td className="sf-events-list-num">
                      {row.guests}
                      <span className="settings-hint"> · {row.attendance}</span>
                    </td>
                    <td>
                      <span
                        className={`sf-events-status-pill sf-events-status-${row.status}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="sf-events-list-num">{formatWhen(row.createdAt)}</td>
                    <td>
                      <form action={statusAction} className="sf-events-reg-status-form">
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
