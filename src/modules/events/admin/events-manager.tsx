'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { UserGroupOption } from '@/core/acl/types'

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
  type EventsAdminActionState,
} from '../actions'
import { EVENT_STATUSES } from '../types'
import { CoverAndAccessFields, toDatetimeLocalValue } from './events-form-fields'

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
  accessTags: string[]
  updatedAt: string
}

type VenueOpt = { id: string; name: string }

type Props = {
  events: EventRow[]
  venues: VenueOpt[]
  groups: UserGroupOption[]
  defaultTimezone: string
  statusFilter: string
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

function EventFields({
  row,
  venues,
  groups,
  defaultTimezone,
  busy,
}: {
  row?: EventRow
  venues: VenueOpt[]
  groups: UserGroupOption[]
  defaultTimezone: string
  busy: boolean
}) {
  return (
    <>
      <label className="settings-field">
        <span>Title</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          defaultValue={row?.title ?? ''}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <label className="settings-field">
        <span>Slug (optional)</span>
        <input
          type="text"
          name="slug"
          maxLength={120}
          defaultValue={row?.slug ?? ''}
          disabled={busy}
          autoComplete="off"
          placeholder="summer-meetup"
        />
      </label>
      <label className="settings-field">
        <span>Status</span>
        <select name="status" defaultValue={row?.status ?? 'draft'} disabled={busy}>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Starts</span>
        <input
          type="datetime-local"
          name="startsAt"
          defaultValue={toDatetimeLocalValue(row?.startsAt)}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Ends</span>
        <input
          type="datetime-local"
          name="endsAt"
          defaultValue={toDatetimeLocalValue(row?.endsAt)}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Timezone</span>
        <input
          type="text"
          name="timezone"
          maxLength={80}
          defaultValue={row?.timezone ?? defaultTimezone}
          disabled={busy}
          autoComplete="off"
          placeholder="Europe/Budapest"
        />
      </label>
      <label className="settings-field">
        <span>Venue</span>
        <select name="venueId" defaultValue={row?.venueId ?? ''} disabled={busy}>
          <option value="">— none —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Capacity (optional)</span>
        <input
          type="number"
          name="capacity"
          min={0}
          step={1}
          defaultValue={row?.capacity ?? ''}
          disabled={busy}
          placeholder="Unlimited"
        />
      </label>
      <label className="settings-field settings-field-wide">
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={row?.description ?? ''}
          disabled={busy}
        />
      </label>
      <input type="hidden" name="galleryMediaIdsJson" value="[]" />
      <CoverAndAccessFields
        coverMediaId={row?.coverMediaId ?? ''}
        accessTags={row?.accessTags ?? ['public']}
        groups={groups}
        disabled={busy}
      />
    </>
  )
}

export function EventsManager({
  events,
  venues,
  groups,
  defaultTimezone,
  statusFilter,
}: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createEventAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateEventAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEventAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  const busy = createPending || updatePending || deletePending

  return (
    <div className="sf-events-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Filter events">
        <h3>Filter by status</h3>
        <div className="admin-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link
            href="/admin/events"
            className={
              statusFilter === 'all' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
          >
            All
          </Link>
          {EVENT_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/events?status=${encodeURIComponent(s)}`}
              className={
                statusFilter === s ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
              }
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      <section className="outlines-create page-settings-panel" aria-label="Create event">
        <header className="page-settings-panel-head">
          <h3>Add event</h3>
        </header>
        <div className="page-settings-panel-body">
          {venues.length === 0 ? (
            <p className="settings-hint">
              Tip: create a <Link href="/admin/events/venues">venue</Link> first if you want
              a place binding.
            </p>
          ) : null}
          <form action={createAction} className="outlines-create-form admin-create-form">
            <EventFields
              venues={venues}
              groups={groups}
              defaultTimezone={defaultTimezone}
              busy={busy}
            />
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={createPending}
            >
              {createPending ? 'Adding…' : 'Add event'}
            </button>
          </form>
          <Feedback state={createState} />
        </div>
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap admin-settings-panel-wide">
        {events.length === 0 ? (
          <p className="admin-empty">No events yet. Add one above.</p>
        ) : (
          events.map((row) => (
            <section
              key={row.id}
              className="page-settings-panel"
              aria-label={`Edit event ${row.title}`}
            >
              <header className="page-settings-panel-head">
                <h3>
                  {row.title}{' '}
                  <span className="settings-hint">({row.status})</span>
                </h3>
                <span className="settings-hint">Updated {formatUpdated(row.updatedAt)}</span>
              </header>
              <div className="page-settings-panel-body">
                <form action={updateAction} className="outlines-create-form admin-create-form">
                  <input type="hidden" name="id" value={row.id} />
                  <EventFields
                    key={`${row.id}-${row.updatedAt}`}
                    row={row}
                    venues={venues}
                    groups={groups}
                    defaultTimezone={defaultTimezone}
                    busy={busy}
                  />
                  <div className="admin-inline-actions">
                    <button
                      type="submit"
                      className="gantry-toolbar-btn gantry-toolbar-btn-save"
                      disabled={busy}
                    >
                      {updatePending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
                <form action={deleteAction} className="admin-inline-actions">
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="gantry-btn"
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
            </section>
          ))
        )}
      </div>
    </div>
  )
}
