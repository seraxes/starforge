'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createRegistrationAdminAction,
  deleteRegistrationAdminAction,
  emailEventRegistrantsAction,
  updateRegistrationAdminAction,
  updateRegistrationStatusAction,
  type EventsAdminActionState,
} from '../actions'

type EventOpt = {
  id: string
  title: string
  startsAt: string | null
}

type TierOpt = { id: string; title: string }

type UserOpt = {
  id: string
  label: string
  name: string
  email: string
}

type RegistrantRow = {
  id: string
  name: string
  email: string
  guests: number
  attendance: string
  status: string
  ticketTierId: string
  ticketTierTitle: string
  userId?: string
  notes: string
  createdAt: string
  checkedInAt: string | null
}

type EmailTemplateOpt = { id: string; label: string }

type Props = {
  events: EventOpt[]
  eventId: string
  registrants: RegistrantRow[]
  tiers: TierOpt[]
  users: UserOpt[]
  emailTemplates?: EmailTemplateOpt[]
}

const STATUSES = ['registered', 'pending', 'waitlisted', 'cancelled'] as const
const ATTENDANCES = ['in_person', 'online', 'hybrid'] as const

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

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '—', last: '—' }
  if (parts.length === 1) return { first: parts[0], last: '—' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function UserPickSearch({
  users,
  userId,
  disabled,
  onPick,
  onClear,
}: {
  users: UserOpt[]
  userId: string
  disabled?: boolean
  onPick: (user: UserOpt) => void
  onClear: () => void
}) {
  const selected = users.find((u) => u.id === userId)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (q.length === 0) return users.slice(0, 10)
    return users
      .filter(
        (u) =>
          u.label.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [users, q])

  return (
    <div className="settings-field sf-events-user-pick">
      <span>Pick user</span>
      <p className="settings-hint">
        Search existing accounts — selecting fills name / email and links the user.
      </p>
      {selected ? (
        <div className="sf-events-id-chips" aria-label="Selected user">
          <span className="sf-events-id-chip">
            <span title={selected.id}>{selected.label}</span>
            <button
              type="button"
              className="sf-events-id-chip-remove"
              disabled={disabled}
              aria-label="Clear selected user"
              onClick={() => {
                setQuery('')
                onClear()
              }}
            >
              ×
            </button>
          </span>
        </div>
      ) : null}
      <div className="sf-events-id-suggest-input-wrap">
        <input
          type="search"
          value={query}
          disabled={disabled || users.length === 0}
          autoComplete="off"
          placeholder={
            users.length === 0 ? 'No users yet' : 'Search users by name or email…'
          }
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
              if (matches[0]) {
                onPick(matches[0])
                setQuery('')
                setOpen(false)
              }
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && matches.length > 0 ? (
          <ul className="sf-events-id-suggest-menu" role="listbox">
            {matches.map((u) => (
              <li key={u.id} role="option">
                <button
                  type="button"
                  className="sf-events-id-suggest-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(u)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input type="hidden" name="userId" value={userId} />
    </div>
  )
}

function RegistrantFields({
  row,
  tiers,
  users,
  busy,
  eventId,
}: {
  row?: RegistrantRow
  tiers: TierOpt[]
  users: UserOpt[]
  busy: boolean
  eventId: string
}) {
  const [userId, setUserId] = useState(row?.userId ?? '')
  const [name, setName] = useState(row?.name ?? '')
  const [email, setEmail] = useState(row?.email ?? '')

  return (
    <div className="sf-events-form-mosaic sf-registrants-form-mosaic">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
        <legend>User</legend>
        <UserPickSearch
          users={users}
          userId={userId}
          disabled={busy}
          onPick={(u) => {
            setUserId(u.id)
            setName(u.name || u.email || name)
            setEmail(u.email || email)
          }}
          onClear={() => setUserId('')}
        />
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Basics</legend>
        <label className="settings-field">
          <span>Name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            value={name}
            disabled={busy}
            autoComplete="off"
            placeholder="Full name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            required
            maxLength={320}
            value={email}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>Guests</span>
          <input
            type="number"
            name="guests"
            min={1}
            max={20}
            step={1}
            defaultValue={row?.guests ?? 1}
            disabled={busy}
          />
        </label>
        <label className="settings-field">
          <span>Attendance</span>
          <select
            name="attendance"
            defaultValue={row?.attendance || 'in_person'}
            disabled={busy}
          >
            {ATTENDANCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Ticket / status</legend>
        <label className="settings-field">
          <span>Ticket type</span>
          <select
            name="ticketTierId"
            defaultValue={row?.ticketTierId ?? ''}
            disabled={busy}
          >
            <option value="">— none —</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Status</span>
          <select
            name="status"
            defaultValue={row?.status || 'registered'}
            disabled={busy}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field settings-field-wide">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={row?.notes ?? ''}
            disabled={busy}
          />
        </label>
      </fieldset>
    </div>
  )
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
    router.push(`/admin/events/registrants?eventId=${encodeURIComponent(ev.id)}`)
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

export function RegistrantsManager({
  events,
  eventId,
  registrants,
  tiers,
  users,
  emailTemplates = [],
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [createState, createAction, createPending] = useActionState(
    createRegistrationAdminAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateRegistrationAdminAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteRegistrationAdminAction,
    initial,
  )
  const [statusState, statusAction, statusPending] = useActionState(
    updateRegistrationStatusAction,
    initial,
  )
  const [emailState, emailAction, emailPending] = useActionState(
    emailEventRegistrantsAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(statusState)
  useNotifySavedOnOk(emailState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      router.refresh()
      return
    }
    if (updateState.ok || deleteState.ok || statusState.ok || emailState.ok) {
      if (deleteState.ok) setEditingId(null)
      router.refresh()
    }
  }, [createState, updateState, deleteState, statusState, emailState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const busy =
    createPending || updatePending || deletePending || statusPending || emailPending
  const registeredCount = useMemo(
    () => registrants.filter((r) => r.status === 'registered' && r.email.includes('@')).length,
    [registrants],
  )
  const active = events.find((e) => e.id === eventId)
  const editing = editingId
    ? registrants.find((r) => r.id === editingId)
    : null

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="sf-events-registrants-manager admin-settings-mosaic">
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

      {eventId && events.length > 0 ? (
        <section className="outlines-create sf-events-add-panel" aria-label="Add registrant">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
              aria-expanded={createOpen}
              aria-controls="sf-registrants-add-form"
              disabled={!eventId}
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
            <a
              href={`/api/admin/events/registrants/export?eventId=${encodeURIComponent(eventId)}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            >
              Export CSV
            </a>
            <Link
              href={`/admin/events/check-in?eventId=${encodeURIComponent(eventId)}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            >
              Door check-in
            </Link>
            <form action={emailAction} className="sf-events-email-registrants-row gantry-inherit-copy-row-inline">
              <input type="hidden" name="eventId" value={eventId} />
              <label className="settings-field">
                <span className="visually-hidden">Email template</span>
                <select
                  name="templateId"
                  defaultValue={emailTemplates[0]?.id || ''}
                  disabled={busy || emailTemplates.length === 0 || registeredCount === 0}
                  aria-label="Email template for registrants"
                  title="Email template"
                >
                  {emailTemplates.length === 0 ? (
                    <option value="">No Email Manager templates</option>
                  ) : (
                    emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="submit"
                className="gantry-toolbar-btn"
                disabled={busy || emailTemplates.length === 0 || registeredCount === 0}
                title={`Email ${registeredCount} registered attendees (paced via Email Manager)`}
              >
                {emailPending ? 'Queuing…' : `Email registrants (${registeredCount})`}
              </button>
            </form>
            {!createOpen ? (
              <p className="settings-hint sf-events-add-hint">
                Manually add a registrant for {active?.title || 'this event'}.
              </p>
            ) : null}
          </div>
          <Feedback state={emailState} />

          {createOpen ? (
            <form
              key={formKey}
              id="sf-registrants-add-form"
              action={createAction}
              className="sf-events-add-inline-form"
            >
              <RegistrantFields
                eventId={eventId}
                tiers={tiers}
                users={users}
                busy={busy}
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
      ) : null}

      <Feedback state={updateState} />
      <Feedback state={deleteState} />
      <Feedback state={statusState} />

      {!eventId || events.length === 0 ? null : registrants.length === 0 ? (
        <section className="outlines-create" aria-label="Registrants list">
          <h3>No registrants yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> or wait for public signups. Ticket types:{' '}
            <Link href={`/admin/events/tiers?eventId=${encodeURIComponent(eventId)}`}>
              Events → Ticket types
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Registrants table">
          <h3>
            Registrants
            {active?.title ? ` · ${active.title}` : ''}{' '}
            <span className="settings-hint">({registrants.length})</span>
          </h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">First name</th>
                  <th scope="col">Last name</th>
                  <th scope="col">Event</th>
                  <th scope="col">Event date</th>
                  <th scope="col">Email</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Checked in</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrants.map((row) => {
                  const { first, last } = splitName(row.name || '')
                  return (
                    <tr
                      key={row.id}
                      className={editingId === row.id ? 'is-editing' : undefined}
                    >
                      <td>
                        {first}
                        {row.notes ? (
                          <div className="settings-hint" title={row.notes}>
                            note
                          </div>
                        ) : null}
                      </td>
                      <td>{last}</td>
                      <td>
                        <Link
                          href={`/admin/events/${encodeURIComponent(eventId)}`}
                          className="sf-events-list-title"
                        >
                          {active?.title || 'Event'}
                        </Link>
                      </td>
                      <td className="sf-events-list-num">
                        {formatWhen(active?.startsAt ?? null)}
                      </td>
                      <td className="sf-events-list-wrap">{row.email}</td>
                      <td className="sf-events-list-num">{row.guests}</td>
                      <td>{row.ticketTierTitle || '—'}</td>
                      <td className="sf-events-list-num">
                        {formatWhen(row.createdAt)}
                      </td>
                      <td className="sf-events-list-num">
                        {formatWhen(row.checkedInAt)}
                      </td>
                      <td>
                        <span
                          className={`sf-events-status-pill sf-events-status-${row.status}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-action-row sf-events-list-row-actions">
                          {row.status === 'pending' ? (
                            <form action={statusAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <input type="hidden" name="status" value="registered" />
                              <button
                                type="submit"
                                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                                disabled={busy}
                              >
                                {statusPending ? '…' : 'Approve'}
                              </button>
                            </form>
                          ) : null}
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
                                if (
                                  !window.confirm(
                                    `Delete registrant “${row.name || row.email}”?`,
                                  )
                                ) {
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <section
          className="outlines-create sf-events-inline-editor"
          aria-label={`Edit registrant ${editing.name}`}
        >
          <h3>Edit · {editing.name || editing.email}</h3>
          <form
            key={`${editing.id}-${editing.createdAt}`}
            id={`reg-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <RegistrantFields
              row={editing}
              eventId={eventId}
              tiers={tiers}
              users={users}
              busy={busy}
            />
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
              form={`reg-edit-${editing.id}`}
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
