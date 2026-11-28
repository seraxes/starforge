'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { createNavMenuInlineAction, renameNavMenuAction } from '@/core/nav/actions'
import { ACCOUNT_NAV_MENU_ID } from '@/core/nav/account-menu-seed'

import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  readAccountMenuConfig,
  readCopyrightConfig,
  readLocaleSwitcherConfig,
  readLogoConfig,
  readLoginConfig,
  readMenuConfig,
  readSocialConfig,
  readSpacerConfig,
  type AccountMenuAvatarShape,
  type AccountMenuParticleConfig,
  type CopyrightParticleConfig,
  type LocaleSwitcherParticleConfig,
  type LogoParticleConfig,
  type LoginParticleConfig,
  type MenuParticleConfig,
  type SocialLinkItem,
  type SpacerParticleConfig,
} from '@/core/modules/particles/config'
import { cssColorToColorInputValue, parseCssColorInput } from '@/core/modules/styles'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'
import { MediaPicker } from '@/generated/module-media-host'
import { LocaleInput } from '@/core/localization/LocaleInput'

import { useContentLocales } from './content-locales-context'

export type NavMenuOption = { id: string; label: string }
export type FormDefinitionOption = { id: string; label: string }

import { useAdminToast, useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { useDebouncedPersist } from '../use-debounced-persist'
import { LayoutIdField, useLayoutOutlineId } from './layout-outline-context'
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

function logoConfigPayload(draft: LogoParticleConfig, colorText: string): LogoParticleConfig {
  const mode = draft.mode ?? 'image'
  const validHiddenColor =
    parseCssColorInput(colorText).status === 'ok'
      ? colorText.trim()
      : parseCssColorInput(draft.color ?? '').status === 'ok'
        ? (draft.color ?? '')
        : ''
  return {
    ...draft,
    color: mode === 'text' ? colorText : validHiddenColor,
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
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<LogoParticleConfig>(() => readLogoConfig(slot.config))
  const [colorText, setColorText] = useState(() => readLogoConfig(slot.config).color ?? '')
  const locales = useContentLocales()
  const defaultLocale = locales.find((locale) => locale.isDefault)
  /** Sync source of truth — FormData is built from refs, not a controlled hidden input. */
  const draftRef = React.useRef(draft)
  const colorTextRef = React.useRef(colorText)
  const slotIdRef = React.useRef(slot.id)
  if (slotIdRef.current !== slot.id) {
    slotIdRef.current = slot.id
    const next = readLogoConfig(slot.config)
    draftRef.current = next
    colorTextRef.current = next.color ?? ''
  }

  // Local draft while cog is open — reset only when switching particles (never from save responses).
  useEffect(() => {
    const next = readLogoConfig(slot.config)
    draftRef.current = next
    colorTextRef.current = next.color ?? ''
    setDraft(next)
    setColorText(next.color ?? '')
    setError(null)
  }, [slot.id])

  const persist = useCallback(
    (payload: LogoParticleConfig) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', rowId)
      fd.set('slotId', slot.id)
      fd.set('configJson', JSON.stringify(payload))

      startSave(async () => {
        const result = await updateSlotConfigAction({}, fd)
        if (result.ok) {
          setError(null)
          if (result.config) onConfigSaved?.(result.config)
          notifySaved(result.message || 'Saved')
        } else if (result.error) {
          setError(result.error)
          notifyError(result.error)
        }
      })
    },
    [layoutId, notifyError, notifySaved, onConfigSaved, rowId, sectionId, slot.id],
  )

  const { schedule, flush } = useDebouncedPersist(persist)

  const mode = draft.mode ?? 'image'

  const patchDraft = (partial: Partial<LogoParticleConfig>) => {
    const next = { ...draftRef.current, ...partial }
    draftRef.current = next
    setDraft(next)
    return next
  }

  const scheduleSave = () => {
    schedule('logo', logoConfigPayload(draftRef.current, colorTextRef.current))
  }

  const flushSave = () => {
    flush('logo', logoConfigPayload(draftRef.current, colorTextRef.current))
  }

  return (
    <SettingsShell title="Logo / Image settings" embedded={embedded}>
      <div className="gantry-typed-form">
        <label>
          <span>Mode</span>
          <select
            value={mode}
            onChange={(e) => {
              patchDraft({ mode: e.target.value === 'text' ? 'text' : 'image' })
              flushSave()
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
            value={draft.linkUrl ?? ''}
            onChange={(e) => {
              patchDraft({ linkUrl: e.target.value })
              scheduleSave()
            }}
            onBlur={flushSave}
            placeholder="/"
          />
        </label>

        {mode === 'text' ? (
          <>
            <LocaleInput
              locales={locales}
              values={{
                ...(draft.textLocales ?? {}),
                ...(defaultLocale ? { [defaultLocale.code]: draft.text ?? '' } : {}),
              }}
              label="Text"
              requiredDefault
              onChange={(code, value) => {
                const isDefault = code === defaultLocale?.code
                patchDraft({
                  textLocales: { ...(draftRef.current.textLocales ?? {}), [code]: value },
                  ...(isDefault ? { text: value } : {}),
                })
                scheduleSave()
              }}
            />
            <label>
              <span>Font family</span>
              <input
                type="text"
                value={draft.fontFamily ?? ''}
                onChange={(e) => {
                  patchDraft({ fontFamily: e.target.value })
                  scheduleSave()
                }}
                onBlur={flushSave}
                placeholder="e.g. Georgia, serif (empty = site default)"
              />
            </label>
            <div className="gantry-typed-row">
              <label>
                <span>Size (px)</span>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={draft.fontSize ?? 28}
                  onChange={(e) => {
                    patchDraft({
                      fontSize: Number(e.target.value) || draftRef.current.fontSize || 28,
                    })
                    scheduleSave()
                  }}
                  onBlur={flushSave}
                />
              </label>
              <label>
                <span>Weight</span>
                <input
                  type="text"
                  value={String(draft.fontWeight ?? 700)}
                  onChange={(e) => {
                    patchDraft({ fontWeight: e.target.value })
                    scheduleSave()
                  }}
                  onBlur={flushSave}
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
                    colorTextRef.current = event.target.value
                    setColorText(event.target.value)
                    patchDraft({ color: event.target.value })
                    flushSave()
                  }}
                />
                <input
                  type="text"
                  className="gantry-section-color-input"
                  value={colorText}
                  onChange={(event) => {
                    colorTextRef.current = event.target.value
                    setColorText(event.target.value)
                    patchDraft({ color: event.target.value })
                    scheduleSave()
                  }}
                  onBlur={flushSave}
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
              includeHiddenInputs={false}
              hint="Library Media id is primary; raw URL is advanced fallback."
              onChange={(next) => {
                patchDraft({
                  mediaId: next.mediaId,
                  mediaUrl: next.url ?? '',
                  alt: next.alt || draftRef.current.alt || 'Logo',
                })
                flushSave()
              }}
            />
            <label>
              <span>Alt text</span>
              <input
                type="text"
                value={draft.alt ?? ''}
                onChange={(e) => {
                  patchDraft({ alt: e.target.value })
                  scheduleSave()
                }}
                onBlur={flushSave}
                required
              />
            </label>
            <div className="gantry-typed-row">
              <label>
                <span>Max width (px)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.maxWidth ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchDraft({ maxWidth: Number.isFinite(n) && n > 0 ? n : undefined })
                    scheduleSave()
                  }}
                  onBlur={flushSave}
                  placeholder="e.g. 180"
                />
              </label>
              <label>
                <span>Max height (px)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.maxHeight ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchDraft({ maxHeight: Number.isFinite(n) && n > 0 ? n : undefined })
                    scheduleSave()
                  }}
                  onBlur={flushSave}
                  placeholder="e.g. 64"
                />
              </label>
            </div>
          </>
        )}
        {pending ? <p className="layout-muted">Saving…</p> : null}
        {error ? (
          <p className="admin-inline-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SettingsShell>
  )
}

