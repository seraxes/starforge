'use client'

import React, { useState } from 'react'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import { MediaPicker } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

import { EVENT_STATUSES } from '../types'

type CoverAndAccessProps = {
  coverMediaId: string
  accessTags: string[]
  groups: UserGroupOption[]
  disabled?: boolean
  coverLabel?: string
}

/**
 * Shared Media cover + ACL tags for venue/event forms.
 * Writes hidden inputs `coverMediaId` + `accessTagsJson` for FormData actions.
 */
export function CoverAndAccessFields({
  coverMediaId: initialCover,
  accessTags: initialTags,
  groups,
  disabled,
  coverLabel = 'Cover',
}: CoverAndAccessProps) {
  const [coverMediaId, setCoverMediaId] = useState(initialCover)
  const [accessTags, setAccessTags] = useState(
    initialTags.length > 0 ? initialTags : ['public'],
  )

  return (
    <>
      <div className="settings-field">
        <MediaPicker
          label={coverLabel}
          value={{ mediaId: coverMediaId, url: '', alt: '' }}
          defaultFolder="general"
          defaultPurpose="photo"
          disabled={disabled}
          includeHiddenInputs={false}
          allowUrlFallback={false}
          hint="Bind a Media library id — shared Media Manager, not a per-module library."
          onChange={(next) => setCoverMediaId(next.mediaId)}
        />
        <input type="hidden" name="coverMediaId" value={coverMediaId} />
      </div>
      <AccessTagsField
        value={accessTags}
        groups={groups}
        disabled={disabled}
        legend="Who can see"
        onChange={setAccessTags}
      />
      <input type="hidden" name="accessTagsJson" value={JSON.stringify(accessTags)} />
    </>
  )
}

/** Format Date → `datetime-local` value (local wall clock). */
export function toDatetimeLocalValue(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return ''
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type EventFormRow = {
  title?: string
  slug?: string
  status?: string
  startsAt?: string | null
  endsAt?: string | null
  timezone?: string
  venueId?: string
  description?: string
  coverMediaId?: string
  capacity?: number | null
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  accessTags?: string[]
}

type VenueOpt = { id: string; name: string }

type EventFormFieldsProps = {
  row?: EventFormRow
  venues: VenueOpt[]
  groups: UserGroupOption[]
  defaultTimezone: string
  busy: boolean
  richEditorEnabled: boolean
}

/** Shared create/edit fields for an event. */
export function EventFormFields({
  row,
  venues,
  groups,
  defaultTimezone,
  busy,
  richEditorEnabled,
}: EventFormFieldsProps) {
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
        <span>Registration opens</span>
        <input
          type="datetime-local"
          name="registrationOpensAt"
          defaultValue={toDatetimeLocalValue(row?.registrationOpensAt)}
          disabled={busy}
        />
        <span className="settings-hint">Empty = open as soon as published.</span>
      </label>
      <label className="settings-field">
        <span>Registration closes</span>
        <input
          type="datetime-local"
          name="registrationClosesAt"
          defaultValue={toDatetimeLocalValue(row?.registrationClosesAt)}
          disabled={busy}
        />
        <span className="settings-hint">Empty = no hard close.</span>
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
      <div className="settings-field settings-field-wide">
        <RichEditor
          name="description"
          label="Description"
          defaultValue={row?.description ?? ''}
          disabled={busy}
          enabled={richEditorEnabled}
          preset="full"
          placeholder="Game / event description…"
        />
      </div>
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
