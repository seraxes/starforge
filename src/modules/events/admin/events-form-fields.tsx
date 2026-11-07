'use client'

import React, { useEffect, useState } from 'react'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'
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
 * Shared Media cover + ACL tags for venue forms.
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

function CoverField({
  coverMediaId: initialCover,
  disabled,
}: {
  coverMediaId: string
  disabled?: boolean
}) {
  const [coverMediaId, setCoverMediaId] = useState(initialCover)
  return (
    <div className="settings-field">
      <MediaPicker
        label="Cover"
        value={{ mediaId: coverMediaId, url: '', alt: '' }}
        defaultFolder="general"
        defaultPurpose="photo"
        disabled={disabled}
        includeHiddenInputs={false}
        allowUrlFallback={false}
        hint="Shared Media Manager — not a per-module library."
        onChange={(next) => setCoverMediaId(next.mediaId)}
      />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />
    </div>
  )
}

function VisibilityFields({
  listed: initialListed,
  hasAccessPassword,
  accessTags: initialTags,
  groups,
  disabled,
}: {
  listed: boolean
  hasAccessPassword: boolean
  accessTags: string[]
  groups: UserGroupOption[]
  disabled?: boolean
}) {
  const [listed, setListed] = useState(initialListed !== false)
  const [accessTags, setAccessTags] = useState(
    initialTags.length > 0 ? initialTags : ['public'],
  )

  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Visibility</legend>
      <p className="settings-hint">
        Group ACL gates who may open the page. Unlisted hides the event from public lists
        (URL still works). Password is an optional extra gate after ACL.
      </p>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={listed}
          disabled={disabled}
          onChange={(e) => setListed(e.target.checked)}
        />
        <span>Listed in public calendars / event lists</span>
      </label>
      <input type="hidden" name="listed" value={listed ? '1' : '0'} />
      <label className="settings-field">
        <span>
          Access password
          {hasAccessPassword ? ' (set — leave blank to keep)' : ''}
        </span>
        <input
          type="password"
          name="accessPassword"
          autoComplete="new-password"
          disabled={disabled}
          placeholder={hasAccessPassword ? '••••••••' : 'Optional shared password'}
        />
      </label>
      {hasAccessPassword ? (
        <label className="settings-field settings-field-checkbox">
          <input type="checkbox" name="clearAccessPassword" value="1" disabled={disabled} />
          <span>Clear access password</span>
        </label>
      ) : null}
      <AccessTagsField
        value={accessTags}
        groups={groups}
        disabled={disabled}
        legend="Who can see"
        onChange={setAccessTags}
      />
      <input type="hidden" name="accessTagsJson" value={JSON.stringify(accessTags)} />
    </fieldset>
  )
}

/** Multi-id gallery via shared MediaPicker (append one at a time). */
function GalleryFields({
  galleryMediaIds: initialIds,
  disabled,
}: {
  galleryMediaIds: string[]
  disabled?: boolean
}) {
  const [ids, setIds] = useState(() => [...initialIds])
  const [draft, setDraft] = useState<MediaPickerValue>({ mediaId: '', url: '', alt: '' })

  useEffect(() => {
    const id = (draft.mediaId || '').trim()
    if (!id) return
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setDraft({ mediaId: '', url: '', alt: '' })
  }, [draft.mediaId])

  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Gallery</legend>
      <p className="settings-hint">
        Extra images from the shared Media library. Cover stays separate above.
      </p>
      {ids.length > 0 ? (
        <ul className="sf-events-gallery-list">
          {ids.map((id) => (
            <li key={id} className="sf-events-gallery-item">
              <code>{id}</code>
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={disabled}
                onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-hint">No gallery images yet.</p>
      )}
      <div className="settings-field">
        <MediaPicker
          key={ids.join(',') || 'empty'}
          label="Add image"
          value={draft}
          defaultFolder="general"
          defaultPurpose="photo"
          disabled={disabled}
          includeHiddenInputs={false}
          allowUrlFallback={false}
          onChange={setDraft}
        />
      </div>
      <input type="hidden" name="galleryMediaIdsJson" value={JSON.stringify(ids)} />
    </fieldset>
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
  galleryMediaIds?: string[]
  capacity?: number | null
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  managerUserIds?: string[]
  helperUserIds?: string[]
  managerGroupIds?: string[]
  helperGroupIds?: string[]
  organizerPartyIds?: string[]
  speakerPartyIds?: string[]
  sponsorPartyIds?: string[]
  relatedEventIds?: string[]
  signupNote?: string
  termsUrl?: string
  listed?: boolean
  hasAccessPassword?: boolean
  accessTags?: string[]
}

type VenueOpt = { id: string; name: string }
type IdOpt = { id: string; label: string }

type EventFormFieldsProps = {
  row?: EventFormRow
  venues: VenueOpt[]
  groups: UserGroupOption[]
  /** Site users for manager/helper checklists. */
  users?: IdOpt[]
  /** Party options for organizer/speaker/sponsor checklists. */
  parties?: IdOpt[]
  /** Other events for related checklist (exclude self in page). */
  relatedEventOptions?: IdOpt[]
  defaultTimezone: string
  busy: boolean
  richEditorEnabled: boolean
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

/** Shared create/edit fields for an event — sectioned for scanability. */
export function EventFormFields({
  row,
  venues,
  groups,
  users = [],
  parties = [],
  relatedEventOptions = [],
  defaultTimezone,
  busy,
  richEditorEnabled,
}: EventFormFieldsProps) {
  return (
    <>
      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Basics</legend>
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
        <CoverField coverMediaId={row?.coverMediaId ?? ''} disabled={busy} />
      </fieldset>

      <GalleryFields galleryMediaIds={row?.galleryMediaIds ?? []} disabled={busy} />

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Schedule</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Registration copy</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>People</legend>
        <p className="settings-hint">
          Managers/helpers need Events ACL to open /admin. Parties are public-facing profiles
          (Events → Parties).
        </p>
        <IdChecklistField
          name="managerUserIdsJson"
          legend="Manager users"
          options={users}
          value={row?.managerUserIds ?? []}
          disabled={busy}
        />
        <IdChecklistField
          name="helperUserIdsJson"
          legend="Helper users"
          hint="Helpers share edit rights with managers for now."
          options={users}
          value={row?.helperUserIds ?? []}
          disabled={busy}
        />
        <IdChecklistField
          name="managerGroupIdsJson"
          legend="Manager groups"
          options={groups.map((g) => ({ id: g.id, label: g.label || g.id }))}
          value={row?.managerGroupIds ?? []}
          disabled={busy}
        />
        <IdChecklistField
          name="helperGroupIdsJson"
          legend="Helper groups"
          options={groups.map((g) => ({ id: g.id, label: g.label || g.id }))}
          value={row?.helperGroupIds ?? []}
          disabled={busy}
        />
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
          hint="Series / see-also links."
          options={relatedEventOptions}
          value={row?.relatedEventIds ?? []}
          disabled={busy}
        />
      </fieldset>

      <VisibilityFields
        listed={row?.listed !== false}
        hasAccessPassword={Boolean(row?.hasAccessPassword)}
        accessTags={row?.accessTags ?? ['public']}
        groups={groups}
        disabled={busy}
      />
    </>
  )
}
