'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

import { MAX_TIME_PRICE_BANDS, type TierPriceRules } from '../price-rules'
import {
  EVENT_SERIES_FREQUENCIES,
  MAX_SERIES_OCCURRENCES,
  expandSeriesStarts,
  type EventSeriesEndMode,
  type EventSeriesFrequency,
  type EventSeriesPattern,
} from '../series'
import {
  EVENT_COVER_DISPLAY_MODES,
  EVENT_COVER_MEDIA_MAX,
  EVENT_STATUSES,
  isEventCoverDisplayMode,
  type EventCoverDisplayMode,
} from '../types'

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

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

/** Primary + optional Premium multi-cover set (max 10). Playback later. */
function CoverFields({
  coverMediaId: initialCover,
  coverMediaIds: initialIds,
  coverDisplayMode: initialMode,
  disabled,
}: {
  coverMediaId: string
  coverMediaIds?: string[]
  coverDisplayMode?: EventCoverDisplayMode
  disabled?: boolean
}) {
  const seedIds =
    initialIds && initialIds.length > 0
      ? initialIds.slice(0, EVENT_COVER_MEDIA_MAX)
      : initialCover.trim()
        ? [initialCover.trim()]
        : []
  const [ids, setIds] = useState(() => [...seedIds])
  const [mode, setMode] = useState<EventCoverDisplayMode>(
    isEventCoverDisplayMode(initialMode) ? initialMode : 'static',
  )
  const [draft, setDraft] = useState<MediaPickerValue>({
    mediaId: '',
    url: '',
    alt: '',
  })
  const primary = ids[0] || ''
  const atMax = ids.length >= EVENT_COVER_MEDIA_MAX

  useEffect(() => {
    const id = (draft.mediaId || '').trim()
    if (!id) return
    setIds((prev) => {
      if (prev.includes(id) || prev.length >= EVENT_COVER_MEDIA_MAX) return prev
      return [...prev, id]
    })
    setDraft({ mediaId: '', url: '', alt: '' })
  }, [draft.mediaId])

  return (
    <div className="sf-events-cover-fields settings-field settings-field-wide">
      <span>Cover</span>
      {primary ? (
        <figure className="sf-events-cover-hero">
          {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
          <img src={`/api/media/${encodeURIComponent(primary)}`} alt="" />
        </figure>
      ) : (
        <p className="settings-hint">No cover yet — add an image below.</p>
      )}
      {ids.length > 0 ? (
        <ul className="sf-events-gallery-list sf-events-cover-list">
          {ids.map((id, index) => (
            <li key={id} className="sf-events-gallery-item">
              <span className="sf-events-cover-list-label">
                {index === 0 ? (
                  <span className="outlines-badge" title="Used on cards and as static hero">
                    Primary
                  </span>
                ) : null}
                <code>{id}</code>
              </span>
              <span className="admin-inline-actions">
                {index > 0 ? (
                  <button
                    type="button"
                    className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                    disabled={disabled}
                    onClick={() =>
                      setIds((prev) => {
                        const next = prev.filter((x) => x !== id)
                        return [id, ...next]
                      })
                    }
                  >
                    Make primary
                  </button>
                ) : null}
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={disabled}
                  onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!atMax ? (
        <div className="settings-field">
          <MediaPicker
            key={ids.join(',') || 'empty-cover'}
            label={ids.length === 0 ? 'Add cover' : 'Add cover image'}
            value={draft}
            defaultFolder="general"
            defaultPurpose="photo"
            disabled={disabled}
            includeHiddenInputs={false}
            allowUrlFallback={false}
            hint={`Up to ${EVENT_COVER_MEDIA_MAX} images. First is primary for lists and cards.`}
            onChange={setDraft}
          />
        </div>
      ) : (
        <p className="settings-hint">Maximum {EVENT_COVER_MEDIA_MAX} cover images.</p>
      )}
      <label className="settings-field">
        <span>
          Cover display{' '}
          <span className="outlines-badge" title="Random and rotate need a Premium plan later">
            Premium
          </span>
        </span>
        <select
          name="coverDisplayMode"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value
            setMode(isEventCoverDisplayMode(next) ? next : 'static')
          }}
        >
          {EVENT_COVER_DISPLAY_MODES.map((m) => (
            <option key={m} value={m}>
              {m === 'static'
                ? 'Static (first image)'
                : m === 'random'
                  ? 'Random — Premium (soon)'
                  : 'Rotate / slider — Premium (soon)'}
            </option>
          ))}
        </select>
        <span className="settings-hint">
          Values save now. Public random/rotate playback ships with Premium later; static
          always uses the primary image.
        </span>
      </label>
      <input type="hidden" name="coverMediaId" value={primary} />
      <input type="hidden" name="coverMediaIdsJson" value={JSON.stringify(ids)} />
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
        (URL still works). Featured feeds the layout Featured carousel only — it is not a
        category. Password is an optional extra gate after ACL.
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
        Extra images from the shared Media library. Cover lives under Title in Basics.
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
  currency?: string
  price?: number | null
  priceRules?: TierPriceRules
  venueId?: string
  description?: string
  coverMediaId?: string
  coverMediaIds?: string[]
  coverDisplayMode?: EventCoverDisplayMode
  galleryMediaIds?: string[]
  capacity?: number | null
  waitlistEnabled?: boolean
  requireApproval?: boolean
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  cancellationClosesAt?: string | null
  selfCancelRefund?: boolean
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
  seriesId?: string
  seriesPattern?: EventSeriesPattern | null
  seriesDateCount?: number
  signupNote?: string
  termsUrl?: string
  listed?: boolean
  featured?: boolean
  categoryId?: string
  registrationFormId?: string
  hasAccessPassword?: boolean
  accessTags?: string[]
}

function formatSeriesPatternSummary(pattern: EventSeriesPattern | null | undefined): string {
  if (!pattern) return 'Linked series dates (pattern not stored on this row).'
  const every =
    pattern.interval <= 1
      ? pattern.frequency
      : `every ${pattern.interval} ${pattern.frequency === 'daily' ? 'days' : pattern.frequency === 'weekly' ? 'weeks' : 'months'}`
  const end =
    pattern.endMode === 'count' && pattern.count
      ? `${pattern.count} dates`
      : pattern.until
        ? `until ${pattern.until}`
        : 'bounded'
  return `Repeats ${every}${pattern.frequency === 'weekly' && pattern.weekdays.length ? ` on selected weekdays` : ''} · ${end}.`
}

/** Create + edit: expand a finite list of concrete event copies. */
function RecurringFields({
  busy,
  seriesId,
  seriesPattern,
  seriesDateCount,
}: {
  busy?: boolean
  seriesId?: string
  seriesPattern?: EventSeriesPattern | null
  seriesDateCount?: number
}) {
  const fieldsetRef = useRef<HTMLFieldSetElement>(null)
  const inSeries = Boolean((seriesId || '').trim())
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState<EventSeriesFrequency>('weekly')
  const [interval, setInterval] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([5])
  const [endMode, setEndMode] = useState<EventSeriesEndMode>('count')
  const [count, setCount] = useState(8)
  const [until, setUntil] = useState('')
  const [startsLocal, setStartsLocal] = useState('')

  useEffect(() => {
    const form = fieldsetRef.current?.form
    if (!(form instanceof HTMLFormElement)) return
    const startInput = form.querySelector<HTMLInputElement>('input[name="startsAt"]')
    if (!startInput) return
    const sync = () => setStartsLocal(startInput.value || '')
    sync()
    startInput.addEventListener('change', sync)
    startInput.addEventListener('input', sync)
    return () => {
      startInput.removeEventListener('change', sync)
      startInput.removeEventListener('input', sync)
    }
  }, [])

  const previewCount = (() => {
    if (inSeries || !enabled || !startsLocal.trim()) return 0
    const first = new Date(startsLocal)
    if (Number.isNaN(first.getTime())) return 0
    return expandSeriesStarts(first, {
      frequency,
      interval: Math.max(1, interval),
      weekdays: frequency === 'weekly' ? weekdays : [],
      endMode,
      count: endMode === 'count' ? count : null,
      until: endMode === 'until' ? until || null : null,
    }).length
  })()

  return (
    <fieldset
      ref={fieldsetRef}
      className="settings-fieldset sf-events-form-section"
    >
      <legend>Recurring</legend>
      {inSeries ? (
        <>
          <p className="settings-hint">
            Part of a series
            {typeof seriesDateCount === 'number' && seriesDateCount > 0
              ? ` · ${seriesDateCount} date${seriesDateCount === 1 ? '' : 's'}`
              : ''}
            . Each date keeps its own seats and registrants.
          </p>
          <p className="settings-hint">{formatSeriesPatternSummary(seriesPattern)}</p>
          <p className="settings-hint">
            Group edit across dates is planned. Use Duplicate for a one-off copy outside
            the series.
          </p>
        </>
      ) : (
        <>
          <label className="settings-field settings-flag">
            <input
              type="checkbox"
              name="recurringEnabled"
              value="1"
              checked={enabled}
              disabled={busy}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Create multiple dates from this event</span>
          </label>
          <p className="settings-hint">
            Each date becomes its own event (own seats and registrants), linked as a
            series. Registration windows shift with each start. Ticket types on this
            event are copied to the extra dates when you expand from edit.
          </p>
          {enabled ? (
            <>
              <label className="settings-field">
                <span>Repeats</span>
                <select
                  name="recurringFrequency"
                  value={frequency}
                  disabled={busy}
                  onChange={(e) =>
                    setFrequency(e.target.value as EventSeriesFrequency)
                  }
                >
                  {EVENT_SERIES_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Every</span>
                <input
                  type="number"
                  name="recurringInterval"
                  min={1}
                  max={52}
                  value={interval}
                  disabled={busy}
                  onChange={(e) =>
                    setInterval(Math.max(1, Number(e.target.value) || 1))
                  }
                />
                <span className="settings-hint">
                  {frequency === 'daily'
                    ? 'days'
                    : frequency === 'weekly'
                      ? 'weeks'
                      : 'months'}
                </span>
              </label>
              {frequency === 'weekly' ? (
                <div className="settings-field">
                  <span>On</span>
                  <div
                    className="admin-inline-actions"
                    role="group"
                    aria-label="Weekdays"
                  >
                    {WEEKDAY_OPTIONS.map((day) => {
                      const on = weekdays.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={`gantry-toolbar-btn ${
                            on
                              ? 'gantry-toolbar-btn-muted'
                              : 'gantry-toolbar-btn-quiet'
                          }`}
                          aria-pressed={on}
                          disabled={busy}
                          onClick={() => {
                            setWeekdays((prev) =>
                              on
                                ? prev.filter((d) => d !== day.value)
                                : [...prev, day.value].sort((a, b) => a - b),
                            )
                          }}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                  {weekdays.map((day) => (
                    <input
                      key={`recurring-weekday-${day}`}
                      type="hidden"
                      name="recurringWeekday"
                      value={day}
                    />
                  ))}
                </div>
              ) : null}
              <label className="settings-field">
                <span>Ends</span>
                <select
                  name="recurringEndMode"
                  value={endMode}
                  disabled={busy}
                  onChange={(e) =>
                    setEndMode(e.target.value as EventSeriesEndMode)
                  }
                >
                  <option value="count">After a number of dates</option>
                  <option value="until">On a date</option>
                </select>
              </label>
              {endMode === 'count' ? (
                <label className="settings-field">
                  <span>Number of dates</span>
                  <input
                    type="number"
                    name="recurringCount"
                    min={2}
                    max={MAX_SERIES_OCCURRENCES}
                    value={count}
                    disabled={busy}
                    onChange={(e) =>
                      setCount(
                        Math.min(
                          MAX_SERIES_OCCURRENCES,
                          Math.max(2, Number(e.target.value) || 2),
                        ),
                      )
                    }
                  />
                  <span className="settings-hint">
                    Max {MAX_SERIES_OCCURRENCES}.
                  </span>
                </label>
              ) : (
                <label className="settings-field">
                  <span>Until</span>
                  <input
                    type="date"
                    name="recurringUntil"
                    value={until}
                    disabled={busy}
                    onChange={(e) => setUntil(e.target.value)}
                    required={enabled && endMode === 'until'}
                  />
                </label>
              )}
              <p className="settings-hint">
                {previewCount > 0
                  ? `Will create ${previewCount} event${previewCount === 1 ? '' : 's'}.`
                  : 'Set a start time above to preview how many dates will be created.'}
              </p>
            </>
          ) : null}
        </>
      )}
    </fieldset>
  )
}

type VenueOpt = { id: string; name: string }
type IdOpt = { id: string; label: string }

type EventFormFieldsProps = {
  row?: EventFormRow
  venues: VenueOpt[]
  categories?: IdOpt[]
  forms?: IdOpt[]
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

type TimeBandDraft = {
  key: string
  withinHours: string
  mode: 'amount' | 'percent'
  value: string
}

function formatWithinHours(withinMinutes: number): string {
  return String(Math.max(1, Math.round(withinMinutes / 60)))
}

function draftsFromRules(rules: TierPriceRules | undefined): TimeBandDraft[] {
  return (rules?.time ?? []).map((band, index) => ({
    key: `saved-${index}-${band.withinMinutes}-${band.mode}-${band.value}`,
    withinHours: formatWithinHours(band.withinMinutes),
    mode: band.mode === 'percent' ? 'percent' : 'amount',
    value: String(band.value),
  }))
}

/** Repeatable time-left bands. Sold-count stays a separate single row. */
function TimePriceBandsFields({
  rules,
  busy,
}: {
  rules?: TierPriceRules
  busy: boolean
}) {
  const [bands, setBands] = useState<TimeBandDraft[]>(() => draftsFromRules(rules))
  const atMax = bands.length >= MAX_TIME_PRICE_BANDS

  return (
    <div className="sf-events-price-bands">
      {bands.map((band) => (
        <div className="sf-events-price-row sf-events-price-band" key={band.key}>
          <label className="settings-field">
            <span>Within hours of start</span>
            <input
              type="number"
              name="timeRuleWithinHours"
              min={1}
              step={1}
              required
              value={band.withinHours}
              disabled={busy}
              placeholder="48"
              title="Apply when the event starts within this many hours."
              onChange={(event) =>
                setBands((prev) =>
                  prev.map((item) =>
                    item.key === band.key ? { ...item, withinHours: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <label className="settings-field">
            <span>Time change</span>
            <select
              name="timeRuleMode"
              value={band.mode}
              disabled={busy}
              onChange={(event) => {
                const mode = event.target.value === 'percent' ? 'percent' : 'amount'
                setBands((prev) =>
                  prev.map((item) => (item.key === band.key ? { ...item, mode } : item)),
                )
              }}
            >
              <option value="amount">Amount</option>
              <option value="percent">Percent of price</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Time value</span>
            <input
              type="number"
              name="timeRuleValue"
              step={1}
              required
              value={band.value}
              disabled={busy}
              placeholder="0"
              title="Major units, or percent of the price in effect. Negative discounts."
              onChange={(event) =>
                setBands((prev) =>
                  prev.map((item) =>
                    item.key === band.key ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
            aria-label={
              band.withinHours
                ? `Remove ${band.withinHours} hour time band`
                : 'Remove time band'
            }
            onClick={() => setBands((prev) => prev.filter((item) => item.key !== band.key))}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="sf-events-price-bands-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy || atMax}
          title="Add another window. The shortest one that still contains the time left is used."
          onClick={() =>
            setBands((prev) => {
              if (prev.length >= MAX_TIME_PRICE_BANDS) return prev
              return [
                ...prev,
                {
                  key: `new-${Date.now()}-${prev.length}`,
                  withinHours: '',
                  mode: 'amount',
                  value: '',
                },
              ]
            })
          }
        >
          Add time band
        </button>
      </div>
    </div>
  )
}

/** Shared create/edit fields — mosaic cards (same layout create + edit). */
export function EventFormFields({
  row,
  venues,
  categories = [],
  forms = [],
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
        <CoverFields
          coverMediaId={row?.coverMediaId ?? ''}
          coverMediaIds={row?.coverMediaIds}
          coverDisplayMode={row?.coverDisplayMode}
          disabled={busy}
        />
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Listing</legend>
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
          <span>Category</span>
          <select name="categoryId" defaultValue={row?.categoryId ?? ''} disabled={busy}>
            <option value="">— none —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Editorial label for the public hub filter. Featured stays the carousel flag.{' '}
            <Link href="/admin/events/categories">Manage categories</Link>.
          </span>
        </label>
        <label className="settings-field">
          <span>Registration form</span>
          <select
            name="registrationFormId"
            defaultValue={row?.registrationFormId ?? ''}
            disabled={busy}
          >
            <option value="">Use category form</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Empty uses the category’s form, then the shared event registration form. Field
            schema stays in <Link href="/admin/forms">Forms</Link>.
          </span>
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
        <label className="settings-field settings-flag">
          <input
            type="checkbox"
            name="requireApproval"
            value="1"
            defaultChecked={row?.requireApproval === true}
            disabled={busy}
          />
          <span>Require approval</span>
        </label>
        <p className="settings-hint">
          New signups stay pending until an admin sets them registered. Paid tickets stay
          pending payment until paid, then wait for approval. Waitlist is unchanged.
        </p>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Description</legend>
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
        <label className="settings-field">
          <span>Cancellation closes</span>
          <input
            type="datetime-local"
            name="cancellationClosesAt"
            defaultValue={toDatetimeLocalValue(row?.cancellationClosesAt)}
            disabled={busy}
          />
          <span className="settings-hint">
            Empty = attendees cannot cancel or switch ticket types themselves.
          </span>
        </label>
      </fieldset>

      <RecurringFields
        busy={busy}
        seriesId={row?.seriesId}
        seriesPattern={row?.seriesPattern}
        seriesDateCount={row?.seriesDateCount}
      />

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Pricing</legend>
        <p className="settings-hint">
          Base price for this event. A ticket type with its own price replaces it. A type
          modifier is always added. When several time bands match, the shortest window wins.
          That band and the sold rule use the price in effect.
        </p>
        <div className="sf-events-price-row">
          <label className="settings-field">
            <span>Base price</span>
            <input
              type="number"
              name="price"
              step={1}
              defaultValue={row?.price ?? ''}
              disabled={busy}
              placeholder="—"
              title="Individual price in major units. Empty = free unless a ticket type sets a price."
            />
          </label>
          <label className="settings-field">
            <span>Currency</span>
            <input
              type="text"
              name="currency"
              maxLength={3}
              defaultValue={row?.currency ?? ''}
              disabled={busy}
              autoComplete="off"
              placeholder="Site default"
              title="ISO code for this event. Empty uses Payments → currency."
            />
          </label>
        </div>
        <TimePriceBandsFields rules={row?.priceRules} busy={busy} />
        <div className="sf-events-price-row">
          <label className="settings-field settings-flag">
            <input
              type="checkbox"
              name="soldRuleEnabled"
              value="1"
              defaultChecked={Boolean(row?.priceRules?.sold)}
              disabled={busy}
            />
            <span>Tickets sold</span>
          </label>
          <label className="settings-field">
            <span>From</span>
            <input
              type="number"
              name="soldRuleThreshold"
              min={0}
              step={1}
              defaultValue={row?.priceRules?.sold?.threshold ?? ''}
              disabled={busy}
              placeholder="10"
            />
          </label>
          <label className="settings-field">
            <span>Sold basis</span>
            <select
              name="soldRuleBasis"
              defaultValue={row?.priceRules?.sold?.basis ?? 'count'}
              disabled={busy}
            >
              <option value="count">Tickets on the event</option>
              <option value="percent">% of event capacity</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Sold change</span>
            <select
              name="soldRuleMode"
              defaultValue={row?.priceRules?.sold?.mode ?? 'amount'}
              disabled={busy}
            >
              <option value="amount">Amount</option>
              <option value="percent">Percent of price</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Sold value</span>
            <input
              type="number"
              name="soldRuleValue"
              step={1}
              defaultValue={row?.priceRules?.sold?.value ?? ''}
              disabled={busy}
              placeholder="0"
            />
          </label>
        </div>
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
        <label className="settings-field settings-flag">
          <span>Offer refund on self-cancel</span>
          <input
            type="checkbox"
            name="selfCancelRefund"
            value="1"
            defaultChecked={row?.selfCancelRefund === true}
            disabled={busy}
          />
          <span className="settings-hint">
            When enabled, paid attendees may confirm a refund request on cancel.
            Refunds are not automatic — Payments must process them.
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
