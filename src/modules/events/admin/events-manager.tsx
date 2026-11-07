'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { UserGroupOption } from '@/core/acl/types'

import {
  createEventAction,
  deleteEventAction,
  type EventsAdminActionState,
} from '../actions'
import { EVENT_STATUSES } from '../types'
import { EventFormFields } from './events-form-fields'

/** Re-export for PR1 smoke (`CoverAndAccessFields` / coverMediaId on Events manager). */
export { CoverAndAccessFields } from './events-form-fields'
// coverMediaId is written by CoverAndAccessFields inside EventFormFields.

type EventRow = {
  id: string
  title: string
  slug: string
  status: string
  startsAt: string | null
  endsAt: string | null
  timezone: string
  venueId: string
  venueName?: string
  description: string
  coverMediaId: string
  capacity: number | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  listed?: boolean
  accessTags: string[]
  registeredGuests?: number
  waitlistedGuests?: number
  updatedAt: string
}

type VenueOpt = { id: string; name: string }

function eventsListHref(opts: {
  status: string
  scope: 'all' | 'mine'
  organizer?: string
}): string {
  const parts = [
    opts.status && opts.status !== 'all'
      ? `status=${encodeURIComponent(opts.status)}`
      : '',
    opts.scope === 'mine' ? 'scope=mine' : '',
    opts.organizer ? `organizer=${encodeURIComponent(opts.organizer)}` : '',
  ].filter(Boolean)
  return parts.length ? `/admin/events?${parts.join('&')}` : '/admin/events'
}

type IdOpt = { id: string; label: string }

