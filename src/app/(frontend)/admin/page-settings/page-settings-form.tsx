'use client'

import React, { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { CodeEditorField } from '@/components/admin/CodeEditorField'
import { resolveAccessTags } from '@/core/acl/nav-access'
import {
  clearPageOverrideAction,
  saveGlobalPageSettingsAction,
  savePageOverrideAction,
  type PageSettingsActionState,
  type PageSettingsAdminBootstrap,
} from '@/core/page-settings/actions'
import { HOME_PAGE_KEY, newPageSettingsEntityId } from '@/core/page-settings/defaults'
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
import { InheritSwitch } from '../layouts/layout-inherit-controls'
import { useAutosaveForm } from '../use-autosave-form'
import { AtomSettingsPopover } from './atom-settings-popover'

function FieldInheritRow({
  show,
  fieldKey,
  inherited,
  onChange,
  children,
}: {
  show: boolean
  fieldKey: PageChromeInheritKey
  inherited: boolean
  onChange: (key: PageChromeInheritKey, next: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className={inherited && show ? 'page-settings-field-inherited' : undefined}>
      {children}
      {show ? (
        <InheritSwitch
          inherited={inherited}
          label="Inherit"
          onChange={(next) => onChange(fieldKey, next)}
        />
      ) : null}
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

function OrderedAssetList({
  label,
  language,
  items,
  onChange,
  onTextChange,
  onDiscreteChange,
  disabled,
  developerOnly,
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
}) {
  const fileLabel = language === 'css' ? 'CSS file' : 'JS file'

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
              ...items,
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
      </p>
      {items.length === 0 ? <p className="settings-hint">No files yet.</p> : null}
      <ul className="page-settings-asset-list page-settings-asset-list--files">
        {items.map((item, index) => (
          <li key={item.id}>
            <input
              type="text"
              placeholder="File name"
              value={item.name}
              disabled={disabled}
              aria-label={`${label} file name`}
              onChange={(e) => {
                const next = [...items]
                next[index] = { ...item, name: e.target.value }
                onChange(next)
                onTextChange?.()
              }}
              onBlur={() => onDiscreteChange?.()}
            />
            <label className="page-settings-asset-priority">
              <span>Priority</span>
              <input
                type="number"
                min={ASSET_PRIORITY_MIN}
                max={ASSET_PRIORITY_MAX}
                step={1}
                value={item.priority ?? 0}
                disabled={disabled}
                aria-label={`${label} load priority`}
                onChange={(e) => {
                  const raw = Number(e.target.value)
                  const priority = Number.isFinite(raw)
                    ? Math.min(
                        ASSET_PRIORITY_MAX,
                        Math.max(ASSET_PRIORITY_MIN, Math.round(raw)),
                      )
                    : 0
                  const next = [...items]
                  next[index] = { ...item, priority }
                  onChange(next)
                  onDiscreteChange?.()
                }}
              />
            </label>
            <div className="page-settings-row-actions">
              {disabled ? (
                <button type="button" className="gantry-toolbar-btn secondary" disabled>
                  Edit
                </button>
              ) : (
                <AtomSettingsPopover
                  title={`Edit ${item.name || fileLabel}`}
                  triggerLabel="Edit"
                  preferredWidth={600}
                  onClose={() => onDiscreteChange?.()}
                >
                  <CodeEditorField
                    key={`${item.id}-editor`}
                    label={item.name || fileLabel}
                    language={language}
                    initialValue={item.content ?? ''}
                    initialHeight={280}
                    hint={
                      language === 'css'
                        ? 'Inline CSS applied on the public site as a <style> block (site / page chrome — not per outline).'
                        : 'Inline JS injected before </body>.'
                    }
                    onValueChange={(nextContent) => {
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, content: nextContent } : row,
                        ),
                      )
                      onTextChange?.()
                    }}
                  />
                  <label className="settings-field">
                    <span>External URL (optional)</span>
                    <input
                      type="url"
                      placeholder="https://… (used when content is empty)"
                      defaultValue={item.url}
                      onChange={(e) => {
                        const url = e.target.value
                        onChange(
                          items.map((row, i) => (i === index ? { ...row, url } : row)),
                        )
                        onTextChange?.()
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
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PageSettingsForm({ bootstrap }: Props) {
  const router = useRouter()
  const isPage = Boolean(bootstrap.editingPageKey)
  const saveAction = isPage ? savePageOverrideAction : saveGlobalPageSettingsAction
  const [state, formAction, pending] = useActionState(saveAction, INITIAL)
  const [clearState, clearAction, clearPending] = useActionState(clearPageOverrideAction, INITIAL)
  useNotifySavedOnOk(state, { toastErrors: true })
  useNotifySavedOnOk(clearState, { successMessage: 'Saved', toastErrors: true })
  const [, startTransition] = useTransition()
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const globalChrome = bootstrap.globalChrome
  const initial = bootstrap.editingChrome
  const pickInitial = <T,>(local: T | undefined, fallback: T): T =>
    local !== undefined ? local : fallback

  const [inheritedKeys, setInheritedKeys] = useState<Set<PageChromeInheritKey>>(() =>
    isPage ? new Set(inheritedKeysFromOverride(initial)) : new Set(),
  )
  const inherits = (key: PageChromeInheritKey) => isPage && inheritedKeys.has(key)

  const [layoutId, setLayoutId] = useState(
    pickInitial(initial.layoutId, globalChrome.layoutId ?? 'default'),
  )
  const [sectionsLayout, setSectionsLayout] = useState(
    pickInitial(initial.sectionsLayout, globalChrome.sectionsLayout ?? 'fullwidth'),
  )
  const [accessTags, setAccessTags] = useState<string[]>(() =>
    resolveAccessTags({
      accessTags: pickInitial(initial.accessTags, globalChrome.accessTags),
    }),
  )
  const [metaTags, setMetaTags] = useState<MetaTag[]>(
    pickInitial(initial.metaTags, globalChrome.metaTags ?? []),
  )
  const [customHeadHtml, setCustomHeadHtml] = useState(
    pickInitial(initial.customHeadHtml, globalChrome.customHeadHtml ?? ''),
  )
  const [faviconUrl, setFaviconUrl] = useState(
    pickInitial(initial.faviconUrl, globalChrome.faviconUrl ?? ''),
  )
  const [touchIconUrl, setTouchIconUrl] = useState(
    pickInitial(initial.touchIconUrl, globalChrome.touchIconUrl ?? ''),
  )
  const [css, setCss] = useState<AssetRef[]>(pickInitial(initial.css, globalChrome.css ?? []))
  const [javascript, setJavascript] = useState<AssetRef[]>(
    pickInitial(initial.javascript, globalChrome.javascript ?? []),
  )
  const [bodyId, setBodyId] = useState(pickInitial(initial.bodyId, globalChrome.bodyId ?? ''))
  const [bodyClasses, setBodyClasses] = useState(
    pickInitial(initial.bodyClasses, globalChrome.bodyClasses ?? ''),
  )
  const [bodyTagAttributes, setBodyTagAttributes] = useState(
    pickInitial(initial.bodyTagAttributes, globalChrome.bodyTagAttributes ?? ''),
  )
  const [afterBodyHtml, setAfterBodyHtml] = useState(
    pickInitial(initial.afterBodyHtml, globalChrome.afterBodyHtml ?? ''),
  )
  const [beforeBodyCloseHtml, setBeforeBodyCloseHtml] = useState(
    pickInitial(initial.beforeBodyCloseHtml, globalChrome.beforeBodyCloseHtml ?? ''),
  )
  const [faEnabled, setFaEnabled] = useState(
    pickInitial(initial.fontAwesome?.enabled, globalChrome.fontAwesome?.enabled ?? false),
  )
  const [faV4Compat, setFaV4Compat] = useState(
    pickInitial(initial.fontAwesome?.v4Compat, globalChrome.fontAwesome?.v4Compat ?? false),
  )
  const [faContentCompat, setFaContentCompat] = useState(
    pickInitial(
      initial.fontAwesome?.contentCompat,
      globalChrome.fontAwesome?.contentCompat ?? false,
    ),
  )
  const [faVersion, setFaVersion] = useState(
    pickInitial(initial.fontAwesome?.version, globalChrome.fontAwesome?.version ?? '6-free'),
  )
  const [faCssLinkHtml, setFaCssLinkHtml] = useState(
    pickInitial(initial.fontAwesome?.cssLinkHtml, globalChrome.fontAwesome?.cssLinkHtml ?? ''),
  )
  const [faJsScriptHtml, setFaJsScriptHtml] = useState(
    pickInitial(initial.fontAwesome?.jsScriptHtml, globalChrome.fontAwesome?.jsScriptHtml ?? ''),
  )
  const [atoms, setAtoms] = useState<PageAtomInstance[]>(
    pickInitial(initial.atoms, globalChrome.atoms ?? []),
  )

  const lockedScripts = !bootstrap.isDeveloperAdmin

  const setFieldInherit = (key: PageChromeInheritKey, nextInherited: boolean) => {
    setInheritedKeys((prev) => {
      const copy = new Set(prev)
      if (nextInherited) copy.add(key)
      else copy.delete(key)
      return copy
    })
    // Let the hidden inheritKeysJson re-render before autosave posts.
    window.setTimeout(() => saveNow(), 0)
  }

  // Explicit onChange/blur autosave only — no effect watching draft state (Strict Mode was
  // firing a false "Saved" on open via skipAutosave flip + second effect pass).

  // One Global + one Home (/) + unique CMS pages/overrides.
  // Seed creates Payload slug `home` for `/` — do not add it again after HOME_PAGE_KEY.
  const pageOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = []
    const seen = new Set<string>()
    const push = (value: string, label: string) => {
      if (seen.has(value)) return
      seen.add(value)
      opts.push({ value, label })
    }

    push('', 'Site default (global)')

    const homePage = bootstrap.pages.find((p) => p.slug === HOME_PAGE_KEY)
    push(HOME_PAGE_KEY, homePage?.title ? `${homePage.title} (/)` : 'Home (/)')

    for (const page of bootstrap.pages) {
      if (page.slug === HOME_PAGE_KEY) continue
      push(page.slug, `${page.title} (/${page.slug})`)
    }
    for (const key of bootstrap.overrideKeys) {
      if (key === HOME_PAGE_KEY) continue
      if (bootstrap.pages.some((p) => p.slug === key)) continue
      push(key, `${key} (override only)`)
    }
    return opts
  }, [bootstrap.pages, bootstrap.overrideKeys])

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
      <div className="page-settings-toolbar">
        <label className="page-settings-picker">
          <span>Edit</span>
          <select
            value={bootstrap.editingPageKey ?? ''}
            onChange={(event) => {
              const value = event.target.value
              startTransition(() => {
                router.push(
                  value
                    ? `/admin/page-settings?page=${encodeURIComponent(value)}`
                    : '/admin/page-settings',
                )
              })
            }}
          >
            {pageOptions.map((opt) => (
              <option key={opt.value || 'global'} value={opt.value}>
                {opt.label}
                {opt.value && bootstrap.overrideKeys.includes(opt.value) ? ' · override' : ''}
              </option>
            ))}
          </select>
        </label>
        {isPage ? (
          <p className="settings-hint">
            Per-page override{bootstrap.hasOverride ? '' : ' (no row yet — all fields inherit site defaults)'}.
            Use the Inherit slide after each field: On = site global, Off = local override for this page.
          </p>
        ) : (
          <p className="settings-hint">Site-wide defaults. Pages can override individually.</p>
        )}
      </div>

      {!bootstrap.isDeveloperAdmin ? (
        <p className="notice-banner page-settings-acl-banner" role="status">
          Script fields (custom head, body hooks, JS lists, atom scripts, FA HTML overrides) are
          developer-admin only. Add your email to <code>STARFORGE_DEVELOPER_ADMIN_EMAILS</code>{' '}
          (empty list grants nobody in production).
        </p>
      ) : null}

      {(state.error || clearState.error) && (
        <p className="form-error" role="alert">
          {state.error || clearState.error}
        </p>
      )}
      {(state.ok || clearState.ok) && (
        <p className="form-ok" role="status">
          {state.message || clearState.message || 'Saved.'}
        </p>
      )}

      <form ref={formRef} action={formAction} className="page-settings-form settings-form">
        {isPage ? <input type="hidden" name="pageKey" value={bootstrap.editingPageKey ?? ''} /> : null}
        {isPage ? (
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
        <Panel title="Layout assignment">
          <FieldInheritRow
            show={isPage}
            fieldKey="layoutId"
            inherited={inherits('layoutId')}
            onChange={setFieldInherit}
          >
            <label className="settings-field">
              <span>Layout</span>
              <select
                name="layoutId"
                value={layoutId}
                disabled={inherits('layoutId')}
                onChange={(e) => {
                  setLayoutId(e.target.value)
                  saveNow()
                }}
              >
                {(bootstrap.layouts?.length
                  ? bootstrap.layouts
                  : bootstrap.layoutIds.map((id) => ({ id, label: id }))
                ).map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.label} ({layout.id})
                  </option>
                ))}
              </select>
            </label>
          </FieldInheritRow>
          <FieldInheritRow
            show={isPage}
            fieldKey="sectionsLayout"
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
            show={isPage}
            fieldKey="accessTags"
            inherited={inherits('accessTags')}
            onChange={setFieldInherit}
          >
            <AccessTagsField
              value={accessTags}
              groups={bootstrap.groups}
              disabled={pending || clearPending || inherits('accessTags')}
              onChange={(next) => {
                setAccessTags(next)
                saveNow()
              }}
              legend="Who can see this page"
            />
          </FieldInheritRow>
        </Panel>

        <Panel title="Head Properties">
          <FieldInheritRow
            show={isPage}
            fieldKey="metaTags"
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
            show={isPage}
            fieldKey="customHeadHtml"
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
                  key={`pageHead-${bootstrap.editingPageKey ?? 'global'}-${inherits('customHeadHtml')}`}
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
            show={isPage}
            fieldKey="faviconUrl"
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
            show={isPage}
            fieldKey="touchIconUrl"
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
          <FieldInheritRow
            show={isPage}
            fieldKey="css"
            inherited={inherits('css')}
            onChange={setFieldInherit}
          >
            <OrderedAssetList
              label="CSS"
              language="css"
              items={css}
              onChange={setCss}
              onTextChange={saveDebounced}
              onDiscreteChange={saveNow}
              disabled={inherits('css')}
            />
          </FieldInheritRow>
          <FieldInheritRow
            show={isPage}
            fieldKey="javascript"
            inherited={inherits('javascript')}
            onChange={setFieldInherit}
          >
            <OrderedAssetList
              label="JavaScript"
              language="javascript"
              items={javascript}
              onChange={setJavascript}
              onTextChange={saveDebounced}
              onDiscreteChange={saveNow}
              disabled={lockedScripts || inherits('javascript')}
              developerOnly
            />
          </FieldInheritRow>
        </Panel>

        <Panel title="Body Attributes">
          <FieldInheritRow
            show={isPage}
            fieldKey="bodyId"
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
            show={isPage}
            fieldKey="bodyClasses"
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
            show={isPage}
            fieldKey="bodyTagAttributes"
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
            show={isPage}
            fieldKey="afterBodyHtml"
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
                  key={`afterBody-${bootstrap.editingPageKey ?? 'global'}-${inherits('afterBodyHtml')}`}
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
            show={isPage}
            fieldKey="beforeBodyCloseHtml"
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
                  key={`beforeBody-${bootstrap.editingPageKey ?? 'global'}-${inherits('beforeBodyCloseHtml')}`}
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
            show={isPage}
            fieldKey="fontAwesome"
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
                  key={`faCss-${bootstrap.editingPageKey ?? 'global'}`}
                  name="faCssLinkHtml"
                  label="CSS Link HTML"
                  language="html"
                  initialValue={faCssLinkHtml}
                  initialHeight={96}
                  minHeight={72}
                  placeholder="Optional raw <link> override"
                  onValueChange={(next) => {
                    setFaCssLinkHtml(next)
                    saveDebounced()
                  }}
                />
                <CodeEditorField
                  key={`faJs-${bootstrap.editingPageKey ?? 'global'}`}
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

      {isPage && bootstrap.hasOverride ? (
        <form action={clearAction} className="page-settings-clear admin-action-row">
          <input type="hidden" name="pageKey" value={bootstrap.editingPageKey ?? ''} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-danger danger"
            disabled={clearPending}
          >
            {clearPending ? 'Clearing…' : 'Clear override'}
          </button>
        </form>
      ) : null}
    </div>
  )
}

