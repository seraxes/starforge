'use client'

/**
 * Form particle cog. Loaded through the generated editor loader so a flavor
 * that omits the form particle does not compile this file from the layout app.
 */

import React, { useActionState, useEffect, useState } from 'react'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { useAutosaveForm } from '@/app/(frontend)/admin/use-autosave-form'
import { LayoutIdField } from '@/app/(frontend)/admin/layouts/layout-outline-context'
import { ParticleSettingsPopover } from '@/app/(frontend)/admin/layouts/particle-settings-popover'
import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'
import {
  defaultFormFields,
  parseCustomFormParticleJson,
  readFormConfig,
  resolveFormParticleSource,
} from '@/modules/forms/config'
import type { FormFieldDef, FormParticleSource } from '@/modules/forms/types'

type FormDefinitionOption = { id: string; label: string }

function SettingsShell({
  title,
  embedded,
  children,
}: {
  title: string
  embedded?: boolean
  children: React.ReactNode
}) {
  if (embedded) return <>{children}</>
  return <ParticleSettingsPopover title={title}>{children}</ParticleSettingsPopover>
}

const initialState: LayoutActionState = {}

function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  return null
}

function useParticleAutosaveResult(
  state: LayoutActionState,
  onConfigSaved?: (config: LayoutSlotConfig) => void,
) {
  useNotifySavedOnOk(state, { toastErrors: true })
  useEffect(() => {
    if (!state.ok || !state.config) return
    onConfigSaved?.(state.config)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when action result changes
  }, [state.ok, state.config, state.message])
}

function particleFormAutosaveProps(
  saveDebounced: () => void,
  saveNow: () => void,
): React.HTMLAttributes<HTMLFormElement> {
  return {
    onInput: saveDebounced,
    onChange: (e) => {
      const t = e.target
      if (
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLInputElement &&
          (t.type === 'checkbox' || t.type === 'radio' || t.type === 'color'))
      ) {
        saveNow()
      }
    },
    onBlur: (e) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) saveNow()
    },
  }
}

