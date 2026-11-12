'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  checkInRegistrationAdminAction,
  clearCheckInRegistrationAdminAction,
  type EventsAdminActionState,
} from '../actions'

type EventOpt = {
  id: string
  title: string
  startsAt: string | null
}

type RegistrantRow = {
  id: string
  name: string
  email: string
  guests: number
  status: string
  ticketTierTitle: string
  checkedInAt: string | null
}

type Props = {
  events: EventOpt[]
  eventId: string
  /** From QR deep link — focus this registrant and open Check in. */
  registrationId?: string
  registrants: RegistrantRow[]
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

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toISOString().replace('T', ' ').slice(0, 16)
  } catch {
    return '—'
  }
}

function EventSearchPicker({
  events,
  eventId,
}: {
  events: EventOpt[]
  eventId: string
}) {
  const router = useRouter()
  const active = events.find((e) => e.id === eventId)
  const [query, setQuery] = useState(active?.title ?? '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(active?.title ?? '')
  }, [active?.title, eventId])

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const list =
      q.length === 0
        ? events.slice(0, 12)
        : events
            .filter(
              (e) =>
                e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
            )
            .slice(0, 12)
    return list
  }, [events, q])

  function select(ev: EventOpt) {
    setQuery(ev.title)
    setOpen(false)
    router.push(`/admin/events/check-in?eventId=${encodeURIComponent(ev.id)}`)
  }

  return (
    <div className="sf-events-event-search settings-field">
      <span>Event</span>
      <div className="sf-events-id-suggest-input-wrap">
        <input
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Search events…"
          aria-label="Search events"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[0]) select(matches[0])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && matches.length > 0 ? (
          <ul className="sf-events-id-suggest-menu" role="listbox">
            {matches.map((ev) => (
              <li key={ev.id} role="option">
                <button
                  type="button"
                  className="sf-events-id-suggest-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(ev)}
                >
                  {ev.title}
                  <span className="settings-hint">
                    {' '}
                    · {formatWhen(ev.startsAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {active ? (
        <p className="settings-hint">
          Selected:{' '}
          <Link href={`/admin/events/${encodeURIComponent(active.id)}`}>
            {active.title}
          </Link>
        </p>
      ) : (
        <p className="settings-hint">Type to find an event.</p>
      )}
    </div>
  )
}

export function CheckInManager({
  events,
  eventId,
  registrationId = '',
  registrants,
}: Props) {
  const router = useRouter()
  const focusId = registrationId.trim()
  const focusRow = useMemo(
    () => registrants.find((r) => r.id === focusId) ?? null,
    [registrants, focusId],
  )
  const [nameQuery, setNameQuery] = useState(() =>
    focusRow?.status === 'registered' ? focusRow.name : '',
  )

  useEffect(() => {
    if (focusRow?.status === 'registered') {
      setNameQuery(focusRow.name)
    }
  }, [focusRow?.id, focusRow?.name, focusRow?.status])

  const [checkInState, checkInAction, checkInPending] = useActionState(
    checkInRegistrationAdminAction,
    initial,
  )
  const [clearState, clearAction, clearPending] = useActionState(
    clearCheckInRegistrationAdminAction,
    initial,
  )

  useNotifySavedOnOk(checkInState)
  useNotifySavedOnOk(clearState)

  useEffect(() => {
    if (checkInState.ok || clearState.ok) {
      router.refresh()
    }
  }, [checkInState, clearState, router])

  const busy = checkInPending || clearPending
  const active = events.find((e) => e.id === eventId)

  const eligible = useMemo(
    () => registrants.filter((r) => r.status === 'registered'),
    [registrants],
  )

  const q = nameQuery.trim().toLowerCase()
  const matches = useMemo(() => {
    if (q.length === 0) return eligible
    return eligible.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    )
  }, [eligible, q])

  const checkedCount = eligible.filter((r) => r.checkedInAt).length
  const scannedEligible =
    focusRow && focusRow.status === 'registered' ? focusRow : null

  return (
    <div className="sf-events-check-in-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Select event">
        <h3>Event</h3>
        {events.length === 0 ? (
          <p className="admin-empty">
            Create an <Link href="/admin/events">event</Link> first.
          </p>
        ) : (
          <EventSearchPicker events={events} eventId={eventId} />
        )}
      </section>

      {scannedEligible ? (
        <section className="outlines-create" aria-label="Scanned ticket">
          <h3>Scanned ticket</h3>
          <p className="settings-hint">
            QR opened check-in for this guest. Confirm with Check in, or Undo if already
            marked.
          </p>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Checked in</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-scanned-ticket">
                  <td>{scannedEligible.name || '—'}</td>
                  <td className="sf-events-list-wrap">{scannedEligible.email}</td>
                  <td>{scannedEligible.ticketTierTitle || '—'}</td>
                  <td className="sf-events-list-num">{scannedEligible.guests}</td>
                  <td className="sf-events-list-num">
                    {scannedEligible.checkedInAt
                      ? formatWhen(scannedEligible.checkedInAt)
                      : '—'}
                  </td>
                  <td>
                    <div className="admin-action-row sf-events-list-row-actions">
                      {scannedEligible.checkedInAt ? (
                        <form action={clearAction}>
                          <input type="hidden" name="id" value={scannedEligible.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                            disabled={busy}
                          >
                            {clearPending ? '…' : 'Undo'}
                          </button>
                        </form>
                      ) : (
                        <form action={checkInAction}>
                          <input type="hidden" name="id" value={scannedEligible.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-save"
                            disabled={busy}
                            autoFocus
                          >
                            {checkInPending ? '…' : 'Check in'}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : focusId && eventId ? (
        <section className="outlines-create" aria-label="Scanned ticket">
          <h3>Scanned ticket</h3>
          <p className="admin-empty">
            No registered guest matches that QR for this event (wrong event, waitlisted,
            or cancelled).
          </p>
        </section>
      ) : null}

      {eventId && events.length > 0 ? (
        <section className="outlines-create" aria-label="Search registrant">
          <h3>Search by name</h3>
          <label className="settings-field">
            <span>Name</span>
            <input
              type="search"
              value={nameQuery}
              autoComplete="off"
              autoFocus={!scannedEligible}
              placeholder="Type a registrant name…"
              aria-label="Search registrants by name"
              onChange={(e) => setNameQuery(e.target.value)}
            />
          </label>
          <p className="settings-hint">
            Premium door check-in (name or QR). Registered guests:{' '}
            <strong>
              {checkedCount}/{eligible.length}
            </strong>{' '}
            checked in
            {active?.title ? ` · ${active.title}` : ''}.
          </p>
        </section>
      ) : null}

      <Feedback state={checkInState} />
      <Feedback state={clearState} />

      {!eventId || events.length === 0 ? null : eligible.length === 0 ? (
        <section className="outlines-create" aria-label="Check-in list">
          <h3>No registered guests</h3>
          <p className="admin-empty">
            Only <strong>registered</strong> guests can check in. Manage list:{' '}
            <Link
              href={`/admin/events/registrants?eventId=${encodeURIComponent(eventId)}`}
            >
              Events → Registrants
            </Link>
            .
          </p>
        </section>
      ) : matches.length === 0 ? (
        <section className="outlines-create" aria-label="Check-in list">
          <h3>No matches</h3>
          <p className="admin-empty">
            No registered guest matches “{nameQuery.trim()}”.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Check-in list">
          <h3>
            Guests
            {q ? ` matching “${nameQuery.trim()}”` : ''}{' '}
            <span className="settings-hint">({matches.length})</span>
          </h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Checked in</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((row) => {
                  const isIn = Boolean(row.checkedInAt)
                  const isFocus = row.id === focusId
                  return (
                    <tr
                      key={row.id}
                      className={isFocus ? 'is-scanned-ticket' : undefined}
                    >
                      <td>{row.name || '—'}</td>
                      <td className="sf-events-list-wrap">{row.email}</td>
                      <td>{row.ticketTierTitle || '—'}</td>
                      <td className="sf-events-list-num">{row.guests}</td>
                      <td className="sf-events-list-num">
                        {isIn ? formatWhen(row.checkedInAt) : '—'}
                      </td>
                      <td>
                        <div className="admin-action-row sf-events-list-row-actions">
                          {isIn ? (
                            <form action={clearAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <button
                                type="submit"
                                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                                disabled={busy}
                              >
                                {clearPending ? '…' : 'Undo'}
                              </button>
                            </form>
                          ) : (
                            <form action={checkInAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <button
                                type="submit"
                                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                                disabled={busy}
                              >
                                {checkInPending ? '…' : 'Check in'}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
