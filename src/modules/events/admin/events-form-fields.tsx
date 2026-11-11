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
  featured: initialFeatured,
  hasAccessPassword,
  accessTags: initialTags,
  groups,
  disabled,
}: {
  listed: boolean
  featured: boolean
  hasAccessPassword: boolean
  accessTags: string[]
  groups: UserGroupOption[]
  disabled?: boolean
}) {
  const [listed, setListed] = useState(initialListed !== false)
  const [featured, setFeatured] = useState(initialFeatured === true)
  const [accessTags, setAccessTags] = useState(
    initialTags.length > 0 ? initialTags : ['public'],
  )

  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Visibility</legend>
      <p className="settings-hint">
        Group ACL gates who may open the page. Unlisted hides the event from public lists
        (URL still works). Featured feeds the layout Featured carousel particle. Password is
        an optional extra gate after ACL.
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
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={featured}
          disabled={disabled}
          onChange={(e) => setFeatured(e.target.checked)}
        />
        <span>Featured (carousel particle)</span>
      </label>
      <input type="hidden" name="featured" value={featured ? '1' : '0'} />
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
export function GalleryFields({
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
  waitlistEnabled?: boolean
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  /** Premium merchant user id for ticket collect (empty = site MoR). */
  merchantUserId?: string
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
  featured?: boolean
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

function labelForId(options: IdOpt[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id
}

/**
 * Chip + typeahead multi-id picker (writes hidden JSON).
 * Type to filter, Enter / click to add, × to remove.
 */
export function IdSuggestField({
  name,
  label,
  hint,
  options,
  value,
  disabled,
  placeholder = 'Type to add…',
}: {
  name: string
  label: string
  hint?: string
  options: IdOpt[]
  value: string[]
  disabled?: boolean
  placeholder?: string
}) {
  const [selected, setSelected] = useState(() => [...value])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const available = options.filter((o) => !selected.includes(o.id))
  const matches =
    q.length === 0
      ? available.slice(0, 8)
      : available
          .filter(
            (o) =>
              o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
          )
          .slice(0, 8)

  function add(id: string) {
    if (!id || selected.includes(id)) return
    setSelected((prev) => [...prev, id])
    setQuery('')
    setOpen(false)
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id))
  }

  return (
    <div className="settings-field sf-events-id-suggest">
      <span>{label}</span>
      {hint ? <p className="settings-hint">{hint}</p> : null}
      {selected.length > 0 ? (
        <ul className="sf-events-id-chips" aria-label={label}>
          {selected.map((id) => (
            <li key={id} className="sf-events-id-chip">
              <span title={id}>{labelForId(options, id)}</span>
              <button
                type="button"
                className="sf-events-id-chip-remove"
                disabled={disabled}
                aria-label={`Remove ${labelForId(options, id)}`}
                onClick={() => remove(id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="sf-events-id-suggest-input-wrap">
        <input
          type="text"
          value={query}
          disabled={disabled || available.length === 0}
          autoComplete="off"
          placeholder={
            available.length === 0
              ? selected.length > 0
                ? 'All options added'
                : 'No options yet'
              : placeholder
          }
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Allow click on suggestion before closing.
            window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[0]) add(matches[0].id)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && matches.length > 0 ? (
          <ul className="sf-events-id-suggest-menu" role="listbox">
            {matches.map((opt) => (
              <li key={opt.id} role="option">
                <button
                  type="button"
                  className="sf-events-id-suggest-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(opt.id)}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
    </div>
  )
}

/** Shared create/edit fields — mosaic cards (same layout create + edit). */
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
      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
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
        <label className="settings-field settings-flag">
          <input
            type="checkbox"
            name="waitlistEnabled"
            value="1"
            defaultChecked={row?.waitlistEnabled !== false}
            disabled={busy}
          />
          <span>Enable waitlist when full</span>
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
            MediaPicker={MediaPicker}
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
        <legend>Payments</legend>
        <label className="settings-field">
          <span>Collect as merchant</span>
          <select
            name="merchantUserId"
            defaultValue={row?.merchantUserId ?? ''}
            disabled={busy}
          >
            <option value="">Site MoR (platform keys)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Premium organizer with My merchant keys + ACL. Empty uses site payments settings.
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>People</legend>
        <p className="settings-hint">
          Type to add. Managers need Events ACL. Organizers / sponsors are party profiles
          (Events → Parties). Role labels become editable later.
        </p>
        <IdSuggestField
          name="managerUserIdsJson"
          label="Managers"
          options={users}
          value={row?.managerUserIds ?? []}
          disabled={busy}
          placeholder="Add user…"
        />
        <IdSuggestField
          name="managerGroupIdsJson"
          label="Manager groups"
          options={groups.map((g) => ({ id: g.id, label: g.label || g.id }))}
          value={row?.managerGroupIds ?? []}
          disabled={busy}
          placeholder="Add group…"
        />
        {/* Helpers kept in schema; UI folded into managers for less noise. */}
        <input
          type="hidden"
          name="helperUserIdsJson"
          value={JSON.stringify(row?.helperUserIds ?? [])}
        />
        <input
          type="hidden"
          name="helperGroupIdsJson"
          value={JSON.stringify(row?.helperGroupIds ?? [])}
        />
        <IdSuggestField
          name="organizerPartyIdsJson"
          label="Organizers"
          hint={
            parties.length === 0
              ? 'Create parties under Events → Parties first.'
              : 'Public-facing organizers (includes former Speakers).'
          }
          options={parties}
          value={Array.from(
            new Set([...(row?.organizerPartyIds ?? []), ...(row?.speakerPartyIds ?? [])]),
          )}
          disabled={busy}
          placeholder="Add organizer…"
        />
        {/* Speakers folded into Organizers — column kept for later renameable roles. */}
        <input type="hidden" name="speakerPartyIdsJson" value="[]" />
        <IdSuggestField
          name="sponsorPartyIdsJson"
          label="Sponsors"
          options={parties}
          value={row?.sponsorPartyIds ?? []}
          disabled={busy}
          placeholder="Add sponsor…"
        />
        <IdSuggestField
          name="relatedEventIdsJson"
          label="Related events"
          options={relatedEventOptions}
          value={row?.relatedEventIds ?? []}
          disabled={busy}
          placeholder="Add related event…"
        />
      </fieldset>

      <VisibilityFields
        listed={row?.listed !== false}
        featured={row?.featured === true}
        hasAccessPassword={Boolean(row?.hasAccessPassword)}
        accessTags={row?.accessTags ?? ['public']}
        groups={groups}
        disabled={busy}
      />
    </>
  )
}
