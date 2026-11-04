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
  type MediaPipelineRules,
} from '@/core/media/pipeline'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

const initialState: MediaActionState = {}

export function MediaSettingsForm({ rules }: { rules: MediaPipelineRules }) {
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
          JPEG quality applies when purpose is Logo and the original stays JPEG. WebP quality
          applies to photo originals (forced WebP) and logo WebP re-encodes.
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
            Keep PNG originals
            <span className="settings-flag-desc">
              PNG uploads stay PNG (resize only). Logo purpose also skips forced WebP for JPEG.
              Photos still convert to WebP.
            </span>
          </span>
        </label>
      </fieldset>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
