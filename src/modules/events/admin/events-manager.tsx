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
function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  } catch {
    return '—'
  }
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

      <section className="outlines-create" aria-label="Create event">
        <h3>Add event</h3>
        <p className="settings-hint">
          Same sections as the editor (basics, gallery, schedule, registration, people,
          visibility). After save you land on the event page for tiers and registrants.
          {venues.length === 0 ? (
            <>
              {' '}
              Tip: create a <Link href="/admin/events/venues">venue</Link> first if you want a
              place binding.
            </>
          ) : null}
        </p>
        <form action={createAction} className="outlines-create-form admin-create-form">
          <EventFormFields
            venues={venues}
            groups={groups}
            users={users}
            parties={parties}
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
