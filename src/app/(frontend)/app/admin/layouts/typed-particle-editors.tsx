'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  type SocialLinkItem,
} from '@/core/modules/particles/config'
import { cssColorToColorInputValue, parseCssColorInput } from '@/core/modules/styles'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'

export type NavMenuOption = { id: string; label: string }

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
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function newSocialId() {
  return `social-${Math.random().toString(36).slice(2, 9)}`
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
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateLogoSlotAction, initialState)
  const cfg = readLogoConfig(state.config ?? slot.config)
  const [mode, setMode] = useState(cfg.mode ?? 'image')
  const [colorText, setColorText] = useState(cfg.color ?? '')
  const [formRev, setFormRev] = useState(0)

  useEffect(() => {
    setMode(cfg.mode ?? 'image')
    setColorText(cfg.color ?? '')
  }, [cfg.mode, cfg.color])

  useEffect(() => {
    if (!state.ok || !state.config) return
    onConfigSaved?.(state.config)
    setFormRev((n) => n + 1)
    router.refresh()
    // Hydrate only when the server action result changes (not when parent re-creates callbacks).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [state.ok, state.config, state.message])

  const validHiddenColor =
    parseCssColorInput(colorText).status === 'ok'
      ? colorText.trim()
      : parseCssColorInput(cfg.color ?? '').status === 'ok'
        ? (cfg.color ?? '')
        : ''

  return (
    <SettingsShell title="Logo / Image settings" embedded={embedded}>
      <form key={formRev} action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span>Mode</span>
          <select
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value === 'text' ? 'text' : 'image')}
          >
            <option value="image">Image</option>
            <option value="text">Text logo</option>
          </select>
        </label>
        <label>
          <span>Link URL (optional)</span>
          <input type="text" name="linkUrl" defaultValue={cfg.linkUrl ?? ''} placeholder="/" />
        </label>

        {mode === 'text' ? (
          <>
            <label>
              <span>Text</span>
              <input type="text" name="text" defaultValue={cfg.text ?? ''} placeholder="Brand name" />
            </label>
            <label>
              <span>Font family</span>
              <input
                type="text"
                name="fontFamily"
                defaultValue={cfg.fontFamily ?? ''}
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
                  defaultValue={cfg.fontSize ?? 28}
                />
              </label>
              <label>
                <span>Weight</span>
                <input
                  type="text"
                  name="fontWeight"
                  defaultValue={String(cfg.fontWeight ?? 700)}
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
                  value={cssColorToColorInputValue(colorText || cfg.color)}
                  title="Logo text color"
                  aria-label="Logo text color picker"
                  onChange={(event) => setColorText(event.target.value)}
                />
                <input
                  type="text"
                  name="color"
                  className="gantry-section-color-input"
                  value={colorText}
                  onChange={(event) => setColorText(event.target.value)}
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
            {/* Keep image fields in the form so switching modes does not wipe saved values */}
            <input type="hidden" name="mediaId" value={cfg.mediaId ?? ''} />
            <input type="hidden" name="mediaUrl" value={cfg.mediaUrl ?? ''} />
            <input type="hidden" name="alt" value={cfg.alt ?? 'Logo'} />
          </>
        ) : (
          <>
            <label>
              <span>Payload Media id</span>
              <input
                type="text"
                name="mediaId"
                defaultValue={cfg.mediaId ?? ''}
                placeholder="optional"
              />
            </label>
            <label>
              <span>Image URL</span>
              <input
                type="url"
                name="mediaUrl"
                defaultValue={cfg.mediaUrl ?? ''}
                placeholder="https://… or /media/…"
              />
            </label>
            <p className="layout-muted">
              Use Media id when available, or a URL as a placeholder until the media picker lands.
            </p>
            <label>
              <span>Alt text</span>
              <input type="text" name="alt" defaultValue={cfg.alt ?? ''} required />
            </label>
            <div className="gantry-typed-row">
              <label>
                <span>Max width (px)</span>
                <input
                  type="number"
                  name="maxWidth"
                  min={1}
                  defaultValue={cfg.maxWidth ?? ''}
                  placeholder="e.g. 180"
                />
              </label>
              <label>
                <span>Max height (px)</span>
                <input
                  type="number"
                  name="maxHeight"
                  min={1}
                  defaultValue={cfg.maxHeight ?? ''}
                  placeholder="e.g. 64"
                />
              </label>
            </div>
            <input type="hidden" name="text" value={cfg.text ?? ''} />
            <input type="hidden" name="fontFamily" value={cfg.fontFamily ?? ''} />
            <input type="hidden" name="fontSize" value={String(cfg.fontSize ?? 28)} />
            <input type="hidden" name="fontWeight" value={String(cfg.fontWeight ?? 700)} />
            <input type="hidden" name="color" value={validHiddenColor} />
          </>
        )}
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Logo / Image'}
        </button>
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
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus: NavMenuOption[]
  primaryNavMenuId: string
  embedded?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateMenuSlotAction, initialState)
  const cfg = readMenuConfig(slot.config)
  const selected = (cfg.menuId ?? '').trim() || 'primary'

  return (
    <SettingsShell title="Menu settings" embedded={embedded}>
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span>Nav menu set</span>
          <select name="menuId" defaultValue={selected}>
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
          <input type="text" name="ariaLabel" defaultValue={cfg.ariaLabel ?? 'Primary'} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Menu'}
        </button>
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
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateCopyrightSlotAction, initialState)
  const cfg = readCopyrightConfig(slot.config)
  const [yearMode, setYearMode] = useState(cfg.yearMode ?? 'auto')

  return (
    <SettingsShell title="Copyright settings" embedded={embedded}>
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span>Text</span>
          <input type="text" name="text" defaultValue={cfg.text ?? ''} />
        </label>
        <label>
          <span>Year mode</span>
          <select
            name="yearMode"
            value={yearMode}
            onChange={(e) => setYearMode(e.target.value === 'manual' ? 'manual' : 'auto')}
          >
            <option value="auto">Auto (current year)</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        {yearMode === 'manual' ? (
          <label>
            <span>Year</span>
            <input type="number" name="year" defaultValue={cfg.year ?? new Date().getFullYear()} />
          </label>
        ) : (
          <input type="hidden" name="year" value={String(cfg.year ?? new Date().getFullYear())} />
        )}
        <label>
          <span>Link URL (optional)</span>
          <input type="text" name="linkUrl" defaultValue={cfg.linkUrl ?? ''} />
        </label>
        <label>
          <span>Link label (optional)</span>
          <input type="text" name="linkLabel" defaultValue={cfg.linkLabel ?? ''} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Copyright'}
        </button>
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
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateSocialSlotAction, initialState)
  const initial = readSocialConfig(slot.config).items ?? []
  const [items, setItems] = useState<SocialLinkItem[]>(
    initial.length > 0
      ? initial
      : [{ id: newSocialId(), platform: '', url: '', label: '', icon: '' }],
  )

  return (
    <SettingsShell title="Social links" embedded={embedded}>
      <form action={formAction} className="gantry-typed-form">
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
                onClick={() => setItems(items.filter((row) => row.id !== item.id))}
                disabled={items.length <= 1}
              >
                Remove link
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            setItems([
              ...items,
              { id: newSocialId(), platform: '', url: '', label: '', icon: '' },
            ])
          }
        >
          Add link
        </button>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Social'}
        </button>
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
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  embedded?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateFormSlotAction, initialState)
  const cfg = readFormConfig(slot.config)
  const [fields, setFields] = useState<FormFieldDef[]>(() => [...(cfg.fields ?? [])])
  const [fieldsJson, setFieldsJson] = useState(() => JSON.stringify(cfg.fields ?? [], null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

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
    } catch {
      setJsonError('Invalid JSON.')
    }
  }

  return (
    <SettingsShell title="Form settings" embedded={embedded}>
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />
        <label>
          <span>Heading</span>
          <input type="text" name="heading" defaultValue={cfg.heading ?? ''} />
        </label>
        <label>
          <span>Success message</span>
          <input type="text" name="successMessage" defaultValue={cfg.successMessage ?? ''} />
        </label>
        <label>
          <span>Submit label</span>
          <input type="text" name="submitLabel" defaultValue={cfg.submitLabel ?? 'Send'} />
        </label>
        <label className="gantry-typed-check">
          <input
            type="checkbox"
            name="useSiteCaptchaDefault"
            defaultChecked={cfg.useSiteCaptchaDefault !== false}
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
        <button type="submit" disabled={pending || Boolean(jsonError)}>
          {pending ? 'Saving…' : 'Save Form'}
        </button>
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
      />
    )
  }
  if (slot.moduleId === 'social') {
    return (
      <SocialParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} embedded={embedded} />
    )
  }
  if (slot.moduleId === 'form') {
    return (
      <FormParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} embedded={embedded} />
    )
  }
  return null
}
