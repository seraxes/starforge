'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { MapClientConfig } from '@/core/maps/types'
import {
  DEFAULT_IMAGE_FRAME,
  FramedImage,
  ImageFrameEditor,
  MediaPicker,
  MemberMediaPicker,
  normalizeImageFrame,
  type ImageFrame,
} from '@/modules/media/api'
import { VenueLocationMap } from '@/modules/maps/VenueLocationMap'

import { countryOptions } from '../countries'
import {
  GENDER_OPTIONS,
  PROFILE_LINKS_MAX,
  VISIBILITY_LABELS,
  type ProfileFieldKey,
  type ProfileLink,
  type VisibilityScope,
} from '../fields'
import type { ProfileEditorModel } from '../form'
import type { ProfilesActionState } from '../types'

type Props = {
  model: ProfileEditorModel
  /** Server action (`saveOwnProfileAction` / `saveProfileAdminAction`). */
  action: (prev: ProfilesActionState, formData: FormData) => Promise<ProfilesActionState>
  /** `public` = site chrome; `admin` = Gantry toolbar buttons. */
  chrome: 'public' | 'admin'
  /** Members upload their own images; admins pick from the shared library. */
  imagePicker: 'member' | 'library'
  cancelHref: string
  /** Admin editor posts the target user id. */
  includeUserId?: boolean
  mapClientConfig?: MapClientConfig | null
  locale?: string
  /** Called with the saved handle so pages can show “View profile”. */
  viewHrefPrefix?: string
}

const initial: ProfilesActionState = {}

function btn(chrome: 'public' | 'admin', kind: 'save' | 'muted'): string {
  if (chrome === 'admin') {
    return kind === 'save'
      ? 'gantry-toolbar-btn gantry-toolbar-btn-save'
      : 'gantry-toolbar-btn gantry-toolbar-btn-muted'
  }
  return kind === 'save' ? 'primary' : 'ghost'
}

function FieldHead({
  htmlFor,
  label,
  required,
  field,
  model,
  visibility,
  onVisibility,
  disabled,
}: {
  htmlFor?: string
  label: string
  required?: boolean
  field?: ProfileFieldKey
  model: ProfileEditorModel
  visibility?: Partial<Record<ProfileFieldKey, VisibilityScope>>
  onVisibility?: (key: ProfileFieldKey, scope: VisibilityScope) => void
  disabled: boolean
}) {
  const state = field ? model.fields[field] : null
  const scope = field && state ? (visibility?.[field] ?? state.visibility) : null
  return (
    <span className="sf-profile-field-head">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {field && state?.configurable && scope && onVisibility ? (
        <select
          className="sf-profile-vis"
          aria-label={`Who can see: ${label}`}
          value={scope}
          disabled={disabled}
          onChange={(e) => onVisibility(field, e.target.value as VisibilityScope)}
        >
          {model.scopes.map((s) => (
            <option key={s} value={s}>
              {VISIBILITY_LABELS[s]}
            </option>
          ))}
        </select>
      ) : null}
    </span>
  )
}

/**
 * The one profile editor — member self-service (`/account/profile`) and admin
 * (`/admin/profiles/[userId]`) render this same component; only chrome, image
 * picker and action differ. Fields, labels, privacy scopes and limits all come
 * from the shared field registry via `model`.
 */
