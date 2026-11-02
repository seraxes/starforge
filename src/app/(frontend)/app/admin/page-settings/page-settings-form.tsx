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
import { newPageSettingsEntityId } from '@/core/page-settings/defaults'
import type { AssetRef, MetaTag, PageAtomInstance, PageChrome } from '@/core/page-settings/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { AtomSettingsPopover } from './atom-settings-popover'

type Props = {
  bootstrap: PageSettingsAdminBootstrap
}

const INITIAL: PageSettingsActionState = {}

function Panel({
  title,
  wide,
  children,
}: {
  title: string
  /** @deprecated Panels are always expanded (no collapse). Kept for call-site compat. */
  defaultOpen?: boolean
  /** Span two mosaic columns on wide screens. */
  wide?: boolean
  children: React.ReactNode
}) {
  // Always-open mosaic tiles — not <details>; Body / FA / Atoms / etc. must never start collapsed.
  return (
    <section
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
  items,
  onChange,
  onTextChange,
  onDiscreteChange,
  disabled,
  developerOnly,
}: {
  label: string
  items: AssetRef[]
  onChange: (next: AssetRef[]) => void
  /** Debounced persist for typing name/url. */
  onTextChange?: () => void
  /** Immediate persist for add/remove/reorder. */
  onDiscreteChange?: () => void
  disabled?: boolean
  developerOnly?: boolean
}) {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]!
    next[index] = next[target]!
    next[target] = tmp
    onChange(next)
    onDiscreteChange?.()
  }

  return (
    <div className="page-settings-list">
      <div className="page-settings-list-head">
        <strong>{label}</strong>
        {developerOnly ? <span className="page-settings-acl">Developer-admin</span> : null}
        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={() => {
            onChange([
              ...items,
              { id: newPageSettingsEntityId('asset'), name: '', url: '' },
            ])
            onDiscreteChange?.()
          }}
        >
          Add
        </button>
      </div>
      {items.length === 0 ? <p className="settings-hint">No items yet.</p> : null}
      <ul className="page-settings-asset-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <input
              type="text"
              placeholder="Name"
              value={item.name}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items]
                next[index] = { ...item, name: e.target.value }
                onChange(next)
                onTextChange?.()
              }}
              onBlur={() => onDiscreteChange?.()}
            />
            <input
              type="url"
              placeholder="https://…"
              value={item.url}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items]
                next[index] = { ...item, url: e.target.value }
                onChange(next)
                onTextChange?.()
              }}
              onBlur={() => onDiscreteChange?.()}
            />
            <div className="page-settings-row-actions">
              <button type="button" className="secondary" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                disabled={disabled || index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="danger"
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

  const initial = bootstrap.editingChrome
  const [layoutId, setLayoutId] = useState(initial.layoutId ?? 'default')
  const [sectionsLayout, setSectionsLayout] = useState(initial.sectionsLayout ?? 'fullwidth')
  const [accessTags, setAccessTags] = useState<string[]>(() =>
    resolveAccessTags({ accessTags: initial.accessTags }),
  )
  const [metaTags, setMetaTags] = useState<MetaTag[]>(initial.metaTags ?? [])
  const [customHeadHtml, setCustomHeadHtml] = useState(initial.customHeadHtml ?? '')
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl ?? '')
  const [touchIconUrl, setTouchIconUrl] = useState(initial.touchIconUrl ?? '')
  const [css, setCss] = useState<AssetRef[]>(initial.css ?? [])
  const [javascript, setJavascript] = useState<AssetRef[]>(initial.javascript ?? [])
  const [bodyId, setBodyId] = useState(initial.bodyId ?? '')
  const [bodyClasses, setBodyClasses] = useState(initial.bodyClasses ?? '')
  const [bodyTagAttributes, setBodyTagAttributes] = useState(initial.bodyTagAttributes ?? '')
  const [afterBodyHtml, setAfterBodyHtml] = useState(initial.afterBodyHtml ?? '')
  const [beforeBodyCloseHtml, setBeforeBodyCloseHtml] = useState(initial.beforeBodyCloseHtml ?? '')
  const [faEnabled, setFaEnabled] = useState(initial.fontAwesome?.enabled ?? false)
  const [faV4Compat, setFaV4Compat] = useState(initial.fontAwesome?.v4Compat ?? false)
  const [faContentCompat, setFaContentCompat] = useState(initial.fontAwesome?.contentCompat ?? false)
  const [faVersion, setFaVersion] = useState(initial.fontAwesome?.version ?? '6-free')
  const [faCssLinkHtml, setFaCssLinkHtml] = useState(initial.fontAwesome?.cssLinkHtml ?? '')
  const [faJsScriptHtml, setFaJsScriptHtml] = useState(initial.fontAwesome?.jsScriptHtml ?? '')
  const [atoms, setAtoms] = useState<PageAtomInstance[]>(initial.atoms ?? [])

  const lockedScripts = !bootstrap.isDeveloperAdmin

  // Explicit onChange/blur autosave only — no effect watching draft state (Strict Mode was
  // firing a false "Saved" on open via skipAutosave flip + second effect pass).

  const pageOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Site default (global)' }]
    opts.push({ value: 'home', label: 'Home (/)' })
    for (const page of bootstrap.pages) {
      opts.push({ value: page.slug, label: `${page.title} (/${page.slug})` })
    }
    for (const key of bootstrap.overrideKeys) {
      if (key === 'home') continue
      if (bootstrap.pages.some((p) => p.slug === key)) continue
      opts.push({ value: key, label: `${key} (override only)` })
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
                    ? `/app/admin/page-settings?page=${encodeURIComponent(value)}`
                    : '/app/admin/page-settings',
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
            Per-page override{bootstrap.hasOverride ? '' : ' (empty — inherits site defaults until saved)'}.
            Unset fields fall back to global on the public site.
          </p>
        ) : (
          <p className="settings-hint">Site-wide defaults. Pages can override individually.</p>
        )}
      </div>

      {!bootstrap.isDeveloperAdmin ? (
        <p className="notice-banner page-settings-acl-banner" role="status">
          Script fields (custom head, body hooks, JS lists, atom scripts, FA HTML overrides) are
          developer-admin only. Set <code>STARFORGE_DEVELOPER_ADMIN_EMAILS</code> or leave it empty
          so all admins can edit them.
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
        <input
          type="hidden"
          name="accessTagsJson"
          value={JSON.stringify(accessTags.length ? accessTags : ['public'])}
        />
        <input type="hidden" name="metaTagsJson" value={JSON.stringify(metaTags)} />
        <input type="hidden" name="cssJson" value={JSON.stringify(css)} />
        <input type="hidden" name="javascriptJson" value={JSON.stringify(javascript)} />
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

        <div className="page-settings-mosaic">
        <Panel title="Layout assignment">
          <label className="settings-field">
            <span>Layout</span>
            <select
              name="layoutId"
              value={layoutId}
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
          <label className="settings-field">
            <span>Sections layout (default)</span>
            <select
              name="sectionsLayout"
              value={sectionsLayout}
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
          <AccessTagsField
            value={accessTags}
            groups={bootstrap.groups}
            disabled={pending || clearPending}
            onChange={(next) => {
              setAccessTags(next)
              saveNow()
            }}
            legend="Who can see this page"
          />
        </Panel>

        <Panel title="Head Properties" wide>
          <div className="page-settings-list">
            <div className="page-settings-list-head">
              <strong>Meta Tags</strong>
              <button
                type="button"
                className="secondary"
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

          <div className={lockedScripts ? 'page-settings-locked' : undefined}>
            <div className="page-settings-list-head">
              <strong>Custom Content</strong>
              <span className="page-settings-acl">Developer-admin</span>
            </div>
            {lockedScripts ? (
              <p className="settings-hint">Locked — existing custom head HTML is preserved on save.</p>
            ) : (
              <CodeEditorField
                key={`pageHead-${bootstrap.editingPageKey ?? 'global'}`}
                name="customHeadHtml"
                label="Page Head (custom HTML)"
                language="html"
                initialValue={customHeadHtml}
                initialHeight={200}
                hint="Injected into <head> (manifest links, scripts, …)."
                onValueChange={(next) => {
                  setCustomHeadHtml(next)
                  saveDebounced()
                }}
              />
            )}
          </div>
        </Panel>

        <Panel title="Assets">
          <label className="settings-field">
            <span>Favicon URL</span>
            <input
              type="url"
              name="faviconUrl"
              value={faviconUrl}
              onChange={(e) => {
                setFaviconUrl(e.target.value)
                saveDebounced()
              }}
              onBlur={() => saveNow()}
              placeholder="https://…/favicon.ico"
            />
          </label>
          <label className="settings-field">
            <span>Touch Icon URL</span>
            <input
              type="url"
              name="touchIconUrl"
              value={touchIconUrl}
              onChange={(e) => {
                setTouchIconUrl(e.target.value)
                saveDebounced()
              }}
              onBlur={() => saveNow()}
              placeholder="https://…/apple-touch-icon.png"
            />
          </label>
          <OrderedAssetList
            label="CSS"
            items={css}
            onChange={setCss}
            onTextChange={saveDebounced}
            onDiscreteChange={saveNow}
          />
          <OrderedAssetList
            label="JavaScript"
            items={javascript}
            onChange={setJavascript}
            onTextChange={saveDebounced}
            onDiscreteChange={saveNow}
            disabled={lockedScripts}
            developerOnly
          />
        </Panel>

        <Panel title="Body Attributes">
          <label className="settings-field">
            <span>Body Id</span>
            <input
              type="text"
              name="bodyId"
              value={bodyId}
              onChange={(e) => {
                setBodyId(e.target.value)
                saveDebounced()
              }}
              onBlur={() => saveNow()}
            />
          </label>
          <label className="settings-field">
            <span>Body Classes</span>
            <input
              type="text"
              name="bodyClasses"
              value={bodyClasses}
              onChange={(e) => {
                setBodyClasses(e.target.value)
                saveDebounced()
              }}
              onBlur={() => saveNow()}
              placeholder="class-a class-b"
            />
          </label>
          <label className="settings-field">
            <span>Tag Attributes</span>
            <input
              type="text"
              name="bodyTagAttributes"
              value={bodyTagAttributes}
              onChange={(e) => {
                setBodyTagAttributes(e.target.value)
                saveDebounced()
              }}
              onBlur={() => saveNow()}
              placeholder={'data-theme="light"'}
            />
          </label>
          <div className={lockedScripts ? 'page-settings-locked' : undefined}>
            <div className="page-settings-list-head">
              <strong>After {'<body>'}</strong>
              <span className="page-settings-acl">Developer-admin</span>
            </div>
            {lockedScripts ? (
              <p className="settings-hint">Locked — preserved on save.</p>
            ) : (
              <CodeEditorField
                key={`afterBody-${bootstrap.editingPageKey ?? 'global'}`}
                name="afterBodyHtml"
                label="After <body>"
                language="html"
                initialValue={afterBodyHtml}
                initialHeight={140}
                placeholder="HTML after opening body tag"
                onValueChange={(next) => {
                  setAfterBodyHtml(next)
                  saveDebounced()
                }}
              />
            )}
          </div>
          <div className={lockedScripts ? 'page-settings-locked' : undefined}>
            <div className="page-settings-list-head">
              <strong>Before {'</body>'}</strong>
              <span className="page-settings-acl">Developer-admin</span>
            </div>
            {lockedScripts ? (
              <p className="settings-hint">Locked — preserved on save.</p>
            ) : (
              <CodeEditorField
                key={`beforeBody-${bootstrap.editingPageKey ?? 'global'}`}
                name="beforeBodyCloseHtml"
                label="Before </body>"
                language="html"
                initialValue={beforeBodyCloseHtml}
                initialHeight={140}
                placeholder="HTML before closing body tag"
                onValueChange={(next) => {
                  setBeforeBodyCloseHtml(next)
                  saveDebounced()
                }}
              />
            )}
          </div>
        </Panel>

        <Panel title="Font Awesome Settings">
          <label className="settings-flag">
            <input
              type="checkbox"
              name="faEnabled"
              value="true"
              checked={faEnabled}
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
                  name="faJsScriptHtml"
                  label="JS Script HTML"
                  language="html"
                  initialValue={faJsScriptHtml}
                  initialHeight={96}
                  minHeight={72}
                  placeholder="Optional raw <script> override"
                  onValueChange={(next) => {
                    setFaJsScriptHtml(next)
                    saveDebounced()
                  }}
                />
              </>
            )}
          </div>
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