export function FormParticleEditor({
  sectionId,
  rowId,
  slot,
  formDefinitions = [],
  formsModuleEnabled = true,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  formDefinitions?: FormDefinitionOption[]
  /** When false, Forms product is off — definition list unavailable; custom JSON still editable. */
  formsModuleEnabled?: boolean
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const seed = () => {
    const cfg = readFormConfig(slot.config)
    const source = resolveFormParticleSource(cfg)
    const fields = [...(cfg.fields ?? [])] as FormFieldDef[]
    return {
      source,
      formId: cfg.formId ?? (formDefinitions[0]?.id || 'contact'),
      heading: cfg.heading ?? '',
      useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
      fields,
      fieldsJson: JSON.stringify(fields.length ? fields : [], null, 2),
      successMessage: cfg.successMessage ?? '',
      submitLabel: cfg.submitLabel ?? '',
    }
  }

  const [source, setSource] = useState<FormParticleSource>(() => seed().source)
  const [formId, setFormId] = useState(() => seed().formId)
  const [heading, setHeading] = useState(() => seed().heading)
  const [useSiteCaptchaDefault, setUseSiteCaptchaDefault] = useState(
    () => seed().useSiteCaptchaDefault,
  )
  const [fields, setFields] = useState<FormFieldDef[]>(() => seed().fields)
  const [fieldsJson, setFieldsJson] = useState(() => seed().fieldsJson)
  const [successMessage, setSuccessMessage] = useState(() => seed().successMessage)
  const [submitLabel, setSubmitLabel] = useState(() => seed().submitLabel)
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    const next = seed()
    setSource(next.source)
    setFormId(next.formId)
    setHeading(next.heading)
    setUseSiteCaptchaDefault(next.useSiteCaptchaDefault)
    setFields(next.fields)
    setFieldsJson(next.fieldsJson)
    setSuccessMessage(next.successMessage)
    setSubmitLabel(next.submitLabel)
    setJsonError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when switching slots
  }, [slot.id])

  function applyFieldsJson(raw: string) {
    setFieldsJson(raw)
    try {
      const parsed = parseCustomFormParticleJson(JSON.parse(raw) as unknown)
      setFields(parsed.fields)
      if (parsed.heading) setHeading(parsed.heading)
      if (parsed.successMessage) setSuccessMessage(parsed.successMessage)
      if (parsed.submitLabel) setSubmitLabel(parsed.submitLabel)
      setJsonError(null)
      saveDebounced()
    } catch (error) {
      setJsonError(error instanceof Error && error.message ? error.message : 'Invalid JSON.')
    }
  }

  const definitionMode = source === 'definition'
  const selectedFormExists = formDefinitions.some((f) => f.id === formId)
  const configJson = JSON.stringify({
    source,
    formId: definitionMode ? formId : undefined,
    heading: heading || undefined,
    successMessage: successMessage || undefined,
    submitLabel: submitLabel || undefined,
    useSiteCaptchaDefault,
    fields: definitionMode ? undefined : fields,
    fieldsJson: definitionMode ? undefined : fieldsJson,
  })

  return (
    <SettingsShell title="Form settings" embedded={embedded}>
      <form
        ref={formRef}
        action={formAction}
        className="gantry-typed-form"
        {...particleFormAutosaveProps(saveDebounced, saveNow)}
      >
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <input type="hidden" name="configJson" value={configJson} />

        <label>
          <span>Mode</span>
          <select
            value={source}
            onChange={(e) => {
              const next: FormParticleSource = e.target.value === 'custom' ? 'custom' : 'definition'
              setSource(next)
              if (next === 'custom' && fields.length === 0) {
                const seeded = defaultFormFields()
                setFields(seeded)
                setFieldsJson(JSON.stringify(seeded, null, 2))
                if (!successMessage) {
                  setSuccessMessage('Thanks — your message was sent.')
                }
                if (!submitLabel) setSubmitLabel('Send')
              }
              queueMicrotask(saveNow)
            }}
          >
            <option value="definition" disabled={!formsModuleEnabled}>
              Existing form
            </option>
            <option value="custom">Custom JSON</option>
          </select>
        </label>

        {!formsModuleEnabled ? (
          <p className="layout-muted" role="status">
            Forms module is off (Site Settings → Modules). Public Form particles stay hidden;
            enable Forms to pick a saved definition, or keep Custom JSON for slot config only.
          </p>
        ) : null}

        {definitionMode ? (
          <>
            <label>
              <span>Form</span>
              <select
                value={formId}
                disabled={!formsModuleEnabled}
                onChange={(e) => {
                  setFormId(e.target.value)
                  queueMicrotask(saveNow)
                }}
              >
                {formDefinitions.length === 0 ? (
                  <option value="contact">Contact (default)</option>
                ) : (
                  formDefinitions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} ({f.id})
                    </option>
                  ))
                )}
                {formId && !selectedFormExists && formId !== 'contact' ? (
                  <option value={formId}>{formId} (missing)</option>
                ) : null}
              </select>
            </label>
            <p className="layout-muted">
              Definitions from <a href={`/admin/forms/${formId || 'contact'}`}>Admin → Forms</a>
              {formDefinitions.length === 0
                ? ' — none saved yet; Contact default is used until you create one.'
                : '.'}
            </p>
            <label>
              <span>Heading override</span>
              <input
                type="text"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Uses definition title when empty"
              />
            </label>
          </>
        ) : (
          <>
            <label>
              <span>Heading</span>
              <input
                type="text"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Contact"
              />
            </label>
            <label>
              <span>Success message</span>
              <input
                type="text"
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
              />
            </label>
            <label>
              <span>Submit label</span>
              <input
                type="text"
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
              />
            </label>
            <label>
              <span>Form JSON</span>
              <textarea
                rows={10}
                value={fieldsJson}
                onChange={(e) => applyFieldsJson(e.target.value)}
                spellCheck={false}
                placeholder='Fields array, definition document, or JSON Schema object'
              />
            </label>
            <p className="layout-muted">
              Paste a fields array, a Form definition document, or a JSON Schema{' '}
              <code>{'{ type: "object", properties: … }'}</code>. Prefer Admin → Forms when the
              module is on.
            </p>
            {jsonError ? (
              <p className="admin-inline-error" role="alert">
                {jsonError}
              </p>
            ) : null}
          </>
        )}

        <label className="gantry-typed-check">
          <input
            type="checkbox"
            checked={useSiteCaptchaDefault}
            onChange={(e) => {
              setUseSiteCaptchaDefault(e.target.checked)
              queueMicrotask(saveNow)
            }}
          />
          <span>Use site captcha default (Settings → Security)</span>
        </label>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}
