'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { UserGroupOption } from '@/core/acl/types'

import {
  deleteEventAction,
  duplicateEventAction,
  updateEventAction,
  type EventsAdminActionState,
} from '../actions'
import { EventFormFields, type EventFormRow } from './events-form-fields'
import { TiersManager } from './tiers-manager'

type VenueOpt = { id: string; name: string }
type IdOpt = { id: string; label: string }

type TierRow = {
  id: string
  eventId: string
  title: string
  shortDescription: string
  description: string
  kind: string
  capacity: number | null
  maxPerBooking: number | null
  price: number | null
  priceModifier: number
  priceModifierMode: 'amount' | 'percent'
  priceLabel: string
  titleColor: string
  borderColor: string
  backgroundColor: string
  sortOrder: number
  occupied: number
  updatedAt: string
}

type Props = {
  event: EventFormRow & { id: string; updatedAt: string }
  venues: VenueOpt[]
  groups: UserGroupOption[]
  users: IdOpt[]
  parties: IdOpt[]
  relatedEventOptions: IdOpt[]
  defaultTimezone: string
  richEditorEnabled: boolean
  tiers: TierRow[]
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

export function EventEditor({
  event,
  venues,
  groups,
  users,
  parties,
  relatedEventOptions,
  defaultTimezone,
  richEditorEnabled,
  tiers,
}: Props) {
  const router = useRouter()
  const [updateState, updateAction, updatePending] = useActionState(
    updateEventAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEventAction,
    initial,
  )
  const [dupState, dupAction, dupPending] = useActionState(
    duplicateEventAction,
    initial,
  )

  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(dupState)

  useEffect(() => {
    if (deleteState.ok) {
      router.push('/admin/events')
      return
    }
    if (dupState.ok && dupState.id) {
      router.push(`/admin/events/${dupState.id}`)
      return
    }
    if (updateState.ok) {
      if (updateState.after === 'save') {
        router.push('/admin/events')
        return
      }
      router.refresh()
    }
  }, [updateState, deleteState, dupState, router])

  const busy = updatePending || deletePending || dupPending
  const formId = `event-edit-${event.id}`

  return (
    <div className="sf-events-editor sf-events-form-mosaic">
      <div className="sf-events-form-mosaic-intro settings-hint">
        <strong>Apply</strong> saves and stays · <strong>Save</strong> saves and returns to
        the list · <strong>Cancel</strong> discards. Updated{' '}
        {Number.isNaN(new Date(event.updatedAt).getTime())
          ? '—'
          : `${new Date(event.updatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC`}
        .
      </div>

      <form id={formId} action={updateAction} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={event.id} />
        <EventFormFields
          key={`${event.id}-${event.updatedAt}`}
          row={event}
          venues={venues}
          groups={groups}
          users={users}
          parties={parties}
          relatedEventOptions={relatedEventOptions}
          defaultTimezone={defaultTimezone}
          busy={busy}
          richEditorEnabled={richEditorEnabled}
        />
      </form>

      <Feedback state={updateState} />
      <Feedback state={dupState} />

      <section
        className="outlines-create sf-events-form-section-wide"
        aria-label="Ticket types"
      >
        <h3>Ticket types</h3>
        <p className="settings-hint">
          Add and edit this event’s ticket / faction slots here (EB-style, under the event).
          Cross-event shortcut:{' '}
          <Link href={`/admin/events/tiers?eventId=${encodeURIComponent(event.id)}`}>
            Events → Ticket types
          </Link>
          .
        </p>
        <TiersManager
          embedded
          events={[{ id: event.id, title: event.title || 'Event' }]}
          eventId={event.id}
          tiers={tiers}
        />
      </section>

      <section className="outlines-create" aria-label="Registrants">
        <h3>Registrants</h3>
        <p className="settings-hint">Review signup rows and waitlist status.</p>
        <div className="admin-inline-actions">
          <Link
            href={`/admin/events/registrants?eventId=${encodeURIComponent(event.id)}`}
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          >
            Open registrants
          </Link>
        </div>
      </section>

      <div className="sf-events-form-actions admin-action-row">
        <Link
          href="/admin/events"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          onClick={(e) => {
            if (
              !window.confirm(
                'Discard unsaved changes and return to the events list?',
              )
            ) {
              e.preventDefault()
            }
          }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          form={formId}
          name="after"
          value="save"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
        >
          {updatePending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="submit"
          form={formId}
          name="after"
          value="apply"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy}
        >
          {updatePending ? 'Applying…' : 'Apply'}
        </button>
        <form action={dupAction}>
          <input type="hidden" name="id" value={event.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {dupPending ? 'Duplicating…' : 'Duplicate'}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={event.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
            disabled={busy}
            onClick={(e) => {
              if (!window.confirm(`Delete event “${event.title}”?`)) {
                e.preventDefault()
              }
            }}
          >
            {deletePending ? 'Deleting…' : 'Delete'}
          </button>
        </form>
      </div>
      <Feedback state={deleteState} />
    </div>
  )
}