export function MenuParticleEditor({
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<MenuParticleConfig>(() => readMenuConfig(slot.config))

  useEffect(() => {
    setDraft(readMenuConfig(slot.config))
  }, [slot.id])

  const selected = (draft.menuId ?? '').trim() || 'primary'
  const configJson = JSON.stringify({
    menuId: selected === 'primary' ? '' : selected,
    ariaLabel: draft.ariaLabel ?? 'Primary',
  })

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
        <input type="hidden" name="configJson" value={configJson} />
        <label>
          <span>Navigation menu set</span>
          <select
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
          Menus come from <code>/admin/nav</code>. Site primary is assigned under Settings →
          Modules.
        </p>
        <label>
          <span>Aria label</span>
          <input
            type="text"
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

export function LocaleSwitcherParticleEditor({
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<LocaleSwitcherParticleConfig>(() =>
    readLocaleSwitcherConfig(slot.config),
  )

  useEffect(() => {
    setDraft(readLocaleSwitcherConfig(slot.config))
  }, [slot.id])

  const configJson = JSON.stringify({
    ariaLabel: draft.ariaLabel ?? '',
    display: draft.display === 'codes' ? 'codes' : 'labels',
  })

  return (
    <SettingsShell title="Locale Switcher settings" embedded={embedded}>
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
          <span>Display</span>
          <select
            value={draft.display === 'codes' ? 'codes' : 'labels'}
            onChange={(e) => {
              setDraft((prev) => ({
                ...prev,
                display: e.target.value === 'codes' ? 'codes' : 'labels',
              }))
              queueMicrotask(saveNow)
            }}
          >
            <option value="labels">Labels (English / Magyar)</option>
            <option value="codes">Codes (EN / HU)</option>
          </select>
        </label>
        <label>
          <span>Aria label</span>
          <input
            type="text"
            value={draft.ariaLabel ?? ''}
            placeholder="Language"
            onChange={(e) => setDraft((prev) => ({ ...prev, ariaLabel: e.target.value }))}
          />
        </label>
        <p className="layout-muted">
          Enabled locales come from <code>/admin/localization</code>. Hidden when fewer than two
          languages are enabled.
        </p>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}

function accountMenuLabel(menu: NavMenuOption, titleOverrides: Record<string, string>): string {
  const override = titleOverrides[menu.id]
  if (override && override !== menu.label) return override
  return menu.label
}

export function AccountMenuParticleEditor({
  sectionId,
  rowId,
  slot,
  navMenus = [],
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  navMenus?: NavMenuOption[]
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()
  const [createPending, startCreate] = useTransition()
  const [renamePending, startRename] = useTransition()
  const [createError, setCreateError] = useState('')
  const [renameError, setRenameError] = useState('')

  const [draft, setDraft] = useState<AccountMenuParticleConfig>(() =>
    readAccountMenuConfig(slot.config),
  )
  const [extraMenus, setExtraMenus] = useState<NavMenuOption[]>([])
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({})
  const pendingBindId = useRef('')

  useEffect(() => {
    setDraft(readAccountMenuConfig(slot.config))
  }, [slot.id])

  const selectedMenuId = (draft.menuId ?? '').trim()
  const menus = [
    ...navMenus.map((menu) => ({ ...menu, label: accountMenuLabel(menu, titleOverrides) })),
    ...extraMenus
      .filter((menu) => !navMenus.some((row) => row.id === menu.id))
      .map((menu) => ({ ...menu, label: accountMenuLabel(menu, titleOverrides) })),
  ]
  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId) ?? null
  const [titleForId, setTitleForId] = useState(selectedMenuId)
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  if (titleForId !== selectedMenuId) {
    setTitleForId(selectedMenuId)
    setTitleDraft(null)
  }
  const menuTitle = titleDraft ?? selectedMenu?.label ?? ''

  useEffect(() => {
    if (!pendingBindId.current || draft.menuId !== pendingBindId.current) return
    pendingBindId.current = ''
    saveNow()
  }, [draft.menuId, saveNow])

  const configJson = JSON.stringify({
    avatarShape: draft.avatarShape,
    avatarSize: draft.avatarSize,
    menuId: selectedMenuId === 'primary' ? '' : selectedMenuId,
  })

  function commitMenuTitle() {
    const next = menuTitle.trim()
    const current = selectedMenu?.label ?? ''
    if (renamePending || !selectedMenuId || !next || next === current) {
      setTitleDraft(null)
      return
    }
    const id = selectedMenuId
    startRename(async () => {
      const formData = new FormData()
      formData.set('id', id)
      formData.set('label', next)
      const result = await renameNavMenuAction({}, formData)
      if (result.error || !result.menuId || !result.label) {
        setRenameError(result.error || 'Could not rename menu.')
        return
      }
      setRenameError('')
      setTitleOverrides((prev) => ({ ...prev, [result.menuId!]: result.label! }))
      setTitleDraft(null)
      router.refresh()
    })
  }

  return (
    <SettingsShell title="Account menu settings" embedded={embedded}>
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
          <span>Avatar shape</span>
          <select
            value={draft.avatarShape}
            onChange={(e) => {
              const value = e.target.value as AccountMenuAvatarShape
              setDraft((prev) => ({
                ...prev,
                avatarShape:
                  value === 'square' || value === 'hexagon' || value === 'circle'
                    ? value
                    : 'circle',
              }))
              queueMicrotask(saveNow)
            }}
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
            <option value="hexagon">Hexagon</option>
          </select>
        </label>
        <label>
          <span>Avatar size (px)</span>
          <input
            type="number"
            name="avatarSize"
            min={20}
            max={96}
            value={draft.avatarSize}
            onChange={(e) => {
              const n = Number(e.target.value)
              setDraft((prev) => ({
                ...prev,
                avatarSize: Number.isFinite(n) && n > 0 ? Math.round(n) : 36,
              }))
            }}
          />
        </label>
        <label>
          <span>Menu</span>
          <select
            value={selectedMenuId}
            onChange={(e) => {
              const menuId = e.target.value === 'primary' ? '' : e.target.value
              setDraft((prev) => ({ ...prev, menuId }))
              queueMicrotask(saveNow)
            }}
          >
            {selectedMenuId && !menus.some((menu) => menu.id === selectedMenuId) ? (
              <option value={selectedMenuId}>
                {selectedMenuId === ACCOUNT_NAV_MENU_ID ? 'Account' : selectedMenuId}
              </option>
            ) : null}
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.label} ({menu.id})
              </option>
            ))}
          </select>
        </label>
        <p className="layout-muted">
          <Link href={`/admin/nav/${encodeURIComponent(selectedMenuId)}`}>Edit items</Link> in
          Navigation. The default Account menu holds Sign in, Account, security, and the rest —
          change those labels and links there. Signed-out rows use the Visitors group. Sign out
          stays on the button. The title above is the menu name, not a heading in the dropdown.
        </p>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
      {selectedMenuId ? (
        <form className="gantry-typed-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Menu title</span>
            <input
              type="text"
              value={menuTitle}
              maxLength={80}
              required
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => commitMenuTitle()}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                event.currentTarget.blur()
              }}
            />
          </label>
          {renamePending ? <p className="layout-muted">Saving title…</p> : null}
          {renameError ? (
            <p className="admin-inline-error" role="alert">
              {renameError}
            </p>
          ) : null}
        </form>
      ) : null}
      <form
        className="gantry-typed-form"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const formData = new FormData(form)
          startCreate(async () => {
            const result = await createNavMenuInlineAction({}, formData)
            if (result.error || !result.menuId) {
              setCreateError(result.error || 'Could not create menu.')
              return
            }
            const created = {
              id: result.menuId,
              label: result.label?.trim() || result.menuId,
            }
            setCreateError('')
            setExtraMenus((prev) =>
              prev.some((menu) => menu.id === created.id) ? prev : [...prev, created],
            )
            pendingBindId.current = created.id
            setDraft((prev) => ({ ...prev, menuId: created.id }))
            form.reset()
            router.refresh()
          })
        }}
      >
        <label>
          <span>Add menu</span>
          <input type="text" name="label" maxLength={80} placeholder="Account" required />
        </label>
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={createPending}
        >
          {createPending ? 'Adding…' : 'Add'}
        </button>
        {createError ? (
          <p className="admin-inline-error" role="alert">
            {createError}
          </p>
        ) : null}
      </form>
    </SettingsShell>
  )
}

