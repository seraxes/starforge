'use client'

import React, { useActionState, useEffect, useState } from 'react'

import {
  defaultFormFields,
  parseCustomFormParticleJson,
  readFormConfig,
  resolveFormParticleSource,
} from '@/core/forms/config'
import type { FormFieldDef, FormParticleSource } from '@/core/forms/types'
import {
  updateCopyrightSlotAction,
  updateFormSlotAction,
  updateLogoSlotAction,
  updateMenuSlotAction,
  updateSocialSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  readCopyrightConfig,
  readLogoConfig,
  readMenuConfig,
  readSocialConfig,
  type CopyrightParticleConfig,
  type LogoParticleConfig,
  type MenuParticleConfig,
  type SocialLinkItem,
} from '@/core/modules/particles/config'
import { cssColorToColorInputValue, parseCssColorInput } from '@/core/modules/styles'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'
import { MediaPicker } from '@/components/admin/MediaPicker'

export type NavMenuOption = { id: string; label: string }
export type FormDefinitionOption = { id: string; label: string }

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { LayoutIdField } from './layout-outline-context'
import { ParticleSettingsPopover } from './particle-settings-popover'

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

function newSocialId() {
  return `social-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Toast on ok + patch parent slot config. Does not remount the form or call router.refresh —
 * local controlled drafts stay focused while debounce autosave runs.
 */
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

/** Form chrome shared by typed particle cogs: debounce text, immediate discrete controls. */
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

export function LogoParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateLogoSlotAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<LogoParticleConfig>(() => readLogoConfig(slot.config))
  const [colorText, setColorText] = useState(() => readLogoConfig(slot.config).color ?? '')

  // Local draft while cog is open — reset only when switching particles (never from save responses).
  useEffect(() => {
    const next = readLogoConfig(slot.config)
    setDraft(next)
    setColorText(next.color ?? '')
  }, [slot.id])

  const mode = draft.mode ?? 'image'
  const validHiddenColor =
    parseCssColorInput(colorText).status === 'ok'
      ? colorText.trim()
      : parseCssColorInput(draft.color ?? '').status === 'ok'
        ? (draft.color ?? '')
        : ''

  const patchDraft = (partial: Partial<LogoParticleConfig>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  return (
    <SettingsShell title="Logo / Image settings" embedded={embedded}>
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
        <label>
          <span>Mode</span>
          <select
            name="mode"
            value={mode}
            onChange={(e) => {
              patchDraft({ mode: e.target.value === 'text' ? 'text' : 'image' })
              queueMicrotask(saveNow)
            }}
          >
            <option value="image">Image</option>
            <option value="text">Text logo</option>
          </select>
        </label>
        <label>
          <span>Link URL (optional)</span>
          <input
            type="text"
            name="linkUrl"
            value={draft.linkUrl ?? ''}
            onChange={(e) => patchDraft({ linkUrl: e.target.value })}
            placeholder="/"
          />
        </label>

        {mode === 'text' ? (
          <>
            <label>
              <span>Text</span>
              <input
                type="text"
                name="text"
                value={draft.text ?? ''}
                onChange={(e) => patchDraft({ text: e.target.value })}
                placeholder="Brand name"
              />
            </label>
            <label>
              <span>Font family</span>
              <input
                type="text"
                name="fontFamily"
                value={draft.fontFamily ?? ''}
                onChange={(e) => patchDraft({ fontFamily: e.target.value })}
                placeholder="e.g. Georgia, serif (empty = site default)"
              />
            </label>
            <div className="gantry-typed-row">
              <label>
                <span>Size (px)</span>
                <input
                  type="number"
                  name="fontSize"
                  min={10}
                  max={120}
                  value={draft.fontSize ?? 28}
                  onChange={(e) =>
                    patchDraft({ fontSize: Number(e.target.value) || draft.fontSize || 28 })
                  }
                />
              </label>
              <label>
                <span>Weight</span>
                <input
                  type="text"
                  name="fontWeight"
                  value={String(draft.fontWeight ?? 700)}
                  onChange={(e) => patchDraft({ fontWeight: e.target.value })}
                  placeholder="700"
                />
              </label>
            </div>
            <label className="gantry-section-color-label">
              <span>Color</span>
              <span className="gantry-color-field">
                <input
                  type="color"
                  className="gantry-color-swatch"
                  value={cssColorToColorInputValue(colorText || draft.color)}
                  title="Logo text color"
                  aria-label="Logo text color picker"
                  onChange={(event) => {
                    setColorText(event.target.value)
                    patchDraft({ color: event.target.value })
                  }}
                />
                <input
                  type="text"
                  name="color"
                  className="gantry-section-color-input"
                  value={colorText}
                  onChange={(event) => {
                    setColorText(event.target.value)
                    patchDraft({ color: event.target.value })
                  }}
                  placeholder="#2a3340, rgb(), or named (empty = inherit)"
                  spellCheck={false}
                  autoComplete="off"
                />
              </span>
            </label>
            <p className="layout-muted">
              Text logo replaces Site Header brand text when you assemble Logo + Menu in the header
              row. Color accepts hex, rgb/rgba, hsl/hsla, or CSS named colors.
            </p>
            <input type="hidden" name="mediaId" value={draft.mediaId ?? ''} />
            <input type="hidden" name="mediaUrl" value={draft.mediaUrl ?? ''} />
            <input type="hidden" name="alt" value={draft.alt ?? 'Logo'} />
          </>
        ) : (
          <>
            <MediaPicker
              label="Logo image"
              value={{
                mediaId: draft.mediaId ?? '',
                url: draft.mediaUrl ?? '',
                alt: draft.alt ?? '',
              }}
              defaultFolder="logos"
              defaultPurpose="logo"
              hint="Library Media id is primary; raw URL is advanced fallback."
              onChange={(next) =>
                patchDraft({
                  mediaId: next.mediaId,
                  mediaUrl: next.url ?? '',
                  alt: next.alt || draft.alt || 'Logo',
                })
              }
            />
            <label>
              <span>Alt text</span>
              <input
                type="text"
                name="alt"
                value={draft.alt ?? ''}
                onChange={(e) => patchDraft({ alt: e.target.value })}
                required
              />
            </label>
            <div className="gantry-typed-row">
              <label>
                <span>Max width (px)</span>
                <input
                  type="number"
                  name="maxWidth"
                  min={1}
                  value={draft.maxWidth ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchDraft({ maxWidth: Number.isFinite(n) && n > 0 ? n : undefined })
                  }}
                  placeholder="e.g. 180"
                />
              </label>
              <label>
                <span>Max height (px)</span>
                <input
                  type="number"
                  name="maxHeight"
                  min={1}
                  value={draft.maxHeight ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchDraft({ maxHeight: Number.isFinite(n) && n > 0 ? n : undefined })
                  }}
                  placeholder="e.g. 64"
                />
              </label>
            </div>
            <input type="hidden" name="text" value={draft.text ?? ''} />
            <input type="hidden" name="fontFamily" value={draft.fontFamily ?? ''} />
            <input type="hidden" name="fontSize" value={String(draft.fontSize ?? 28)} />
            <input type="hidden" name="fontWeight" value={String(draft.fontWeight ?? 700)} />
            <input type="hidden" name="color" value={validHiddenColor} />
          </>
        )}
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}

export function MenuParticleEditor({
  sectionId,
  rowId,
  slot,
  navMenus,
  primaryNavMenuId,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus: NavMenuOption[]
  primaryNavMenuId: string
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateMenuSlotAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<MenuParticleConfig>(() => readMenuConfig(slot.config))

  useEffect(() => {
    setDraft(readMenuConfig(slot.config))
  }, [slot.id])

  const selected = (draft.menuId ?? '').trim() || 'primary'

  return (
    <SettingsShell title="Menu settings" embedded={embedded}>
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
        <label>
          <span>Navigation menu set</span>
          <select
            name="menuId"
            value={selected}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, menuId: e.target.value }))
              queueMicrotask(saveNow)
            }}
          >
            <option value="primary">
              Site primary
              {primaryNavMenuId ? ` (${primaryNavMenuId})` : ''}
            </option>
            {navMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.id})
              </option>
            ))}
          </select>
        </label>
        <p className="layout-muted">
          Menus come from <code>/app/admin/nav</code>. Site primary is assigned under Settings →
          Modules.
        </p>
        <label>
          <span>Aria label</span>
          <input
            type="text"
            name="ariaLabel"
            value={draft.ariaLabel ?? 'Primary'}
            onChange={(e) => setDraft((prev) => ({ ...prev, ariaLabel: e.target.value }))}
          />
        </label>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}

export function CopyrightParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateCopyrightSlotAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<CopyrightParticleConfig>(() =>
    readCopyrightConfig(slot.config),
  )

  useEffect(() => {
    setDraft(readCopyrightConfig(slot.config))
  }, [slot.id])

  const yearMode = draft.yearMode ?? 'auto'
  const patchDraft = (partial: Partial<CopyrightParticleConfig>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  return (
    <SettingsShell title="Copyright settings" embedded={embedded}>
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
        <label>
          <span>Text</span>
          <input
            type="text"
            name="text"
            value={draft.text ?? ''}
            onChange={(e) => patchDraft({ text: e.target.value })}
          />
        </label>
        <label>
          <span>Year mode</span>
          <select
            name="yearMode"
            value={yearMode}
            onChange={(e) => {
              patchDraft({ yearMode: e.target.value === 'manual' ? 'manual' : 'auto' })
              queueMicrotask(saveNow)
            }}
          >
            <option value="auto">Auto (current year)</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        {yearMode === 'manual' ? (
          <label>
            <span>Year</span>
            <input
              type="number"
              name="year"
              value={draft.year ?? new Date().getFullYear()}
              onChange={(e) =>
                patchDraft({
                  year: Number(e.target.value) || new Date().getFullYear(),
                })
              }
            />
          </label>
        ) : (
          <input
            type="hidden"
            name="year"
            value={String(draft.year ?? new Date().getFullYear())}
          />
        )}
        <label>
          <span>Link URL (optional)</span>
          <input
            type="text"
            name="linkUrl"
            value={draft.linkUrl ?? ''}
            onChange={(e) => patchDraft({ linkUrl: e.target.value })}
          />
        </label>
        <label>
          <span>Link label (optional)</span>
          <input
            type="text"
            name="linkLabel"
            value={draft.linkLabel ?? ''}
            onChange={(e) => patchDraft({ linkLabel: e.target.value })}
          />
        </label>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}

export function SocialParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateSocialSlotAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const seedItems = (): SocialLinkItem[] => {
    const initial = readSocialConfig(slot.config).items ?? []
    return initial.length > 0
      ? initial
      : [{ id: newSocialId(), platform: '', url: '', label: '', icon: '' }]
  }

  const [items, setItems] = useState<SocialLinkItem[]>(seedItems)
  const skipHydrateSave = React.useRef(true)

  useEffect(() => {
    skipHydrateSave.current = true
    setItems(seedItems())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when switching slots
  }, [slot.id])

  useEffect(() => {
    if (skipHydrateSave.current) {
      skipHydrateSave.current = false
      return
    }
    saveDebounced()
  }, [items, saveDebounced])

  return (
    <SettingsShell title="Social links" embedded={embedded}>
      <form
        ref={formRef}
        action={formAction}
        className="gantry-typed-form"
        onBlur={(e) => {
          const t = e.target
          if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) saveNow()
        }}
      >
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

        <ul className="gantry-social-editor-list">
          {items.map((item, index) => (
            <li key={item.id} className="gantry-social-editor-item">
              <label>
                <span>Platform</span>
                <input
                  type="text"
                  value={item.platform}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, platform: e.target.value }
                    setItems(next)
                  }}
                  placeholder="X / GitHub / …"
                />
              </label>
              <label>
                <span>URL</span>
                <input
                  type="url"
                  value={item.url}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, url: e.target.value }
                    setItems(next)
                  }}
                  placeholder="https://…"
                  required
                />
              </label>
              <label>
                <span>Label</span>
                <input
                  type="text"
                  value={item.label ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, label: e.target.value }
                    setItems(next)
                  }}
                  placeholder="optional"
                />
              </label>
              <label>
                <span>Icon</span>
                <input
                  type="text"
                  value={item.icon ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, icon: e.target.value }
                    setItems(next)
                  }}
                  placeholder="optional emoji / key"
                />
              </label>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setItems(items.filter((row) => row.id !== item.id))
                }}
                disabled={items.length <= 1}
              >
                Remove link
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted secondary"
          onClick={() =>
            setItems([
              ...items,
              { id: newSocialId(), platform: '', url: '', label: '', icon: '' },
            ])
          }
        >
          Add link
        </button>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
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
  const [state, formAction, pending] = useActionState(updateFormSlotAction, initialState)
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
      setJsonError(
        error instanceof Error && error.message ? error.message : 'Invalid JSON.',
      )
    }
  }

  const definitionMode = source === 'definition'
  const selectedFormExists = formDefinitions.some((f) => f.id === formId)

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
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="formId" value={definitionMode ? formId : ''} />
        <input
          type="hidden"
          name="fieldsJson"
          value={definitionMode ? '' : JSON.stringify(fields)}
        />

        <label>
          <span>Mode</span>
          <select
            value={source}
            onChange={(e) => {
              const next: FormParticleSource =
                e.target.value === 'custom' ? 'custom' : 'definition'
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
              Definitions from{' '}
              <a href={`/app/admin/forms/${formId || 'contact'}`}>Admin → Forms</a>
              {formDefinitions.length === 0
                ? ' — none saved yet; Contact default is used until you create one.'
                : '.'}
            </p>
            <label>
              <span>Heading override</span>
              <input
                type="text"
                name="heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Uses definition title when empty"
              />
            </label>
            <input type="hidden" name="successMessage" value="" />
            <input type="hidden" name="submitLabel" value="" />
          </>
        ) : (
          <>
            <label>
              <span>Heading</span>
              <input
                type="text"
                name="heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Contact"
              />
            </label>
            <label>
              <span>Success message</span>
              <input
                type="text"
                name="successMessage"
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
              />
            </label>
            <label>
              <span>Submit label</span>
              <input
                type="text"
                name="submitLabel"
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
            name="useSiteCaptchaDefault"
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

/** Renders the typed config editor for logo / menu / copyright / social / form slots. */
export function TypedParticleEditor({
  sectionId,
  rowId,
  slot,
  navMenus = [],
  formDefinitions = [],
  formsModuleEnabled = true,
  primaryNavMenuId = 'main',
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus?: NavMenuOption[]
  formDefinitions?: FormDefinitionOption[]
  formsModuleEnabled?: boolean
  primaryNavMenuId?: string
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  if (slot.moduleId === 'logo') {
    return (
      <LogoParticleEditor
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  if (slot.moduleId === 'menu') {
    return (
      <MenuParticleEditor
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        navMenus={navMenus}
        primaryNavMenuId={primaryNavMenuId}
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  if (slot.moduleId === 'copyright') {
    return (
      <CopyrightParticleEditor
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  if (slot.moduleId === 'social') {
    return (
      <SocialParticleEditor
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  if (slot.moduleId === 'form') {
    return (
      <FormParticleEditor
        sectionId={sectionId}
        rowId={rowId}
        slot={slot}
        formDefinitions={formDefinitions}
        formsModuleEnabled={formsModuleEnabled}
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  return null
}
