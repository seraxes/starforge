'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import type { MapClientConfig } from '@/core/maps/types'
import { ACTIVE_HERO } from '@/generated/module-registry'
import {
  DEFAULT_IMAGE_FRAME,
  FramedImage,
  ImageFrameEditor,
  MediaPicker,
  MemberMediaPicker,
  mediaFrameSrc,
  normalizeImageFrame,
  type ImageFrame,
} from '@/modules/media/api'
const VenueLocationMap = dynamic(() =>
  import('@/modules/maps/api').then((mod) => mod.VenueLocationMap),
)

import { clampGridWidth, LAYOUT_WIDTH_FULL } from '@/core/modules/grid'

import { countryOptions } from '../countries'
import {
  GENDER_OPTIONS,
  PROFILE_LINKS_MAX,
  type ProfileFieldKey,
  type ProfileLink,
  type VisibilityScope,
} from '../fields'
import { HeroProfileFields } from './HeroProfileFields'
import { ProfileVisibilityControl } from './ProfileVisibilityControl'
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
}: {
  htmlFor?: string
  label: string
  required?: boolean
}) {
  return (
    <span className="sf-profile-field-head">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
    </span>
  )
}

/**
 * The one profile editor — member self-service (`/account/profile`) and admin
 * (`/admin/profiles/[userId]`) render this same component; only chrome, image
 * picker and action differ. Field list / labels / order come from the Forms
 * `profile` definition via `model.sections`.
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
  const t = useTranslations('product:profiles')
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

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

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

  function visibilityFor(key: ProfileFieldKey): VisibilityScope | null {
    const state = f[key]
    if (!state?.configurable) return null
    return visibility[key] ?? state.visibility
  }

  function withVisibility(
    key: ProfileFieldKey,
    placement: 'inline' | 'corner',
    children: React.ReactNode,
  ): React.ReactNode {
    const scope = visibilityFor(key)
    if (!scope) return children
    return (
      <div className={`sf-profile-control sf-profile-control--${placement}`}>
        {children}
        <ProfileVisibilityControl
          label={f[key].label}
          scope={scope}
          scopes={model.scopes}
          disabled={pending}
          onChange={(next) => setScope(key, next)}
        />
      </div>
    )
  }

  function renderImage(kind: 'avatar' | 'cover') {
    const label = f[kind].label
    const value = kind === 'avatar' ? avatar : cover
    const setValue = kind === 'avatar' ? setAvatar : setCover
    const frame = kind === 'avatar' ? avatarFrame : coverFrame
    const setFrame = kind === 'avatar' ? setAvatarFrame : setCoverFrame
    const shape = kind === 'avatar' ? 'circle' : 'wide'
    const src = value ? mediaFrameSrc(value) : ''

    if (imagePicker === 'library') {
      return (
        <div className={`sf-profile-library-image sf-profile-library-image--${shape}`}>
          <div className="sf-profile-media-preview">
            {src ? (
              <FramedImage src={src} frame={frame} shape={shape} alt="" />
            ) : (
              <span className="sf-member-media-empty">{t('noImage')}</span>
            )}
          </div>
          <MediaPicker
            label={label}
            value={{ mediaId: value, url: '', alt: '' }}
            defaultFolder="general"
            defaultPurpose="photo"
            disabled={pending}
            includeHiddenInputs={false}
            allowUrlFallback={false}
            showPreview={false}
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
              {t('adjustCrop')}
            </button>
          ) : null}
        </div>
      )
    }
    if (!canUpload) {
      return <p className="settings-hint">{t('uploadsDisabled')}</p>
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

  function renderField(key: ProfileFieldKey): React.ReactNode {
    const field = f[key]
    if (!field?.enabled) return null
    const label = field.label
    const required = field.required
    const placeholder = field.placeholder
    const hint = field.description

    switch (key) {
      case 'displayName':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-displayName" label={label} required />
            <input
              id="pf-displayName"
              type="text"
              name="displayName"
              required
              maxLength={80}
              defaultValue={v.displayName}
              disabled={pending}
              autoComplete="name"
              placeholder={placeholder || undefined}
            />
          </div>
        )
      case 'handle':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-handle" label={label} required />
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
              placeholder={placeholder || undefined}
            />
            <span className="settings-hint">
              {handleLocked
                ? t('handleLockedHint', { date: handleLockedDate })
                : hint || t('handleHintDefault')}
            </span>
            {handleLocked ? <input type="hidden" name="handle" value={v.handle} /> : null}
          </div>
        )
      case 'headline':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-headline" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <input
                id="pf-headline"
                type="text"
                name="headline"
                maxLength={120}
                defaultValue={v.headline}
                disabled={pending}
                placeholder={placeholder || t('headlinePlaceholder')}
              />,
            )}
          </div>
        )
      case 'avatar':
        return (
          <div key={key} className="settings-field">
            {renderImage('avatar')}
          </div>
        )
      case 'cover':
        return (
          <div key={key} className="settings-field">
            {withVisibility(key, 'corner', renderImage('cover'))}
          </div>
        )
      case 'bio':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-bio" label={label} required={required} />
            {withVisibility(
              key,
              'corner',
              <textarea
                id="pf-bio"
                name="bio"
                rows={6}
                maxLength={2000}
                defaultValue={v.bio}
                disabled={pending}
                placeholder={placeholder || t('bioPlaceholder')}
              />,
            )}
          </div>
        )
      case 'birthDate':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-birthDate" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <input
                id="pf-birthDate"
                type="date"
                name="birthDate"
                defaultValue={v.birthDate}
                disabled={pending}
                min="1900-01-01"
              />,
            )}
            <span className="settings-hint">
              {hint || t('birthDateHintDefault')}
            </span>
          </div>
        )
      case 'gender': {
        const genderChrome: Record<string, string> = {
          '': t('genderPreferNot'),
          female: t('genderFemale'),
          male: t('genderMale'),
          nonbinary: t('genderNonbinary'),
        }
        const options =
          field.options && field.options.length > 0
            ? field.options
            : GENDER_OPTIONS.map((o) => ({
                value: o.value,
                label: genderChrome[o.value] ?? o.label,
              }))
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-gender" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <select id="pf-gender" name="gender" defaultValue={v.gender} disabled={pending}>
                {options.map((o) => (
                  <option key={o.value || '_empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>,
            )}
          </div>
        )
      }
      case 'country':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-country" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
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
              </select>,
            )}
          </div>
        )
      case 'city':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-city" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <input
                id="pf-city"
                type="text"
                name="city"
                maxLength={80}
                defaultValue={v.city}
                disabled={pending}
                autoComplete="address-level2"
                placeholder={placeholder || undefined}
              />,
            )}
          </div>
        )
      case 'location':
        return (
          <div key={key} className="settings-field">
            <FieldHead label={label} required={required} />
            <input type="hidden" name="latitude" value={latitude} />
            <input type="hidden" name="longitude" value={longitude} />
            {withVisibility(
              key,
              'corner',
              <div className="sf-profile-location-body">
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
                  <span className="settings-hint">{t('mapDisabled')}</span>
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
                    {t('clearPin')}
                  </button>
                ) : null}
              </div>,
            )}
            <span className="settings-hint">
              {hint || t('locationHintDefault')}
            </span>
          </div>
        )
      case 'website':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-website" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <input
                id="pf-website"
                type="url"
                name="website"
                maxLength={500}
                defaultValue={v.website}
                disabled={pending}
                placeholder={placeholder || t('websitePlaceholder')}
              />,
            )}
          </div>
        )
      case 'phone':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-phone" label={label} required={required} />
            {withVisibility(
              key,
              'inline',
              <input
                id="pf-phone"
                type="text"
                name="phone"
                maxLength={32}
                defaultValue={v.phone}
                disabled={pending}
                autoComplete="tel"
                placeholder={placeholder || undefined}
              />,
            )}
          </div>
        )
      case 'links':
        return (
          <div key={key} className="settings-field">
            <FieldHead label={label} required={required} />
            {withVisibility(
              key,
              'corner',
              <div className="sf-profile-links-body">
                <ul className="sf-profile-links">
                  {links.map((link, i) => (
                    <li key={i}>
                      <input
                        type="text"
                        aria-label={t('linkLabelAria', { n: i + 1 })}
                        placeholder={t('linkLabelPlaceholder')}
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
                        aria-label={t('linkUrlAria', { n: i + 1 })}
                        placeholder={t('websitePlaceholder')}
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
                        {t('remove')}
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
                    {t('addLink')}
                  </button>
                ) : null}
              </div>,
            )}
          </div>
        )
      case 'locale':
        if (model.locales.length === 0) return null
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-locale" label={label} />
            <select id="pf-locale" name="locale" defaultValue={v.locale} disabled={pending}>
              <option value="">{t('siteDefaultLocale')}</option>
              {model.locales.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )
      case 'timezone':
        return (
          <div key={key} className="settings-field">
            <FieldHead htmlFor="pf-timezone" label={label} />
            <input
              id="pf-timezone"
              type="text"
              name="timezone"
              list="pf-timezones"
              defaultValue={v.timezone}
              disabled={pending}
              placeholder={placeholder || t('timezonePlaceholder')}
              autoComplete="off"
            />
            <datalist id="pf-timezones">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
        )
      default:
        return null
    }
  }

  const showIdentityEmailHint = model.sections.some((s) =>
    s.fields.some((k) => k === 'displayName' || k === 'handle'),
  )
  const showPrefsHint = model.sections.some((s) =>
    s.fields.some((k) => k === 'locale' || k === 'timezone'),
  )

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
        {model.sections.map((section) => {
          const width = clampGridWidth(section.width, LAYOUT_WIDTH_FULL)
          const rows =
            section.rows?.length > 0
              ? section.rows
              : section.fields.map((key, index) => ({
                  id: `row_${key}_${index}`,
                  columns: [{ key, width: LAYOUT_WIDTH_FULL }],
                }))
          return (
            <fieldset
              key={section.id}
              className="settings-fieldset"
              data-sf-width={width}
            >
              <legend>{section.label}</legend>
              {rows.map((row) => {
                const multi = row.columns.length > 1
                return (
                  <div
                    key={row.id}
                    className={multi ? 'sf-form-row sf-form-row-multi' : 'sf-form-row'}
                  >
                    {row.columns.map((col) => {
                      const pct = col.width || LAYOUT_WIDTH_FULL
                      return (
                        <div
                          key={col.key}
                          className="sf-form-col"
                          data-sf-width={pct}
                          style={
                            multi
                              ? {
                                  flex: `${pct} 1 0`,
                                  maxWidth: `${pct}%`,
                                  width: `${pct}%`,
                                  minWidth: 0,
                                }
                              : undefined
                          }
                        >
                          {renderField(col.key)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {showIdentityEmailHint &&
              section.fields.includes('displayName') &&
              section.fields.includes('handle') ? (
                <p className="settings-hint">
                  {model.email
                    ? t('identityEmailHintWithEmail', { email: model.email })
                    : t('identityEmailHint')}
                </p>
              ) : null}
              {showPrefsHint &&
              (section.fields.includes('locale') || section.fields.includes('timezone')) ? (
                <p className="settings-hint">{t('prefsPrivateHint')}</p>
              ) : null}
          </fieldset>
        )
        })}
        {ACTIVE_HERO.profileFields.length > 0 ? (
          <HeroProfileFields
            heroId={ACTIVE_HERO.id}
            legend={ACTIVE_HERO.label}
            fields={ACTIVE_HERO.profileFields}
            values={model.heroExtensionValues}
            disabled={pending}
          />
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
              <Link href={`${viewHrefPrefix}${state.handle}`}>{t('viewProfile')}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="page-settings-actions sf-profile-form-actions">
        <Link
          href={cancelHref}
          className={chrome === 'admin' ? btn(chrome, 'muted') : 'sf-profile-link-btn'}
        >
          {t('cancel')}
        </Link>
        <button type="submit" className={btn(chrome, 'save')} disabled={pending}>
          {pending ? t('saving') : t('save')}
        </button>
      </div>

      {imagePicker === 'library' && frameEditor ? (
        <ImageFrameEditor
          open
          src={mediaFrameSrc(frameEditor === 'avatar' ? avatar : cover)}
          value={frameEditor === 'avatar' ? avatarFrame : coverFrame}
          shape={frameEditor === 'avatar' ? 'circle' : 'wide'}
          title={frameEditor === 'avatar' ? t('adjustAvatar') : t('adjustCover')}
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