type Props = {
  events: EventRow[]
  venues: VenueOpt[]
  groups: UserGroupOption[]
  users?: IdOpt[]
  parties?: IdOpt[]
  defaultTimezone: string
  statusFilter: string
  scopeFilter?: 'all' | 'mine'
  organizerFilter?: string
  organizerOptions?: { id: string; label: string }[]
  /** Site Settings → Modules → Rich editor gate. */
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

/** Stable SSR/CSR stamp (avoid toLocaleString hydration mismatch). */
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

function formatAccess(tags: string[]): string {
  if (!tags.length || tags.includes('public')) return 'Public'
  if (tags.includes('registered')) return 'Registered'
  const groups = tags.filter((t) => t.startsWith('group:')).length
  if (groups > 0) return groups === 1 ? '1 group' : `${groups} groups`
  return tags.join(', ')
}

export function EventsManager({
  events,
  venues,
  groups,
  users = [],
  parties = [],
  defaultTimezone,
  statusFilter,
  scopeFilter = 'all',
  organizerFilter = '',
  organizerOptions = [],
  richEditorEnabled = true,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [createState, createAction, createPending] = useActionState(
    createEventAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEventAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(deleteState)

  function resetToListDefault() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  useEffect(() => {
    if (createState.ok && createState.id) {
      if (createState.after === 'apply') {
        router.push(`/admin/events/${createState.id}`)
        return
      }
      resetToListDefault()
      router.refresh()
      return
    }
    if (deleteState.ok) router.refresh()
  }, [createState, deleteState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const busy = createPending || deletePending
  const href = (next: {
    status?: string
    scope?: 'all' | 'mine'
    organizer?: string | null
  }) =>
    eventsListHref({
      status: next.status ?? statusFilter,
      scope: next.scope ?? scopeFilter,
      organizer:
        next.organizer === null
          ? undefined
          : next.organizer !== undefined
            ? next.organizer
            : organizerFilter || undefined,
    })

  return (
    <div className="sf-events-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add event">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-events-add-form"
            onClick={() => {
              if (createOpen) resetToListDefault()
              else setCreateOpen(true)
            }}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Create a new event — same card editor as the event page.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-events-add-form"
            action={createAction}
            className="sf-events-form-mosaic sf-events-add-form"
            aria-label="Create event"
          >
            <div className="sf-events-form-mosaic-intro settings-hint">
              <strong>Apply</strong> creates and opens the editor · <strong>Save</strong>{' '}
              creates and returns here · <strong>Cancel</strong> discards.
              {venues.length === 0 ? (
                <>
                  {' '}
                  Tip: create a <Link href="/admin/events/venues">venue</Link> first if you
                  want a place binding.
                </>
              ) : null}
            </div>
            <EventFormFields
              venues={venues}
              groups={groups}
              users={users}
              parties={parties}
              defaultTimezone={defaultTimezone}
              busy={busy}
              richEditorEnabled={richEditorEnabled}
            />
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
                onClick={resetToListDefault}
              >
                Cancel
              </button>
              <button
                type="submit"
                name="after"
                value="save"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
              >
                {createPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="submit"
                name="after"
                value="apply"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={createPending}
              >
                {createPending ? 'Applying…' : 'Apply'}
              </button>
            </div>
            <Feedback state={createState} />
          </form>
        ) : null}
      </section>

      <section className="outlines-create" aria-label="Filter events">
        <h3>Filter</h3>
        <div className="sf-events-filters">
          <div className="sf-events-filter-group" role="group" aria-label="Status">
            <Link
              href={href({ status: 'all' })}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                statusFilter === 'all' ? ' is-active' : ''
              }`}
              aria-current={statusFilter === 'all' ? 'true' : undefined}
            >
              All statuses
            </Link>
            {EVENT_STATUSES.map((s) => (
              <Link
                key={s}
                href={href({ status: s })}
                className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                  statusFilter === s ? ' is-active' : ''
                }`}
                aria-current={statusFilter === s ? 'true' : undefined}
              >
                {s}
              </Link>
            ))}
          </div>
          <div className="sf-events-filter-group" role="group" aria-label="Scope">
            <Link
              href={href({ scope: 'all' })}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                scopeFilter === 'all' ? ' is-active' : ''
              }`}
              aria-current={scopeFilter === 'all' ? 'true' : undefined}
            >
              All events
            </Link>
            <Link
              href={href({ scope: 'mine' })}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                scopeFilter === 'mine' ? ' is-active' : ''
              }`}
              aria-current={scopeFilter === 'mine' ? 'true' : undefined}
              title="Events where your user or groups are managers/helpers"
            >
              Managed by me
            </Link>
          </div>
          {organizerOptions.length > 0 ? (
            <div className="sf-events-filter-group" role="group" aria-label="Organizer">
              <Link
                href={href({ organizer: null })}
                className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                  !organizerFilter ? ' is-active' : ''
                }`}
                aria-current={!organizerFilter ? 'true' : undefined}
              >
                All organizers
              </Link>
              {organizerOptions.map((org) => (
                <Link
                  key={org.id}
                  href={href({ organizer: org.id })}
                  className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                    organizerFilter === org.id ? ' is-active' : ''
                  }`}
                  aria-current={organizerFilter === org.id ? 'true' : undefined}
                >
                  {org.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <Feedback state={deleteState} />

      {events.length === 0 ? (
        <section className="outlines-create" aria-label="Events list">
          <h3>No events yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> above to create one, then open it for ticket types.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Events list">
          <h3>Events</h3>
          <p className="settings-hint">
            Lean EB-style columns — title, when, venue, capacity, registrants, access,
            status. Open a title to edit.
          </p>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Event date</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Registrants</th>
                  <th scope="col">Waitlist</th>
                  <th scope="col">Access</th>
                  <th scope="col">Listed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/admin/events/${row.id}`}
                        className="sf-events-list-title"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="sf-events-list-num">{formatWhen(row.startsAt)}</td>
                    <td>{row.venueName?.trim() || '—'}</td>
                    <td className="sf-events-list-num">
                      {typeof row.capacity === 'number' ? row.capacity : '∞'}
                    </td>
                    <td className="sf-events-list-num">
                      <Link
                        href={`/admin/events/registrants?eventId=${encodeURIComponent(row.id)}`}
                      >
                        {row.registeredGuests ?? 0}
                      </Link>
                    </td>
                    <td className="sf-events-list-num">
                      <Link
                        href={`/admin/events/registrants?eventId=${encodeURIComponent(row.id)}`}
                      >
                        {row.waitlistedGuests ?? 0}
                      </Link>
                    </td>
                    <td>{formatAccess(row.accessTags)}</td>
                    <td className="sf-events-list-num">
                      {row.listed === false ? 'No' : 'Yes'}
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
                        <Link
                          href={`/admin/events/${row.id}`}
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                        >
                          Edit
                        </Link>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                            disabled={busy}
                            onClick={(e) => {
                              if (!window.confirm(`Delete event “${row.title}”?`)) {
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
    </div>
  )
}
