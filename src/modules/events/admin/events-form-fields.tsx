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
  managerGroupIds?: string[]
  helperGroupIds?: string[]
  organizerPartyIds?: string[]
  speakerPartyIds?: string[]
  sponsorPartyIds?: string[]
  relatedEventIds?: string[]
  signupNote?: string
  termsUrl?: string
  accessTags?: string[]
}

type VenueOpt = { id: string; name: string }
type IdOpt = { id: string; label: string }

type EventFormFieldsProps = {
  row?: EventFormRow
  venues: VenueOpt[]
  groups: UserGroupOption[]
  /** Party options for organizer/speaker/sponsor checklists. */
  parties?: IdOpt[]
  /** Other events for related checklist (exclude self in page). */
  relatedEventOptions?: IdOpt[]
  defaultTimezone: string
  busy: boolean
  richEditorEnabled: boolean
  /** Hide people/related/signup when creating from the list. */
  compact?: boolean
}

/** Checkbox multi-select writing a hidden JSON id list. */
export function IdChecklistField({
  name,
  legend,
  hint,
  options,
  value,
  disabled,
}: {
  name: string
  legend: string
  hint?: string
  options: IdOpt[]
  value: string[]
  disabled?: boolean
}) {
  const [selected, setSelected] = useState(() => [...value])

  return (
    <fieldset className="settings-field nav-access-tags">
      <legend>{legend}</legend>
      {hint ? <p className="settings-hint">{hint}</p> : null}
      <div className="nav-access-tag-list">
        {options.length === 0 ? (
          <span className="settings-hint">No options yet.</span>
        ) : (
          options.map((opt) => {
            const checked = selected.includes(opt.id)
            return (
              <label key={opt.id} className="outlines-check">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, opt.id]
                        : prev.filter((id) => id !== opt.id),
                    )
                  }}
                />
                <span>{opt.label}</span>
              </label>
            )
          })
        )}
      </div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
    </fieldset>
  )
}

/** Shared create/edit fields for an event. */
export function EventFormFields({
  row,
  venues,
  groups,
  parties = [],
  relatedEventOptions = [],
  defaultTimezone,
  busy,
  richEditorEnabled,
  compact = false,
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
      {!compact ? (
        <>
          <label className="settings-field settings-field-wide">
            <span>Signup note</span>
            <textarea
              name="signupNote"
              rows={3}
              maxLength={4000}
              defaultValue={row?.signupNote ?? ''}
              disabled={busy}
              placeholder="Shown above the public registration form…"
            />
          </label>
          <label className="settings-field">
            <span>Terms URL</span>
            <input
              type="url"
              name="termsUrl"
              maxLength={2000}
              defaultValue={row?.termsUrl ?? ''}
              disabled={busy}
              autoComplete="off"
              placeholder="https://… or /page-slug"
            />
            <span className="settings-hint">
              Linked next to the form — prefer a CMS page, not a giant per-event legal editor.
            </span>
          </label>
          <IdChecklistField
            name="managerGroupIdsJson"
            legend="Manager groups"
            hint="Members of these groups can manage this event (beyond app admins)."
            options={groups.map((g) => ({ id: g.id, label: g.label || g.id }))}
            value={row?.managerGroupIds ?? []}
            disabled={busy}
          />
          <IdChecklistField
            name="helperGroupIdsJson"
            legend="Helper groups"
            hint="Helpers share edit rights with managers for now."
            options={groups.map((g) => ({ id: g.id, label: g.label || g.id }))}
            value={row?.helperGroupIds ?? []}
            disabled={busy}
          />
          <input type="hidden" name="managerUserIdsJson" value="[]" />
          <input type="hidden" name="helperUserIdsJson" value="[]" />
          <IdChecklistField
            name="organizerPartyIdsJson"
            legend="Organizers"
            hint={
              parties.length === 0
                ? 'Create parties under Events → Parties first.'
                : 'Associations / teams / clubs linked to this event.'
            }
            options={parties}
            value={row?.organizerPartyIds ?? []}
            disabled={busy}
          />
          <IdChecklistField
            name="speakerPartyIdsJson"
            legend="Speakers"
            options={parties}
            value={row?.speakerPartyIds ?? []}
            disabled={busy}
          />
          <IdChecklistField
            name="sponsorPartyIdsJson"
            legend="Sponsors"
            options={parties}
            value={row?.sponsorPartyIds ?? []}
            disabled={busy}
          />
          <IdChecklistField
            name="relatedEventIdsJson"
            legend="Related events"
            hint="Series / see-also links (ids only for now)."
            options={relatedEventOptions}
            value={row?.relatedEventIds ?? []}
            disabled={busy}
          />
        </>
      ) : (
        <>
          <input type="hidden" name="managerUserIdsJson" value="[]" />
          <input type="hidden" name="helperUserIdsJson" value="[]" />
          <input type="hidden" name="managerGroupIdsJson" value="[]" />
          <input type="hidden" name="helperGroupIdsJson" value="[]" />
          <input type="hidden" name="organizerPartyIdsJson" value="[]" />
          <input type="hidden" name="speakerPartyIdsJson" value="[]" />
          <input type="hidden" name="sponsorPartyIdsJson" value="[]" />
          <input type="hidden" name="relatedEventIdsJson" value="[]" />
          <input type="hidden" name="signupNote" value="" />
          <input type="hidden" name="termsUrl" value="" />
        </>
      )}
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
