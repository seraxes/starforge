'use client'

import React, { useActionState } from 'react'

import {
  saveMediaPipelineSettingsAction,
  type MediaActionState,
} from '@/core/media/actions'
import {
  bootMediaDerivativeSizes,
  mediaDerivativeSizeDrift,
} from '@/core/media/library-query'
import {
  MEDIA_PIPELINE_MAX_EDGE_MAX,
  MEDIA_PIPELINE_MAX_EDGE_MIN,
  MEDIA_PIPELINE_QUALITY_MAX,
  MEDIA_PIPELINE_QUALITY_MIN,
  type MediaEncodeGroupMode,
  type MediaPipelineRules,
} from '@/core/media/pipeline'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { useAutosaveForm } from '@/app/(frontend)/admin/use-autosave-form'

const initialState: MediaActionState = {}

export type MediaSettingsGroupOption = {
  id: string
  label: string
  depth: number
}

function modeFor(
  map: Record<string, MediaEncodeGroupMode>,
  groupId: string,
): MediaEncodeGroupMode {
  return map[groupId] === 'choose' ? 'choose' : 'force'
}

export function MediaSettingsForm({
  rules,
  groups,
}: {
  rules: MediaPipelineRules
  groups: MediaSettingsGroupOption[]
}) {
  const [state, formAction, pending] = useActionState(
    saveMediaPipelineSettingsAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps, discreteAutosaveProps } = useAutosaveForm()

  const boot = bootMediaDerivativeSizes()
  const drift = mediaDerivativeSizeDrift(rules.sizes, boot)

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset">
          <legend>Original resize</legend>
          <p className="settings-hint">
            Cap longest edges on new uploads (no enlargement). Applies to Core library upload and
            Payload CMS Media uploads via the shared sharp pipeline.
          </p>
          <label className="settings-field">
            <span>Max width (px)</span>
            <input
              type="number"
              name="maxWidth"
              defaultValue={rules.maxWidth}
              min={MEDIA_PIPELINE_MAX_EDGE_MIN}
              max={MEDIA_PIPELINE_MAX_EDGE_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Max height (px)</span>
            <input
              type="number"
              name="maxHeight"
              defaultValue={rules.maxHeight}
              min={MEDIA_PIPELINE_MAX_EDGE_MIN}
              max={MEDIA_PIPELINE_MAX_EDGE_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Encode quality</legend>
          <p className="settings-hint">
            WebP quality applies to photo originals (decode on) and WebP re-encodes. JPEG quality
            applies when a logo stays JPEG or when decode is turned off for a JPEG upload.
          </p>
          <label className="settings-field">
            <span>JPEG quality</span>
            <input
              type="number"
              name="jpegQuality"
              defaultValue={rules.jpegQuality}
              min={MEDIA_PIPELINE_QUALITY_MIN}
              max={MEDIA_PIPELINE_QUALITY_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>WebP quality</span>
            <input
              type="number"
              name="webpQuality"
              defaultValue={rules.webpQuality}
              min={MEDIA_PIPELINE_QUALITY_MIN}
              max={MEDIA_PIPELINE_QUALITY_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Derivative sizes</legend>
          <p className="settings-hint">
            Target widths for thumbnail / card / large WebP derivatives (saved in{' '}
            <code>sf_media_settings</code>). Payload <code>imageSizes</code> still compile from
            boot-time defaults — restart the app after changing these so new uploads pick up the
            synced edges. Existing files keep prior derivatives until re-uploaded.
          </p>
          <label className="settings-field">
            <span>Thumbnail edge (px)</span>
            <input
              type="number"
              name="sizeThumbnail"
              defaultValue={rules.sizes.thumbnail}
              min={MEDIA_PIPELINE_MAX_EDGE_MIN}
              max={MEDIA_PIPELINE_MAX_EDGE_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Card width (px)</span>
            <input
              type="number"
              name="sizeCard"
              defaultValue={rules.sizes.card}
              min={MEDIA_PIPELINE_MAX_EDGE_MIN}
              max={MEDIA_PIPELINE_MAX_EDGE_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Large width (px)</span>
            <input
              type="number"
              name="sizeLarge"
              defaultValue={rules.sizes.large}
              min={MEDIA_PIPELINE_MAX_EDGE_MIN}
              max={MEDIA_PIPELINE_MAX_EDGE_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          {drift.length ? (
            <p className="layout-muted" role="status">
              Drift vs boot Payload sizes:{' '}
              {drift.map((d) => `${d.key} ${d.boot}→${d.saved}`).join(', ')}. Restart required for
              new upload derivatives.
            </p>
          ) : (
            <p className="layout-muted" role="status">
              Saved sizes match boot Payload <code>imageSizes</code> (
              {boot.thumbnail}/{boot.card}/{boot.large}).
            </p>
          )}
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>PNG / logos</legend>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="keepPngForLogos"
              defaultChecked={rules.keepPngForLogos}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              Keep PNG originals for logos
              <span className="settings-flag-desc">
                When purpose is Logo, PNG stays PNG (resize only) and JPEG stays JPEG. Photo PNG
                still converts to WebP when decode is on.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Who can change this</legend>
          <p className="settings-hint">
            Default is Automated (decode to WebP and resize always on). Groups set to Can choose
            see Decode to WebP and Resize next to the upload drop zone. App admins always can
            choose. Members with no matching group stay automated.
          </p>
          {groups.length === 0 ? (
            <p className="layout-muted" role="status">
              No user groups yet — create groups under Users → Groups to set per-group encode
              choice.
            </p>
          ) : (
            <div className="sf-media-encode-policy-table">
              <div className="sf-media-encode-policy-head" aria-hidden="true">
                <span>Group</span>
                <span>Decode to WebP</span>
                <span>Resize</span>
              </div>
              {groups.map((g) => (
                <div key={g.id} className="sf-media-encode-policy-row">
                  <span
                    className="sf-media-encode-policy-group"
                    style={{ paddingLeft: `${g.depth * 0.85}rem` }}
                  >
                    {g.label}
                  </span>
                  <label className="settings-field">
                    <span className="sr-only">Decode to WebP for {g.label}</span>
                    <select
                      name={`decodeByGroup:${g.id}`}
                      defaultValue={modeFor(rules.decodeByGroup, g.id)}
                      disabled={pending}
                      {...discreteAutosaveProps}
                    >
                      <option value="force">Automated</option>
                      <option value="choose">Can choose</option>
                    </select>
                  </label>
                  <label className="settings-field">
                    <span className="sr-only">Resize for {g.label}</span>
                    <select
                      name={`resizeByGroup:${g.id}`}
                      defaultValue={modeFor(rules.resizeByGroup, g.id)}
                      disabled={pending}
                      {...discreteAutosaveProps}
                    >
                      <option value="force">Automated</option>
                      <option value="choose">Can choose</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {state.error ? (
          <p className="admin-inline-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {pending ? <p className="field-hint">Saving…</p> : null}
      </div>
    </form>
  )
}