export function ProfileEditor({
  model,
  action,
  chrome,
  imagePicker,
  cancelHref,
  includeUserId,
  mapClientConfig = null,
  locale = 'en',
  viewHrefPrefix,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, initial)
  const v = model.values
  const f = model.fields

  const [avatar, setAvatar] = useState(v.avatarMediaId)
  const [cover, setCover] = useState(v.coverMediaId)
  const [avatarFrame, setAvatarFrame] = useState<ImageFrame>(() =>
    normalizeImageFrame(v.avatarFrame),
  )
  const [coverFrame, setCoverFrame] = useState<ImageFrame>(() =>
    normalizeImageFrame(v.coverFrame),
  )
  const [frameEditor, setFrameEditor] = useState<'avatar' | 'cover' | null>(null)
  const [links, setLinks] = useState<ProfileLink[]>(v.links)
  const [latitude, setLatitude] = useState(v.latitude == null ? '' : String(v.latitude))
  const [longitude, setLongitude] = useState(v.longitude == null ? '' : String(v.longitude))
  const [visibility, setVisibility] = useState<
    Partial<Record<ProfileFieldKey, VisibilityScope>>
  >(() => {
    const out: Partial<Record<ProfileFieldKey, VisibilityScope>> = {}
    for (const key of Object.keys(f) as ProfileFieldKey[]) {
      if (f[key].configurable) out[key] = f[key].visibility
    }
    return out
  })

  // Pull the saved values back in (React resets uncontrolled inputs after an action).
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  // Names + zones are client-only (ICU differs between server and browser).
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([])
  const [zones, setZones] = useState<string[]>([])
  useEffect(() => {
    setCountries(countryOptions(locale))
    try {
      const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
        .supportedValuesOf
      setZones(supported ? supported('timeZone') : [])
    } catch {
      setZones([])
    }
  }, [locale])

  const latNum = latitude.trim() === '' ? null : Number(latitude)
  const lngNum = longitude.trim() === '' ? null : Number(longitude)
  const lat = latNum != null && Number.isFinite(latNum) ? latNum : null
  const lng = lngNum != null && Number.isFinite(lngNum) ? lngNum : null

  const handleLocked = Boolean(model.handleLockedUntil)
  const handleLockedDate = model.handleLockedUntil?.slice(0, 10) ?? ''

  const visibilityJson = useMemo(() => JSON.stringify(visibility), [visibility])
  const setScope = (key: ProfileFieldKey, scope: VisibilityScope) =>
    setVisibility((prev) => ({ ...prev, [key]: scope }))

  const canUpload = imagePicker === 'library' || model.memberUploadsEnabled
  const head = (
    props: Omit<React.ComponentProps<typeof FieldHead>, 'model' | 'visibility' | 'onVisibility' | 'disabled'>,
  ) => (
    <FieldHead
      {...props}
      model={model}
      visibility={visibility}
      onVisibility={setScope}
      disabled={pending}
    />
  )

  function renderImage(kind: 'avatar' | 'cover') {
    const label = kind === 'avatar' ? 'Avatar' : 'Cover image'
    const value = kind === 'avatar' ? avatar : cover
    const setValue = kind === 'avatar' ? setAvatar : setCover
    const frame = kind === 'avatar' ? avatarFrame : coverFrame
    const setFrame = kind === 'avatar' ? setAvatarFrame : setCoverFrame
    const shape = kind === 'avatar' ? 'circle' : 'wide'
    const src = value ? `/api/media/${value}` : ''

    if (imagePicker === 'library') {
      return (
        <div className={`sf-profile-library-image sf-profile-library-image--${shape}`}>
          {src ? (
            <div className="sf-member-media-preview">
              <FramedImage src={src} frame={frame} shape={shape} alt="" />
            </div>
          ) : null}
          <MediaPicker
            label={label}
            value={{ mediaId: value, url: '', alt: '' }}
            defaultFolder="general"
            defaultPurpose="photo"
            disabled={pending}
            includeHiddenInputs={false}
            allowUrlFallback={false}
            onChange={(next) => {
              setValue(next.mediaId)
              setFrame(DEFAULT_IMAGE_FRAME)
              if (next.mediaId) setFrameEditor(kind)
            }}
          />
          {value ? (
            <button
              type="button"
              className={btn(chrome, 'muted')}
              disabled={pending}
              onClick={() => setFrameEditor(kind)}
            >
              Adjust crop
            </button>
          ) : null}
        </div>
      )
    }
    if (!canUpload) {
      return <p className="settings-hint">Image uploads are turned off on this site.</p>
    }
    return (
      <MemberMediaPicker
        label={label}
        value={value}
        onChange={setValue}
        frame={frame}
        onFrameChange={setFrame}
        context={`profile-${kind}`}
        shape={shape}
        chrome={chrome}
        disabled={pending}
      />
    )
  }

  return (
    <form action={formAction} className="sf-profile-editor">
      {includeUserId ? <input type="hidden" name="userId" value={model.userId} /> : null}
      <input type="hidden" name="avatarMediaId" value={avatar} />
      <input type="hidden" name="coverMediaId" value={cover} />
      <input type="hidden" name="avatarFrameJson" value={JSON.stringify(avatarFrame)} />
      <input type="hidden" name="coverFrameJson" value={JSON.stringify(coverFrame)} />
      <input type="hidden" name="linksJson" value={JSON.stringify(links)} />
      <input type="hidden" name="visibilityJson" value={visibilityJson} />

      <div className="sf-profile-form-mosaic">
        <fieldset className="settings-fieldset">
          <legend>Identity</legend>
          <div className="settings-field">
            {head({ htmlFor: 'pf-displayName', label: 'Display name', required: true })}
            <input
              id="pf-displayName"
              type="text"
              name="displayName"
              required
              maxLength={80}
              defaultValue={v.displayName}
              disabled={pending}
              autoComplete="name"
            />
          </div>
          <div className="settings-field">
            {head({ htmlFor: 'pf-handle', label: 'Username', required: true })}
            <input
              id="pf-handle"
              type="text"
              name="handle"
              required
              minLength={3}
              maxLength={30}
              defaultValue={v.handle}
              disabled={pending || handleLocked}
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
            />
            <span className="settings-hint">
              {handleLocked
                ? `You can change your username again on ${handleLockedDate}.`
                : 'Your public address: /u/username. Lowercase letters, numbers, dot, dash, underscore.'}
            </span>
            {handleLocked ? <input type="hidden" name="handle" value={v.handle} /> : null}
          </div>
          {f.headline.enabled ? (
            <div className="settings-field">
              {head({
                htmlFor: 'pf-headline',
                label: 'Headline',
                field: 'headline',
                required: f.headline.required,
              })}
              <input
                id="pf-headline"
                type="text"
                name="headline"
                maxLength={120}
                defaultValue={v.headline}
                disabled={pending}
                placeholder="A short line under your name"
              />
            </div>
          ) : null}
          <p className="settings-hint">
            Your sign-in email{model.email ? <> (<strong>{model.email}</strong>)</> : null} and
            password are managed under account security.
          </p>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Images</legend>
          <div className="settings-field">{renderImage('avatar')}</div>
          {f.cover.enabled ? (
            <div className="settings-field">
              {head({ label: 'Cover image visibility', field: 'cover', required: f.cover.required })}
              {renderImage('cover')}
            </div>
          ) : null}
        </fieldset>

        {f.bio.enabled ? (
          <fieldset className="settings-fieldset sf-profile-section-wide">
            <legend>About</legend>
            <div className="settings-field">
              {head({ htmlFor: 'pf-bio', label: 'Bio', field: 'bio', required: f.bio.required })}
              <textarea
                id="pf-bio"
                name="bio"
                rows={6}
                maxLength={2000}
                defaultValue={v.bio}
                disabled={pending}
                placeholder="Tell the community about yourself…"
              />
            </div>
          </fieldset>
        ) : null}

        {f.birthDate.enabled || f.gender.enabled ? (
          <fieldset className="settings-fieldset">
            <legend>Personal</legend>
            {f.birthDate.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-birthDate',
                  label: 'Date of birth',
                  field: 'birthDate',
                  required: f.birthDate.required,
                })}
                <input
                  id="pf-birthDate"
                  type="date"
                  name="birthDate"
                  defaultValue={v.birthDate}
                  disabled={pending}
                  min="1900-01-01"
                />
                <span className="settings-hint">
                  Others only ever see your age — and only if you allow it. Events can use it
                  for age limits.
                </span>
              </div>
            ) : null}
            {f.gender.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-gender',
                  label: 'Gender',
                  field: 'gender',
                  required: f.gender.required,
                })}
                <select id="pf-gender" name="gender" defaultValue={v.gender} disabled={pending}>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {f.country.enabled || f.city.enabled || f.location.enabled ? (
          <fieldset className="settings-fieldset">
            <legend>Location</legend>
            {f.country.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-country',
                  label: 'Country',
                  field: 'country',
                  required: f.country.required,
                })}
                <select id="pf-country" name="country" defaultValue={v.country} disabled={pending}>
                  <option value="">—</option>
                  {countries.length === 0 && v.country ? (
                    <option value={v.country}>{v.country}</option>
                  ) : null}
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {f.city.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-city',
                  label: 'City',
                  field: 'city',
                  required: f.city.required,
                })}
                <input
                  id="pf-city"
                  type="text"
                  name="city"
                  maxLength={80}
                  defaultValue={v.city}
                  disabled={pending}
                  autoComplete="address-level2"
                />
              </div>
            ) : null}
            {f.location.enabled ? (
              <div className="settings-field">
                {head({
                  label: 'Map location (approximate)',
                  field: 'location',
                  required: f.location.required,
                })}
                <input type="hidden" name="latitude" value={latitude} />
                <input type="hidden" name="longitude" value={longitude} />
                {mapClientConfig ? (
                  <VenueLocationMap
                    clientConfig={mapClientConfig}
                    latitude={lat}
                    longitude={lng}
                    disabled={pending}
                    height="14rem"
                    onPick={(a, b) => {
                      setLatitude(String(Number(a.toFixed(5))))
                      setLongitude(String(Number(b.toFixed(5))))
                    }}
                  />
                ) : (
                  <span className="settings-hint">Map is not enabled on this site.</span>
                )}
                {lat != null && lng != null ? (
                  <button
                    type="button"
                    className={btn(chrome, 'muted')}
                    disabled={pending}
                    onClick={() => {
                      setLatitude('')
                      setLongitude('')
                    }}
                  >
                    Clear pin
                  </button>
                ) : null}
                <span className="settings-hint">
                  Other members only ever see the area (about 1 km), never the exact pin.
                </span>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {f.website.enabled || f.phone.enabled || f.links.enabled ? (
          <fieldset className="settings-fieldset">
            <legend>Contact &amp; links</legend>
            {f.website.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-website',
                  label: 'Website',
                  field: 'website',
                  required: f.website.required,
                })}
                <input
                  id="pf-website"
                  type="url"
                  name="website"
                  maxLength={500}
                  defaultValue={v.website}
                  disabled={pending}
                  placeholder="https://"
                />
              </div>
            ) : null}
            {f.phone.enabled ? (
              <div className="settings-field">
                {head({
                  htmlFor: 'pf-phone',
                  label: 'Phone',
                  field: 'phone',
                  required: f.phone.required,
                })}
                <input
                  id="pf-phone"
                  type="text"
                  name="phone"
                  maxLength={32}
                  defaultValue={v.phone}
                  disabled={pending}
                  autoComplete="tel"
                />
              </div>
            ) : null}
            {f.links.enabled ? (
              <div className="settings-field">
                {head({ label: 'Social links', field: 'links', required: f.links.required })}
                <ul className="sf-profile-links">
                  {links.map((link, i) => (
                    <li key={i}>
                      <input
                        type="text"
                        aria-label={`Link ${i + 1} label`}
                        placeholder="Label (Instagram…)"
                        maxLength={40}
                        value={link.label}
                        disabled={pending}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                          )
                        }
                      />
                      <input
                        type="url"
                        aria-label={`Link ${i + 1} address`}
                        placeholder="https://"
                        maxLength={500}
                        value={link.url}
                        disabled={pending}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={btn(chrome, 'muted')}
                        disabled={pending}
                        onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {links.length < PROFILE_LINKS_MAX ? (
                  <button
                    type="button"
                    className={btn(chrome, 'muted')}
                    disabled={pending}
                    onClick={() => setLinks((prev) => [...prev, { label: '', url: '' }])}
                  >
                    Add link
                  </button>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {f.locale.enabled || f.timezone.enabled ? (
          <fieldset className="settings-fieldset">
            <legend>Preferences</legend>
            {f.locale.enabled && model.locales.length > 0 ? (
              <div className="settings-field">
                {head({ htmlFor: 'pf-locale', label: 'Language' })}
                <select id="pf-locale" name="locale" defaultValue={v.locale} disabled={pending}>
                  <option value="">Site default</option>
                  {model.locales.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {f.timezone.enabled ? (
              <div className="settings-field">
                {head({ htmlFor: 'pf-timezone', label: 'Time zone' })}
                <input
                  id="pf-timezone"
                  type="text"
                  name="timezone"
                  list="pf-timezones"
                  defaultValue={v.timezone}
                  disabled={pending}
                  placeholder="Europe/Budapest"
                  autoComplete="off"
                />
                <datalist id="pf-timezones">
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </div>
            ) : null}
            <p className="settings-hint">Preferences are private — only you see them.</p>
          </fieldset>
        ) : null}
      </div>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="admin-inline-ok" role="status">
          {state.message}
          {state.handle && viewHrefPrefix ? (
            <>
              {' '}
              <Link href={`${viewHrefPrefix}${state.handle}`}>View profile</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="page-settings-actions sf-profile-form-actions">
        <Link
          href={cancelHref}
          className={chrome === 'admin' ? btn(chrome, 'muted') : 'sf-profile-link-btn'}
        >
          Cancel
        </Link>
        <button type="submit" className={btn(chrome, 'save')} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {imagePicker === 'library' && frameEditor ? (
        <ImageFrameEditor
          open
          src={`/api/media/${frameEditor === 'avatar' ? avatar : cover}`}
          value={frameEditor === 'avatar' ? avatarFrame : coverFrame}
          shape={frameEditor === 'avatar' ? 'circle' : 'wide'}
          title={frameEditor === 'avatar' ? 'Adjust avatar' : 'Adjust cover'}
          chrome={chrome}
          onCancel={() => setFrameEditor(null)}
          onApply={(next) => {
            if (frameEditor === 'avatar') setAvatarFrame(next)
            else setCoverFrame(next)
            setFrameEditor(null)
          }}
        />
      ) : null}
    </form>
  )
}