export function SpacerParticleEditor({
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<SpacerParticleConfig>(() => readSpacerConfig(slot.config))

  useEffect(() => {
    setDraft(readSpacerConfig(slot.config))
  }, [slot.id])

  const configJson = JSON.stringify({
    height: draft.height,
    ...(draft.width != null && draft.width > 0 ? { width: draft.width } : {}),
  })

  return (
    <SettingsShell title="Spacer settings" embedded={embedded}>
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
          <span>Height (px)</span>
          <input
            type="number"
            name="height"
            min={1}
            max={2400}
            value={draft.height}
            onChange={(e) => {
              const n = Number(e.target.value)
              setDraft((prev) => ({
                ...prev,
                height: Number.isFinite(n) && n > 0 ? Math.round(n) : 24,
              }))
            }}
          />
        </label>
        <label>
          <span>Width (px, optional)</span>
          <input
            type="number"
            name="width"
            min={1}
            max={2400}
            value={draft.width ?? ''}
            placeholder="Fill column"
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                setDraft((prev) => {
                  const next: SpacerParticleConfig = { height: prev.height }
                  return next
                })
                return
              }
              const n = Number(raw)
              setDraft((prev) =>
                Number.isFinite(n) && n > 0
                  ? { ...prev, width: Math.round(n) }
                  : { height: prev.height },
              )
            }}
          />
        </label>
        <p className="layout-muted">
          Plain empty gap — no content. Use height for vertical space; leave width empty to span the
          column (slot % still controls row share).
        </p>
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const [draft, setDraft] = useState<CopyrightParticleConfig>(() =>
    readCopyrightConfig(slot.config),
  )
  const locales = useContentLocales()
  const defaultLocale = locales.find((locale) => locale.isDefault)

  useEffect(() => {
    setDraft(readCopyrightConfig(slot.config))
  }, [slot.id])

  const yearMode = draft.yearMode ?? 'auto'
  const patchDraft = (partial: Partial<CopyrightParticleConfig>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }
  const configJson = JSON.stringify(draft)

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
        <input type="hidden" name="configJson" value={configJson} />
        <LocaleInput
          locales={locales}
          values={{
            ...(draft.textLocales ?? {}),
            ...(defaultLocale ? { [defaultLocale.code]: draft.text ?? '' } : {}),
          }}
          label="Text"
          onChange={(code, value) => {
            const isDefault = code === defaultLocale?.code
            patchDraft({
              textLocales: { ...(draft.textLocales ?? {}), [code]: value },
              ...(isDefault ? { text: value } : {}),
            })
          }}
        />
        <label>
          <span>Year mode</span>
          <select
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
              value={draft.year ?? new Date().getFullYear()}
              onChange={(e) =>
                patchDraft({
                  year: Number(e.target.value) || new Date().getFullYear(),
                })
              }
            />
          </label>
        ) : null}
        <label>
          <span>Link URL (optional)</span>
          <input
            type="text"
            value={draft.linkUrl ?? ''}
            onChange={(e) => patchDraft({ linkUrl: e.target.value })}
          />
        </label>
        <label>
          <span>Link label (optional)</span>
          <input
            type="text"
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const seedItems = (): SocialLinkItem[] => {
    const initial = readSocialConfig(slot.config).items ?? []
    return initial.length > 0
      ? initial
      : [{ id: newSocialId(), platform: '', url: '', label: '', icon: '' }]
  }

  const [items, setItems] = useState<SocialLinkItem[]>(seedItems)
  const locales = useContentLocales()
  const defaultLocale = locales.find((locale) => locale.isDefault)
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

  const configJson = JSON.stringify({ items })

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
        <input type="hidden" name="configJson" value={configJson} />

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
              <LocaleInput
                locales={locales}
                values={{
                  ...(item.labelLocales ?? {}),
                  ...(defaultLocale ? { [defaultLocale.code]: item.label ?? '' } : {}),
                }}
                label="Label"
                onChange={(code, value) => {
                  const next = [...items]
                  const isDefault = code === defaultLocale?.code
                  next[index] = {
                    ...item,
                    labelLocales: { ...(item.labelLocales ?? {}), [code]: value },
                    ...(isDefault ? { label: value } : {}),
                  }
                  setItems(next)
                }}
              />
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

