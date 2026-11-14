'use client'

import React, { useActionState, useState } from 'react'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { CodeEditorField } from '@/components/admin/CodeEditorField'
import { resolveAccessTags } from '@/core/acl/nav-access'
import {
  savePageSettingsAction,
  type PageSettingsActionState,
  type PageSettingsAdminBootstrap,
} from '@/core/page-settings/actions'
import { newPageSettingsEntityId } from '@/core/page-settings/defaults'
import {
  inheritedKeysFromOverride,
  type PageChromeInheritKey,
} from '@/core/page-settings/inherit-fields'
import type { AssetRef, MetaTag, PageAtomInstance, PageChrome } from '@/core/page-settings/types'
import {
  ASSET_PRIORITY_MAX,
  ASSET_PRIORITY_MIN,
} from '@/core/page-settings/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { InheritCopyRow } from '../layouts/layout-inherit-controls'
import { useAutosaveForm } from '../use-autosave-form'
import { AtomSettingsPopover } from './atom-settings-popover'

function FieldInheritRow({
  show,
  fieldKey,
  inherited,
  onChange,
  onCopy,
  children,
}: {
  /** Non-Base outline — Inherit/Copy from Base. */
  show: boolean
  fieldKey: PageChromeInheritKey
  inherited: boolean
  onChange: (key: PageChromeInheritKey, next: boolean) => void
  onCopy: (key: PageChromeInheritKey) => void
  children: React.ReactNode
}) {
  if (!show) return <>{children}</>
  return (
    <div
      className={[
        'page-settings-field-with-inherit',
        'page-settings-field-with-inherit-active',
        inherited ? 'page-settings-field-inherited' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="page-settings-field-body">{children}</div>
      <div className="page-settings-field-inherit-aside">
        <InheritCopyRow
          inline
          inherited={inherited}
          onInheritChange={(next) => onChange(fieldKey, next)}
          onCopy={() => onCopy(fieldKey)}
          copyLabel="Copy"
        />
      </div>
    </div>
  )
}

type Props = {
  bootstrap: PageSettingsAdminBootstrap
}

const INITIAL: PageSettingsActionState = {}

function Panel({
  title,
  wide,
  id,
  children,
}: {
  title: string
  /** @deprecated Panels are always expanded (no collapse). Kept for call-site compat. */
  defaultOpen?: boolean
  /** Span the full mosaic row. */
  wide?: boolean
  /** Optional anchor id (Layouts → Font Awesome deep link). */
  id?: string
  children: React.ReactNode
}) {
  // Always-open mosaic tiles — not <details>; Body / FA / Atoms / etc. must never start collapsed.
  return (
    <section
      id={id}
      className={wide ? 'page-settings-panel page-settings-panel-wide' : 'page-settings-panel'}
    >
      <header className="page-settings-panel-head">
        <h3>{title}</h3>
      </header>
      <div className="page-settings-panel-body">{children}</div>
    </section>
  )
}

/** Snapshot Base assets as live-inherited outline entries. */
function assetsAsInheritedFromBase(baseItems: AssetRef[]): AssetRef[] {
  return structuredClone(baseItems).map((asset) => ({ ...asset, inherit: true }))
}

/** True when the outline list is exactly Base, every entry live-inherited. */
function isWholeAssetFieldInherited(items: AssetRef[], baseItems: AssetRef[]): boolean {
  if (items.length !== baseItems.length) return false
  if (baseItems.length === 0) return true
  const baseIds = new Set(baseItems.map((b) => b.id))
  if (items.some((item) => !baseIds.has(item.id) || !item.inherit)) return false
  return baseItems.every((base) => items.some((item) => item.id === base.id))
}

/** Display row: when inherited, show live Base values. */
function displayAsset(item: AssetRef, baseById: Map<string, AssetRef>): AssetRef {
  if (!item.inherit) return item
  const fromBase = baseById.get(item.id)
  if (!fromBase) return item
  return { ...fromBase, inherit: true }
}

function OrderedAssetList({
  label,
  language,
  items,
  onChange,
  onTextChange,
  onDiscreteChange,
  disabled,
  developerOnly,
  canInherit,
  baseItems,
}: {
  label: string
  language: 'css' | 'javascript'
  items: AssetRef[]
  onChange: (next: AssetRef[]) => void
  /** Debounced persist for typing name/url/content. */
  onTextChange?: () => void
  /** Immediate persist for add/remove/reorder/priority. */
  onDiscreteChange?: () => void
  disabled?: boolean
  developerOnly?: boolean
  /** Non-Base outline — Inherit/Copy per file entry. */
  canInherit?: boolean
  baseItems?: AssetRef[]
}) {
  const fileLabel = language === 'css' ? 'CSS file' : 'JS file'
  const baseList = baseItems ?? []
  const baseById = new Map(baseList.map((asset) => [asset.id, asset]))

  const patchItem = (index: number, patch: Partial<AssetRef>, persist: 'text' | 'discrete') => {
    const next = [...items]
    const cur = next[index]
    if (!cur) return
    next[index] = { ...cur, ...patch }
    onChange(next)
    if (persist === 'text') onTextChange?.()
    else onDiscreteChange?.()
  }

  return (
    <div className="page-settings-list">
      <div className="page-settings-list-head">
        <strong>{label}</strong>
        {developerOnly ? <span className="page-settings-acl">Developer-admin</span> : null}
        <button
          type="button"
          className="gantry-toolbar-btn secondary"
          disabled={disabled}
          onClick={() => {
            const n = items.length + 1
            onChange([
              ...items.map((row) => ({ ...row })),
              {
                id: newPageSettingsEntityId('asset'),
                name: `${language === 'css' ? 'style' : 'script'}-${n}`,
                url: '',
                content: '',
                priority: 0,
              },
            ])
            onDiscreteChange?.()
          }}
        >
          Add {fileLabel}
        </button>
      </div>
      <p className="settings-hint">
        Each item is an editable {language === 'css' ? 'stylesheet' : 'script'} file. Use{' '}
        <strong>Edit</strong> for CodeMirror. Load priority (−10 … +10) orders inject in head
        / before <code>&lt;/body&gt;</code> (lower first). Optional external URL still works
        when content is empty.
        {canInherit
          ? ' Inherit / Copy beside each file links that entry to Base (not the whole list).'
          : null}
      </p>
      {items.length === 0 ? <p className="settings-hint">No files yet.</p> : null}
      <ul className="page-settings-asset-list page-settings-asset-list--files">
        {items.map((item, index) => {
          const shown = displayAsset(item, baseById)
          const entryInherited = Boolean(canInherit && item.inherit && baseById.has(item.id))
          const rowDisabled = Boolean(disabled || entryInherited)
          const showInherit = Boolean(canInherit && baseById.has(item.id))

          return (
            <li
              key={item.id}
              className={
                showInherit
                  ? entryInherited
                    ? 'page-settings-asset-row page-settings-asset-row--inherit page-settings-field-inherited'
                    : 'page-settings-asset-row page-settings-asset-row--inherit'
                  : 'page-settings-asset-row'
              }
            >
              <div className="page-settings-asset-row-main">
                <input
                  type="text"
                  placeholder="File name"
                  value={shown.name}
                  disabled={rowDisabled}
                  aria-label={`${label} file name`}
                  onChange={(e) => patchItem(index, { name: e.target.value, inherit: false }, 'text')}
                  onBlur={() => onDiscreteChange?.()}
                />
                <label className="page-settings-asset-priority">
                  <span>Priority</span>
                  <input
                    type="number"
                    min={ASSET_PRIORITY_MIN}
                    max={ASSET_PRIORITY_MAX}
                    step={1}
                    value={shown.priority ?? 0}
                    disabled={rowDisabled}
                    aria-label={`${label} load priority`}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const priority = Number.isFinite(raw)
                        ? Math.min(
                            ASSET_PRIORITY_MAX,
                            Math.max(ASSET_PRIORITY_MIN, Math.round(raw)),
                          )
                        : 0
                      patchItem(index, { priority, inherit: false }, 'discrete')
                    }}
                  />
                </label>
                <div className="page-settings-row-actions">
                  {rowDisabled ? (
                    <button type="button" className="gantry-toolbar-btn secondary" disabled>
                      Edit
                    </button>
                  ) : (
                    <AtomSettingsPopover
                      title={`Edit ${shown.name || fileLabel}`}
                      triggerLabel="Edit"
                      preferredWidth={600}
                      onClose={() => onDiscreteChange?.()}
                    >
                      <CodeEditorField
                        key={`${item.id}-editor-${entryInherited ? 'in' : 'local'}`}
                        label={shown.name || fileLabel}
                        language={language}
                        initialValue={shown.content ?? ''}
                        initialHeight={280}
                        hint={
                          language === 'css'
                            ? 'Inline CSS applied on the public site as a <style> block (outline chrome).'
                            : 'Inline JS injected before </body>.'
                        }
                        onValueChange={(nextContent) => {
                          patchItem(index, { content: nextContent, inherit: false }, 'text')
                        }}
                      />
                      <label className="settings-field">
                        <span>External URL (optional)</span>
                        <input
                          type="url"
                          placeholder="https://… (used when content is empty)"
                          defaultValue={shown.url}
                          onChange={(e) => {
                            patchItem(index, { url: e.target.value, inherit: false }, 'text')
                          }}
                          onBlur={() => onDiscreteChange?.()}
                        />
                      </label>
                    </AtomSettingsPopover>
                  )}
                  <button
                    type="button"
                    className="gantry-toolbar-btn gantry-toolbar-btn-danger danger"
                    disabled={disabled}
                    onClick={() => {
                      onChange(items.filter((_, i) => i !== index))
                      onDiscreteChange?.()
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {showInherit ? (
                <div className="page-settings-asset-row-inherit">
                  <InheritCopyRow
                    inline
                    inherited={entryInherited}
                    disabled={disabled}
                    onInheritChange={(nextInherited) => {
                      const fromBase = baseById.get(item.id)
                      if (!fromBase) return
                      if (nextInherited) {
                        const next = [...items]
                        next[index] = { ...structuredClone(fromBase), inherit: true }
                        onChange(next)
                      } else {
                        const next = [...items]
                        next[index] = {
                          ...structuredClone(displayAsset(item, baseById)),
                          inherit: false,
                        }
                        delete next[index].inherit
                        onChange(next)
                      }
                      onDiscreteChange?.()
                    }}
                    onCopy={() => {
                      const fromBase = baseById.get(item.id)
                      if (!fromBase) return
                      const next = [...items]
                      const snap = structuredClone(fromBase)
                      delete snap.inherit
                      next[index] = snap
                      onChange(next)
                      onDiscreteChange?.()
                    }}
                    copyLabel="Copy"
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PageSettingsForm({ bootstrap }: Props) {
  const canInherit = bootstrap.canInherit
  const [state, formAction, pending] = useActionState(savePageSettingsAction, INITIAL)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const baseChrome = bootstrap.baseChrome
  const initial = bootstrap.editingChrome
  const pickInitial = <T,>(local: T | undefined, fallback: T): T =>
    local !== undefined ? local : fallback

  const [inheritedKeys, setInheritedKeys] = useState<Set<PageChromeInheritKey>>(() =>
    canInherit ? new Set(inheritedKeysFromOverride(initial)) : new Set(),
  )
  const inherits = (key: PageChromeInheritKey) => canInherit && inheritedKeys.has(key)

  const [sectionsLayout, setSectionsLayout] = useState(
    pickInitial(initial.sectionsLayout, baseChrome.sectionsLayout ?? 'fullwidth'),
  )
  const [accessTags, setAccessTags] = useState<string[]>(() =>
    resolveAccessTags({
      accessTags: pickInitial(initial.accessTags, baseChrome.accessTags),
    }),
  )
  const [metaTags, setMetaTags] = useState<MetaTag[]>(
    pickInitial(initial.metaTags, baseChrome.metaTags ?? []),
  )
  const [customHeadHtml, setCustomHeadHtml] = useState(
    pickInitial(initial.customHeadHtml, baseChrome.customHeadHtml ?? ''),
  )
  const [faviconUrl, setFaviconUrl] = useState(
    pickInitial(initial.faviconUrl, baseChrome.faviconUrl ?? ''),
  )
  const [touchIconUrl, setTouchIconUrl] = useState(
    pickInitial(initial.touchIconUrl, baseChrome.touchIconUrl ?? ''),
  )
  const [css, setCss] = useState<AssetRef[]>(() => {
    if (!canInherit) return structuredClone(initial.css ?? baseChrome.css ?? [])
    if (initial.css === undefined) return assetsAsInheritedFromBase(baseChrome.css ?? [])
    return structuredClone(initial.css)
  })
  const [javascript, setJavascript] = useState<AssetRef[]>(() => {
    if (!canInherit) return structuredClone(initial.javascript ?? baseChrome.javascript ?? [])
    if (initial.javascript === undefined) {
      return assetsAsInheritedFromBase(baseChrome.javascript ?? [])
    }
    return structuredClone(initial.javascript)
  })
  const [bodyId, setBodyId] = useState(pickInitial(initial.bodyId, baseChrome.bodyId ?? ''))
  const [bodyClasses, setBodyClasses] = useState(
    pickInitial(initial.bodyClasses, baseChrome.bodyClasses ?? ''),
  )
  const [bodyTagAttributes, setBodyTagAttributes] = useState(
    pickInitial(initial.bodyTagAttributes, baseChrome.bodyTagAttributes ?? ''),
  )
  const [afterBodyHtml, setAfterBodyHtml] = useState(
    pickInitial(initial.afterBodyHtml, baseChrome.afterBodyHtml ?? ''),
  )
  const [beforeBodyCloseHtml, setBeforeBodyCloseHtml] = useState(
    pickInitial(initial.beforeBodyCloseHtml, baseChrome.beforeBodyCloseHtml ?? ''),
  )
  const [faEnabled, setFaEnabled] = useState(
    pickInitial(initial.fontAwesome?.enabled, baseChrome.fontAwesome?.enabled ?? false),
  )
  const [faV4Compat, setFaV4Compat] = useState(
    pickInitial(initial.fontAwesome?.v4Compat, baseChrome.fontAwesome?.v4Compat ?? false),
  )
  const [faContentCompat, setFaContentCompat] = useState(
    pickInitial(
      initial.fontAwesome?.contentCompat,
      baseChrome.fontAwesome?.contentCompat ?? false,
    ),
  )
  const [faVersion, setFaVersion] = useState(
    pickInitial(initial.fontAwesome?.version, baseChrome.fontAwesome?.version ?? '6-free'),
  )
  const [faCssLinkHtml, setFaCssLinkHtml] = useState(
    pickInitial(initial.fontAwesome?.cssLinkHtml, baseChrome.fontAwesome?.cssLinkHtml ?? ''),
  )
  const [faJsScriptHtml, setFaJsScriptHtml] = useState(
    pickInitial(initial.fontAwesome?.jsScriptHtml, baseChrome.fontAwesome?.jsScriptHtml ?? ''),
  )
  const [atoms, setAtoms] = useState<PageAtomInstance[]>(
    pickInitial(initial.atoms, baseChrome.atoms ?? []),
  )

  const lockedScripts = !bootstrap.isDeveloperAdmin

  const setFieldInherit = (key: PageChromeInheritKey, nextInherited: boolean) => {
    setInheritedKeys((prev) => {
      const copy = new Set(prev)
      if (nextInherited) copy.add(key)
      else copy.delete(key)
      return copy
    })
    window.setTimeout(() => saveNow(), 0)
  }

  /** Keep whole-list `css` / `javascript` inherit keys in sync with per-entry flags. */
  const syncAssetInheritKey = (
    key: 'css' | 'javascript',
    items: AssetRef[],
    baseItems: AssetRef[],
  ) => {
    if (!canInherit) return
    setInheritedKeys((prev) => {
      const next = new Set(prev)
      if (isWholeAssetFieldInherited(items, baseItems)) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const setCssAndSync = (next: AssetRef[]) => {
    setCss(next)
    syncAssetInheritKey('css', next, baseChrome.css ?? [])
  }

  const setJavascriptAndSync = (next: AssetRef[]) => {
    setJavascript(next)
    syncAssetInheritKey('javascript', next, baseChrome.javascript ?? [])
  }

  const copyFieldFromBase = (key: PageChromeInheritKey) => {
    switch (key) {
      case 'sectionsLayout':
        setSectionsLayout(baseChrome.sectionsLayout ?? 'fullwidth')
        break
      case 'accessTags':
        setAccessTags(resolveAccessTags({ accessTags: baseChrome.accessTags }))
        break
      case 'metaTags':
        setMetaTags(structuredClone(baseChrome.metaTags ?? []))
        break
      case 'customHeadHtml':
        setCustomHeadHtml(baseChrome.customHeadHtml ?? '')
        break
      case 'faviconUrl':
        setFaviconUrl(baseChrome.faviconUrl ?? '')
        break
      case 'touchIconUrl':
        setTouchIconUrl(baseChrome.touchIconUrl ?? '')
        break
      case 'css':
        setCssAndSync(structuredClone(baseChrome.css ?? []).map((a) => {
          const { inherit: _drop, ...rest } = a
          return rest
        }))
        break
      case 'javascript':
        setJavascriptAndSync(
          structuredClone(baseChrome.javascript ?? []).map((a) => {
            const { inherit: _drop, ...rest } = a
            return rest
          }),
        )
        break
      case 'bodyId':
        setBodyId(baseChrome.bodyId ?? '')
        break
      case 'bodyClasses':
        setBodyClasses(baseChrome.bodyClasses ?? '')
        break
      case 'bodyTagAttributes':
        setBodyTagAttributes(baseChrome.bodyTagAttributes ?? '')
        break
      case 'afterBodyHtml':
        setAfterBodyHtml(baseChrome.afterBodyHtml ?? '')
        break
      case 'beforeBodyCloseHtml':
        setBeforeBodyCloseHtml(baseChrome.beforeBodyCloseHtml ?? '')
        break
      case 'fontAwesome':
        setFaEnabled(baseChrome.fontAwesome?.enabled ?? false)
        setFaV4Compat(baseChrome.fontAwesome?.v4Compat ?? false)
        setFaContentCompat(baseChrome.fontAwesome?.contentCompat ?? false)
        setFaVersion(baseChrome.fontAwesome?.version ?? '6-free')
        setFaCssLinkHtml(baseChrome.fontAwesome?.cssLinkHtml ?? '')
        setFaJsScriptHtml(baseChrome.fontAwesome?.jsScriptHtml ?? '')
        break
      default:
        break
    }
    if (key !== 'css' && key !== 'javascript') {
      setInheritedKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    window.setTimeout(() => saveNow(), 0)
  }

  const addAtom = (type: string) => {
    const def = bootstrap.atoms.find((a) => a.type === type)
    if (!def) return
    if (def.requiresDeveloperAdmin && lockedScripts) return
    setAtoms((prev) => [
      ...prev,
      {
        id: newPageSettingsEntityId(`atom-${type}`),
        type: def.type,
        enabled: true,
        config: { ...def.defaultConfig },
      },
    ])
    saveNow()
  }

  const updateAtomConfig = (id: string, config: Record<string, unknown>, persist: 'now' | 'debounce' = 'debounce') => {
    setAtoms((prev) => prev.map((a) => (a.id === id ? { ...a, config } : a)))
    if (persist === 'now') saveNow()
    else saveDebounced()
  }

  return (
    <div className="page-settings">
      <p className="settings-hint page-settings-toolbar-hint">
        {bootstrap.isBaseOutline
          ? 'Editing Base outline chrome (source). Other outlines can Inherit / Copy from this.'
          : 'Editing a non-Base outline. Inherit / Copy beside each field (and each CSS/JS file) uses Base chrome.'}{' '}
        Assign outlines on nav menu items.
      </p>

      {!bootstrap.isDeveloperAdmin ? (
        <p className="notice-banner page-settings-acl-banner" role="status">
          Script fields (custom head, body hooks, JS lists, atom scripts, FA HTML overrides) are
          developer-admin only. Add your email to <code>STARFORGE_DEVELOPER_ADMIN_EMAILS</code>{' '}
          (empty list grants nobody in production).
        </p>
      ) : null}

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="form-ok" role="status">
          {state.message || 'Saved.'}
        </p>
      ) : null}

      <form ref={formRef} action={formAction} className="page-settings-form settings-form">
        <input type="hidden" name="outlineId" value={bootstrap.outlineId} />
        {canInherit ? (
          <input
            type="hidden"
            name="inheritKeysJson"
            value={JSON.stringify([...inheritedKeys])}
          />
        ) : null}
        <input
          type="hidden"
          name="accessTagsJson"
          value={JSON.stringify(accessTags.length ? accessTags : ['public'])}
          disabled={inherits('accessTags')}
        />
        <input
          type="hidden"
          name="metaTagsJson"
          value={JSON.stringify(metaTags)}
          disabled={inherits('metaTags')}
        />
        <input
          type="hidden"
          name="cssJson"
          value={JSON.stringify(css)}
          disabled={inherits('css')}
        />
        <input
          type="hidden"
          name="javascriptJson"
          value={JSON.stringify(javascript)}
          disabled={inherits('javascript')}
        />
        <input type="hidden" name="atomsJson" value={JSON.stringify(atoms)} />
        {lockedScripts ? (
          <>
            <input type="hidden" name="customHeadHtml" value={customHeadHtml} />
            <input type="hidden" name="afterBodyHtml" value={afterBodyHtml} />
            <input type="hidden" name="beforeBodyCloseHtml" value={beforeBodyCloseHtml} />
            <input type="hidden" name="faCssLinkHtml" value={faCssLinkHtml} />
            <input type="hidden" name="faJsScriptHtml" value={faJsScriptHtml} />
          </>
        ) : null}

        <div className="page-settings-mosaic admin-settings-mosaic">
        <Panel title="Page access & sections">
          <FieldInheritRow
            show={canInherit}
            fieldKey="sectionsLayout"
            onCopy={copyFieldFromBase}
            inherited={inherits('sectionsLayout')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Sections layout (default)</span>
              <select
                name="sectionsLayout"
                value={sectionsLayout}
                disabled={inherits('sectionsLayout')}
                onChange={(e) => {
                  setSectionsLayout(e.target.value as PageChrome['sectionsLayout'] & string)
                  saveNow()
                }}
              >
                <option value="fullwidth">Fullwidth</option>
                <option value="boxed">Boxed content</option>
              </select>
              <small className="field-hint">
                Default only when a section has no Width setting. Prefer Layout canvas section Width
                (full / boxed) — section owns container width.
              </small>
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="accessTags"
            onCopy={copyFieldFromBase}
            inherited={inherits('accessTags')}
            onChange={setFieldInherit}
          >
            <AccessTagsField
              value={accessTags}
              groups={bootstrap.groups}
              disabled={pending || inherits('accessTags')}
              onChange={(next) => {
                setAccessTags(next)
                saveNow()
              }}
              legend="Who can see pages"
            />
          </FieldInheritRow>
        </Panel>

        <Panel title="Head Properties">
          <FieldInheritRow
            show={canInherit}
            fieldKey="metaTags"
            onCopy={copyFieldFromBase}
            inherited={inherits('metaTags')}
            onChange={setFieldInherit}
          >
            <div className="page-settings-list">
              <div className="page-settings-list-head">
                <strong>Meta Tags</strong>
                <button
                  type="button"
                  className="secondary"
                  disabled={inherits('metaTags')}
                  onClick={() => {
                    setMetaTags((prev) => [
                      ...prev,
                      { id: newPageSettingsEntityId('meta'), nameOrProperty: '', content: '' },
                    ])
                    saveNow()
                  }}
                >
                  Add
                </button>
              </div>
              <ul className="page-settings-asset-list">
                {metaTags.map((tag, index) => (
                  <li key={tag.id}>
                    <input
                      type="text"
                      placeholder="name or property"
                      value={tag.nameOrProperty}
                      disabled={inherits('metaTags')}
                      onChange={(e) => {
                        const next = [...metaTags]
                        next[index] = { ...tag, nameOrProperty: e.target.value }
                        setMetaTags(next)
                        saveDebounced()
                      }}
                      onBlur={() => saveNow()}
                    />
                    <input
                      type="text"
                      placeholder="content"
                      value={tag.content}
                      disabled={inherits('metaTags')}
                      onChange={(e) => {
                        const next = [...metaTags]
                        next[index] = { ...tag, content: e.target.value }
                        setMetaTags(next)
                        saveDebounced()
                      }}
                      onBlur={() => saveNow()}
                    />
                    <button
                      type="button"
                      className="danger"
                      disabled={inherits('metaTags')}
                      onClick={() => {
                        setMetaTags(metaTags.filter((_, i) => i !== index))
                        saveNow()
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </FieldInheritRow>

          <FieldInheritRow
            show={canInherit}
            fieldKey="customHeadHtml"
            onCopy={copyFieldFromBase}
            inherited={inherits('customHeadHtml')}
            onChange={setFieldInherit}
          >
            <div className={lockedScripts ? 'page-settings-locked' : undefined}>
              <div className="page-settings-list-head">
                <strong>Custom Content</strong>
                <span className="page-settings-acl">Developer-admin</span>
              </div>
              {lockedScripts ? (
                <p className="settings-hint">Locked — existing custom head HTML is preserved on save.</p>
              ) : (
                <CodeEditorField
                  key={`pageHead-${inherits('customHeadHtml')}`}
                  name={inherits('customHeadHtml') ? undefined : 'customHeadHtml'}
                  label="Page Head (custom HTML)"
                  language="html"
                  initialValue={customHeadHtml}
                  initialHeight={200}
                  hint="Injected into <head> (manifest links, scripts, …)."
                  onValueChange={(next) => {
                    if (inherits('customHeadHtml')) return
                    setCustomHeadHtml(next)
                    saveDebounced()
                  }}
                />
              )}
            </div>
          </FieldInheritRow>
        </Panel>

        <Panel title="Assets">
          <FieldInheritRow
            show={canInherit}
            fieldKey="faviconUrl"
            onCopy={copyFieldFromBase}
            inherited={inherits('faviconUrl')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Favicon URL</span>
              <input
                type="url"
                name="faviconUrl"
                value={faviconUrl}
                disabled={inherits('faviconUrl')}
                onChange={(e) => {
                  setFaviconUrl(e.target.value)
                  saveDebounced()
                }}
                onBlur={() => saveNow()}
                placeholder="https://…/favicon.ico"
              />
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="touchIconUrl"
            onCopy={copyFieldFromBase}
            inherited={inherits('touchIconUrl')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Touch Icon URL</span>
              <input
                type="url"
                name="touchIconUrl"
                value={touchIconUrl}
                disabled={inherits('touchIconUrl')}
                onChange={(e) => {
                  setTouchIconUrl(e.target.value)
                  saveDebounced()
                }}
                onBlur={() => saveNow()}
                placeholder="https://…/apple-touch-icon.png"
              />
            </label>
          </FieldInheritRow>
          <OrderedAssetList
            label="CSS"
            language="css"
            items={css}
            onChange={setCssAndSync}
            onTextChange={saveDebounced}
            onDiscreteChange={() => {
              // Wait for inheritKeysJson / cssJson hidden inputs to re-render.
              window.setTimeout(() => saveNow(), 0)
            }}
            canInherit={canInherit}
            baseItems={baseChrome.css ?? []}
          />
          <OrderedAssetList
            label="JavaScript"
            language="javascript"
            items={javascript}
            onChange={setJavascriptAndSync}
            onTextChange={saveDebounced}
            onDiscreteChange={() => {
              window.setTimeout(() => saveNow(), 0)
            }}
            disabled={lockedScripts}
            developerOnly
            canInherit={canInherit && !lockedScripts}
            baseItems={baseChrome.javascript ?? []}
          />
        </Panel>

        <Panel title="Body Attributes">
          <FieldInheritRow
            show={canInherit}
            fieldKey="bodyId"
            onCopy={copyFieldFromBase}
            inherited={inherits('bodyId')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Body Id</span>
              <input
                type="text"
                name="bodyId"
                value={bodyId}
                disabled={inherits('bodyId')}
                onChange={(e) => {
                  setBodyId(e.target.value)
                  saveDebounced()
                }}
                onBlur={() => saveNow()}
              />
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="bodyClasses"
            onCopy={copyFieldFromBase}
            inherited={inherits('bodyClasses')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Body Classes</span>
              <input
                type="text"
                name="bodyClasses"
                value={bodyClasses}
                disabled={inherits('bodyClasses')}
                onChange={(e) => {
                  setBodyClasses(e.target.value)
                  saveDebounced()
                }}
                onBlur={() => saveNow()}
                placeholder="class-a class-b"
              />
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="bodyTagAttributes"
            onCopy={copyFieldFromBase}
            inherited={inherits('bodyTagAttributes')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Tag Attributes</span>
              <input
                type="text"
                name="bodyTagAttributes"
                value={bodyTagAttributes}
                disabled={inherits('bodyTagAttributes')}
                onChange={(e) => {
                  setBodyTagAttributes(e.target.value)
                  saveDebounced()
                }}
                onBlur={() => saveNow()}
                placeholder={'data-theme="light"'}
              />
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="afterBodyHtml"
            onCopy={copyFieldFromBase}
            inherited={inherits('afterBodyHtml')}
            onChange={setFieldInherit}
          >
            <div className={lockedScripts ? 'page-settings-locked' : undefined}>
              <div className="page-settings-list-head">
                <strong>After {'<body>'}</strong>
                <span className="page-settings-acl">Developer-admin</span>
              </div>
              {lockedScripts ? (
                <p className="settings-hint">Locked — preserved on save.</p>
              ) : (
                <CodeEditorField
                  key={`afterBody-${inherits('afterBodyHtml')}`}
                  name={inherits('afterBodyHtml') ? undefined : 'afterBodyHtml'}
                  label="After <body>"
                  language="html"
                  initialValue={afterBodyHtml}
                  initialHeight={140}
                  placeholder="HTML after opening body tag"
                  onValueChange={(next) => {
                    if (inherits('afterBodyHtml')) return
                    setAfterBodyHtml(next)
                    saveDebounced()
                  }}
                />
              )}
            </div>
          </FieldInheritRow>
          <FieldInheritRow
            show={canInherit}
            fieldKey="beforeBodyCloseHtml"
            onCopy={copyFieldFromBase}
            inherited={inherits('beforeBodyCloseHtml')}
            onChange={setFieldInherit}
          >
            <div className={lockedScripts ? 'page-settings-locked' : undefined}>
              <div className="page-settings-list-head">
                <strong>Before {'</body>'}</strong>
                <span className="page-settings-acl">Developer-admin</span>
              </div>
              {lockedScripts ? (
                <p className="settings-hint">Locked — preserved on save.</p>
              ) : (
                <CodeEditorField
                  key={`beforeBody-${inherits('beforeBodyCloseHtml')}`}
                  name={inherits('beforeBodyCloseHtml') ? undefined : 'beforeBodyCloseHtml'}
                  label="Before </body>"
                  language="html"
                  initialValue={beforeBodyCloseHtml}
                  initialHeight={140}
                  placeholder="HTML before closing body tag"
                  onValueChange={(next) => {
                    if (inherits('beforeBodyCloseHtml')) return
                    setBeforeBodyCloseHtml(next)
                    saveDebounced()
                  }}
                />
              )}
            </div>
          </FieldInheritRow>
        </Panel>

        <Panel id="font-awesome" title="Font Awesome Settings">
          <FieldInheritRow
            show={canInherit}
            fieldKey="fontAwesome"
            onCopy={copyFieldFromBase}
            inherited={inherits('fontAwesome')}
            onChange={setFieldInherit}
          >
            <p className="settings-hint">
              Layouts area — not Settings. Product gate <code>product:font-awesome</code> still
              lives under Settings → Modules (off skips public FA assets).
            </p>
            <label className="settings-flag">
              <input
                type="checkbox"
                name="faEnabled"
                value="true"
                checked={faEnabled}
                disabled={inherits('fontAwesome')}
                onChange={(e) => {
                  setFaEnabled(e.target.checked)
                  saveNow()
                }}
              />
              <span>
                <strong>Enable Font Awesome</strong>
                <span className="settings-flag-desc">Site CDN CSS when on (not a hard dependency).</span>
              </span>
            </label>
            <label className="settings-flag">
              <input
                type="checkbox"
                name="faV4Compat"
                value="true"
                checked={faV4Compat}
                disabled={inherits('fontAwesome')}
                onChange={(e) => {
                  setFaV4Compat(e.target.checked)
                  saveNow()
                }}
              />
              <span>
                <strong>V4 Compatibility</strong>
              </span>
            </label>
            <label className="settings-flag">
              <input
                type="checkbox"
                name="faContentCompat"
                value="true"
                checked={faContentCompat}
                disabled={inherits('fontAwesome')}
                onChange={(e) => {
                  setFaContentCompat(e.target.checked)
                  saveNow()
                }}
              />
              <span>
                <strong>Content Compatibility</strong>
                <span className="settings-flag-desc">Reserved flag for content-side FA helpers.</span>
              </span>
            </label>
            <label className="settings-field">
              <span>Version</span>
              <select
                name="faVersion"
                value={faVersion}
                disabled={inherits('fontAwesome')}
                onChange={(e) => {
                  setFaVersion(e.target.value)
                  saveNow()
                }}
              >
                <option value="6-free">Font Awesome 6 Free</option>
                <option value="7-free">Font Awesome 7 Free</option>
              </select>
            </label>
            <div className={lockedScripts ? 'page-settings-locked' : undefined}>
              {lockedScripts ? (
                <>
                  <input type="hidden" name="faCssLinkHtml" value={faCssLinkHtml} />
                  <input type="hidden" name="faJsScriptHtml" value={faJsScriptHtml} />
                  <p className="settings-hint">FA HTML overrides locked — preserved on save.</p>
                </>
              ) : (
                <>
                  <CodeEditorField
                    key={`faCss-${inherits('fontAwesome')}`}
                    name={inherits('fontAwesome') ? undefined : 'faCssLinkHtml'}
                    label="CSS Link HTML"
                    language="html"
                    initialValue={faCssLinkHtml}
                    initialHeight={96}
                    minHeight={72}
                    placeholder="Optional raw <link> override"
                    onValueChange={(next) => {
                      if (inherits('fontAwesome')) return
                      setFaCssLinkHtml(next)
                      saveDebounced()
                    }}
                  />
                  <CodeEditorField
                    key={`faJs-${inherits('fontAwesome')}`}
                    name={inherits('fontAwesome') ? undefined : 'faJsScriptHtml'}
                    label="JS Script HTML"
                    language="html"
                    initialValue={faJsScriptHtml}
                    initialHeight={96}
                    minHeight={72}
                    placeholder="Optional raw <script> override"
                    onValueChange={(next) => {
                      if (inherits('fontAwesome')) return
                      setFaJsScriptHtml(next)
                      saveDebounced()
                    }}
                  />
                </>
              )}
            </div>
          </FieldInheritRow>
        </Panel>

        <Panel title="Atoms" wide>
          <p className="settings-hint">
            Non-visual injectors (like Gantry atoms). Add with a pill, configure in a popup overlay.
          </p>
          <div className="page-settings-atom-pills">
            {bootstrap.atoms.map((atom) => {
              const blocked = Boolean(atom.requiresDeveloperAdmin && lockedScripts)
              return (
                <button
                  key={atom.type}
                  type="button"
                  className="page-settings-atom-pill"
                  disabled={blocked}
                  title={atom.description || atom.label}
                  onClick={() => addAtom(atom.type)}
                >
                  + {atom.label}
                </button>
              )
            })}
          </div>
          <ul className="page-settings-atom-list">
            {atoms.map((atom) => {
              const def = bootstrap.atoms.find((a) => a.type === atom.type)
              return (
                <li key={atom.id} className="page-settings-atom-row">
                  <label className="page-settings-atom-enable">
                    <input
                      type="checkbox"
                      checked={atom.enabled}
                      onChange={(e) => {
                        setAtoms((prev) =>
                          prev.map((a) => (a.id === atom.id ? { ...a, enabled: e.target.checked } : a)),
                        )
                        saveNow()
                      }}
                    />
                    <strong>{def?.label || atom.type}</strong>
                  </label>
                  <code>{atom.type}</code>
                  <AtomSettingsPopover title={def?.label || atom.type}>
                    {atom.type === 'custom-css-js' ? (
                      <div className="gantry-typed-form">
                        {lockedScripts ? (
                          <p className="settings-hint">Locked — atom CSS/JS preserved on save.</p>
                        ) : (
                          <>
                            <CodeEditorField
                              key={`atom-css-${atom.id}`}
                              label="CSS"
                              language="css"
                              initialValue={String(atom.config.css ?? '')}
                              initialHeight={140}
                              onValueChange={(next) =>
                                updateAtomConfig(atom.id, { ...atom.config, css: next })
                              }
                            />
                            <CodeEditorField
                              key={`atom-js-${atom.id}`}
                              label="JavaScript"
                              language="javascript"
                              initialValue={String(atom.config.javascript ?? '')}
                              initialHeight={140}
                              onValueChange={(next) =>
                                updateAtomConfig(atom.id, {
                                  ...atom.config,
                                  javascript: next,
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                    ) : atom.type === 'analytics' ? (
                      <div className="gantry-typed-form">
                        <label>
                          Provider
                          <select
                            value={String(atom.config.provider ?? 'google')}
                            disabled={lockedScripts}
                            onChange={(e) =>
                              updateAtomConfig(
                                atom.id,
                                {
                                  ...atom.config,
                                  provider: e.target.value,
                                },
                                'now',
                              )
                            }
                          >
                            <option value="google">Google Analytics (gtag)</option>
                            <option value="generic">Generic measurement id</option>
                          </select>
                        </label>
                        <label>
                          Measurement ID
                          <input
                            type="text"
                            value={String(atom.config.measurementId ?? '')}
                            disabled={lockedScripts}
                            placeholder="G-XXXXXXXX"
                            onChange={(e) =>
                              updateAtomConfig(atom.id, {
                                ...atom.config,
                                measurementId: e.target.value,
                              })
                            }
                            onBlur={() => saveNow()}
                          />
                        </label>
                      </div>
                    ) : (
                      <p className="settings-hint">No settings UI for this atom yet.</p>
                    )}
                  </AtomSettingsPopover>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setAtoms((prev) => prev.filter((a) => a.id !== atom.id))
                      saveNow()
                    }}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
          {atoms.length === 0 ? <p className="settings-hint">No atoms on this chrome yet.</p> : null}
        </Panel>

        </div>

        {pending ? <p className="field-hint page-settings-saving">Saving…</p> : null}
      </form>

    </div>
  )
}

