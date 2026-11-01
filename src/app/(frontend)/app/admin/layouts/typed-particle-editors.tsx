'use client'

import React, { useActionState, useEffect, useState } from 'react'

import { readFormConfig } from '@/core/forms/config'
import type { FormFieldDef } from '@/core/forms/types'
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

export type NavMenuOption = { id: string; label: string }

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
            <label>
              <span>Payload Media id</span>
              <input
                type="text"
                name="mediaId"
                value={draft.mediaId ?? ''}
                onChange={(e) => patchDraft({ mediaId: e.target.value })}
                placeholder="optional"
              />
            </label>
            <label>
              <span>Image URL</span>
              <input
                type="url"
                name="mediaUrl"
                value={draft.mediaUrl ?? ''}
                onChange={(e) => patchDraft({ mediaUrl: e.target.value })}
                placeholder="https://… or /media/…"
              />
            </label>
            <p className="layout-muted">
              Use Media id when available, or a URL as a placeholder until the media picker lands.
            </p>
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
          <span>Nav menu set</span>
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
          Menus come from <code>/app/admin/nav</code>. Site primary is assigned under Site Settings.
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
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateFormSlotAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const seed = () => {
    const cfg = readFormConfig(slot.config)
    return {
      heading: cfg.heading ?? '',
      successMessage: cfg.successMessage ?? '',
      submitLabel: cfg.submitLabel ?? 'Send',
      useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
      fields: [...(cfg.fields ?? [])] as FormFieldDef[],
      fieldsJson: JSON.stringify(cfg.fields ?? [], null, 2),
    }
  }

  const [heading, setHeading] = useState(() => seed().heading)
  const [successMessage, setSuccessMessage] = useState(() => seed().successMessage)
  const [submitLabel, setSubmitLabel] = useState(() => seed().submitLabel)
  const [useSiteCaptchaDefault, setUseSiteCaptchaDefault] = useState(
    () => seed().useSiteCaptchaDefault,
  )
  const [fields, setFields] = useState<FormFieldDef[]>(() => seed().fields)
  const [fieldsJson, setFieldsJson] = useState(() => seed().fieldsJson)
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    const next = seed()
    setHeading(next.heading)
    setSuccessMessage(next.successMessage)
    setSubmitLabel(next.submitLabel)
    setUseSiteCaptchaDefault(next.useSiteCaptchaDefault)
    setFields(next.fields)
    setFieldsJson(next.fieldsJson)
    setJsonError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when switching slots
  }, [slot.id])

  function applyFieldsJson(raw: string) {
    setFieldsJson(raw)
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        setJsonError('Fields must be a JSON array.')
        return
      }
      setFields(parsed as FormFieldDef[])
      setJsonError(null)
      saveDebounced()
    } catch {
      setJsonError('Invalid JSON.')
    }
  }

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
        <input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />
        <label>
          <span>Heading</span>
          <input
            type="text"
            name="heading"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
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
          <span>Use site captcha default (Site Chrome)</span>
        </label>
        <p className="layout-muted">
          Fields JSON — each item: <code>name</code>, <code>label</code>,{' '}
          <code>type</code> (text|email|textarea), optional <code>required</code>,{' '}
          <code>placeholder</code>. Defaults: name, email, message.
        </p>
        <label>
          <span>Fields (JSON)</span>
          <textarea
            rows={10}
            value={fieldsJson}
            onChange={(e) => applyFieldsJson(e.target.value)}
            spellCheck={false}
          />
        </label>
        {jsonError ? (
          <p className="admin-inline-error" role="alert">
            {jsonError}
          </p>
        ) : null}
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
  primaryNavMenuId = 'main',
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus?: NavMenuOption[]
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
        embedded={embedded}
        onConfigSaved={onConfigSaved}
      />
    )
  }
  return null
}