export function LoginParticleEditor({
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
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()
  const [draft, setDraft] = useState<LoginParticleConfig>(() => readLoginConfig(slot.config))
  const locales = useContentLocales()
  const defaultLocale = locales.find((locale) => locale.isDefault)

  useEffect(() => {
    setDraft(readLoginConfig(slot.config))
  }, [slot.id])

  const configJson = JSON.stringify(draft)

  return (
    <SettingsShell title="Login / welcome" embedded={embedded}>
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
        <LocaleInput
          locales={locales}
          values={{
            ...(draft.welcomeNoteLocales ?? {}),
            ...(defaultLocale ? { [defaultLocale.code]: draft.welcomeNote ?? '' } : {}),
          }}
          label="Welcome note"
          onChange={(code, value) => {
            const isDefault = code === defaultLocale?.code
            setDraft((prev) => ({
              ...prev,
              welcomeNoteLocales: { ...(prev.welcomeNoteLocales ?? {}), [code]: value },
              ...(isDefault ? { welcomeNote: value } : {}),
            }))
          }}
        />
        <label className="gantry-typed-check">
          <input
            type="checkbox"
            checked={draft.showForm !== false}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, showForm: event.target.checked }))
              queueMicrotask(saveNow)
            }}
          />
          <span>Show sign-in form</span>
        </label>
        {pending ? <p className="layout-muted">Saving…</p> : null}
        <ActionFeedback state={state} />
      </form>
    </SettingsShell>
  )
}
