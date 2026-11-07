'use client'

import React, { useActionState, useEffect } from 'react'
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
  description: string
  coverMediaId: string
  capacity: number | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  accessTags: string[]
  updatedAt: string
}

type VenueOpt = { id: string; name: string }

function eventsListHref(status: string, scope: 'all' | 'mine'): string {
  const parts = [
    status && status !== 'all' ? `status=${encodeURIComponent(status)}` : '',
    scope === 'mine' ? 'scope=mine' : '',
  ].filter(Boolean)
  return parts.length ? `/admin/events?${parts.join('&')}` : '/admin/events'
}

type Props = {
  events: EventRow[]
  venues: VenueOpt[]
  groups: UserGroupOption[]
  defaultTimezone: string
  statusFilter: string
  scopeFilter?: 'all' | 'mine'
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

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

export function EventsManager({
  events,
  venues,
  groups,
  defaultTimezone,
  statusFilter,
  scopeFilter = 'all',
  richEditorEnabled = true,
}: Props) {
  const router = useRouter()
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

  useEffect(() => {
    if (createState.ok && createState.id) {
      router.push(`/admin/events/${createState.id}`)
      return
    }
    if (deleteState.ok) router.refresh()
  }, [createState, deleteState, router])

  const busy = createPending || deletePending

  return (
    <div className="sf-events-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Filter events">
        <h3>Filter</h3>
        <div className="admin-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link
            href={eventsListHref('all', scopeFilter)}
            className={
              statusFilter === 'all' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
          >
            All statuses
          </Link>
          {EVENT_STATUSES.map((s) => (
            <Link
              key={s}
              href={eventsListHref(s, scopeFilter)}
              className={
                statusFilter === s ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
              }
            >
              {s}
            </Link>
          ))}
        </div>
        <div
          className="admin-inline-actions"
          style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}
        >
          <Link
            href={eventsListHref(statusFilter, 'all')}
            className={
              scopeFilter === 'all' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
          >
            All events
          </Link>
          <Link
            href={eventsListHref(statusFilter, 'mine')}
            className={
              scopeFilter === 'mine' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
            title="Events where your user or groups are managers/helpers"
          >
            Managed by me
          </Link>
        </div>
      </section>

      <section className="outlines-create" aria-label="Create event">
        <h3>Add event</h3>
        {venues.length === 0 ? (
          <p className="settings-hint">
            Tip: create a <Link href="/admin/events/venues">venue</Link> first if you want a place
            binding.
          </p>
        ) : null}
        <form action={createAction} className="outlines-create-form admin-create-form">
          <EventFormFields
            compact
            venues={venues}
            groups={groups}
            defaultTimezone={defaultTimezone}
            busy={busy}
            richEditorEnabled={richEditorEnabled}
          />
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={createPending}
            >
              {createPending ? 'Adding…' : 'Add event'}
            </button>
          </div>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={deleteState} />

      {events.length === 0 ? (
        <section className="outlines-create" aria-label="Events list">
          <h3>No events yet</h3>
          <p className="admin-empty">Add one above to open the event editor.</p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Events list">
          <h3>Events</h3>
          <ul className="sf-events-list">
            {events.map((row) => (
              <li key={row.id} className="sf-events-list-item">
                <div className="sf-events-list-main">
                  <Link
                    href={`/admin/events/${row.id}`}
                    className="sf-events-list-title"
                  >
                    {row.title}
                  </Link>
                  <span className="settings-hint">
                    {row.status} · updated {formatUpdated(row.updatedAt)}
                  </span>
                </div>
                <div className="admin-action-row">
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
                      {deletePending ? 'Deleting…' : 'Delete'}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
