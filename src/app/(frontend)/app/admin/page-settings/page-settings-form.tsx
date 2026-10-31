'use client'

import React, { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import {
  clearPageOverrideAction,
  saveGlobalPageSettingsAction,
  savePageOverrideAction,
  type PageSettingsActionState,
  type PageSettingsAdminBootstrap,
} from '@/core/page-settings/actions'
import { newPageSettingsEntityId } from '@/core/page-settings/defaults'
import type { AssetRef, MetaTag, PageAtomInstance, PageChrome } from '@/core/page-settings/types'

import { AtomSettingsPopover } from './atom-settings-popover'

type Props = {
  bootstrap: PageSettingsAdminBootstrap
}

const INITIAL: PageSettingsActionState = {}

function Panel({
  title,
  defaultOpen = true,
  wide,
  children,
}: {
  title: string
  /** Panels start expanded (mosaic tiles stay open by default). */
  defaultOpen?: boolean
  /** Span two mosaic columns on wide screens. */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    // Keep tiles expanded on first paint; users can still collapse via <summary>.
    // React’s DOM typings historically omit `defaultOpen` on <details>.
    <details
      className={wide ? 'page-settings-panel page-settings-panel-wide' : 'page-settings-panel'}
      {...({
        defaultOpen: defaultOpen !== false,
      } as React.HTMLAttributes<HTMLDetailsElement>)}
    >
      <summary>{title}</summary>
      <div className="page-settings-panel-body">{children}</div>
    </details>
  )
}

function OrderedAssetList({
  label,
  items,
  onChange,
  disabled,
  developerOnly,
}: {
  label: string
  items: AssetRef[]
  onChange: (next: AssetRef[]) => void
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
          onClick={() =>
            onChange([
              ...items,
              { id: newPageSettingsEntityId('asset'), name: '', url: '' },
            ])
          }
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
              }}
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
              }}
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
                onClick={() => onChange(items.filter((_, i) => i !== index))}
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
  const [, startTransition] = useTransition()

  const initial = bootstrap.editingChrome
  const [layoutId, setLayoutId] = useState(initial.layoutId ?? 'default')
  const [sectionsLayout, setSectionsLayout] = useState(initial.sectionsLayout ?? 'fullwidth')
  const [metaTags, setMetaTags] = useState<MetaTag[]>(initial.metaTags ?? [])
  const customHeadHtml = initial.customHeadHtml ?? ''
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
  }

  const updateAtomConfig = (id: string, config: Record<string, unknown>) => {
    setAtoms((prev) => prev.map((a) => (a.id === id ? { ...a, config } : a)))
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

      <form action={formAction} className="page-settings-form settings-form">
        {isPage ? <input type="hidden" name="pageKey" value={bootstrap.editingPageKey ?? ''} /> : null}
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
            <select name="layoutId" value={layoutId} onChange={(e) => setLayoutId(e.target.value)}>
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
            <span>Sections layout</span>
            <select
              name="sectionsLayout"
              value={sectionsLayout}
              onChange={(e) => setSectionsLayout(e.target.value as PageChrome['sectionsLayout'] & string)}
            >
              <option value="fullwidth">Fullwidth</option>
              <option value="boxed">Boxed content</option>
            </select>
          </label>
        </Panel>

        <Panel title="Head Properties" wide>
          <div className="page-settings-list">
            <div className="page-settings-list-head">
              <strong>Meta Tags</strong>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setMetaTags((prev) => [
                    ...prev,
                    { id: newPageSettingsEntityId('meta'), nameOrProperty: '', content: '' },
                  ])
                }
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
                    }}
                  />
                  <input
                    type="text"
                    placeholder="content"
                    value={tag.content}
                    onChange={(e) => {
                      const next = [...metaTags]
                      next[index] = { ...tag, content: e.target.value }
                      setMetaTags(next)
                    }}
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setMetaTags(metaTags.filter((_, i) => i !== index))}
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
                name="customHeadHtml"
                label="Custom head HTML"
                language="html"
                initialValue={customHeadHtml}
                hint="Injected into <head> (manifest links, scripts, …)."
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
              onChange={(e) => setFaviconUrl(e.target.value)}
              placeholder="https://…/favicon.ico"
            />
          </label>
          <label className="settings-field">
            <span>Touch Icon URL</span>
            <input
              type="url"
              name="touchIconUrl"
              value={touchIconUrl}
              onChange={(e) => setTouchIconUrl(e.target.value)}
              placeholder="https://…/apple-touch-icon.png"
            />
          </label>
          <OrderedAssetList label="CSS" items={css} onChange={setCss} />
          <OrderedAssetList
            label="JavaScript"
            items={javascript}
            onChange={setJavascript}
            disabled={lockedScripts}
            developerOnly
          />
        </Panel>

        <Panel title="Body Attributes">
          <label className="settings-field">
            <span>Body Id</span>
            <input type="text" name="bodyId" value={bodyId} onChange={(e) => setBodyId(e.target.value)} />
          </label>
          <label className="settings-field">
            <span>Body Classes</span>
            <input
              type="text"
              name="bodyClasses"
              value={bodyClasses}
              onChange={(e) => setBodyClasses(e.target.value)}
              placeholder="class-a class-b"
            />
          </label>
          <label className="settings-field">
            <span>Tag Attributes</span>
            <input
              type="text"
              name="bodyTagAttributes"
              value={bodyTagAttributes}
              onChange={(e) => setBodyTagAttributes(e.target.value)}
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
              <textarea
                name="afterBodyHtml"
                rows={4}
                value={afterBodyHtml}
                onChange={(e) => setAfterBodyHtml(e.target.value)}
                placeholder="HTML after opening body tag"
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
              <textarea
                name="beforeBodyCloseHtml"
                rows={4}
                value={beforeBodyCloseHtml}
                onChange={(e) => setBeforeBodyCloseHtml(e.target.value)}
                placeholder="HTML before closing body tag"
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
              onChange={(e) => setFaEnabled(e.target.checked)}
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
              onChange={(e) => setFaV4Compat(e.target.checked)}
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
              onChange={(e) => setFaContentCompat(e.target.checked)}
            />
            <span>
              <strong>Content Compatibility</strong>
              <span className="settings-flag-desc">Reserved flag for content-side FA helpers.</span>
            </span>
          </label>
          <label className="settings-field">
            <span>Version</span>
            <select name="faVersion" value={faVersion} onChange={(e) => setFaVersion(e.target.value)}>
              <option value="6-free">Font Awesome 6 Free</option>
              <option value="7-free">Font Awesome 7 Free</option>
            </select>
          </label>
          <div className={lockedScripts ? 'page-settings-locked' : undefined}>
            <label className="settings-field">
              <span>
                CSS Link HTML <span className="page-settings-acl">Developer-admin</span>
              </span>
              <textarea
                name={lockedScripts ? undefined : 'faCssLinkHtml'}
                rows={2}
                value={faCssLinkHtml}
                disabled={lockedScripts}
                onChange={(e) => setFaCssLinkHtml(e.target.value)}
                placeholder="Optional raw <link> override"
              />
            </label>
            <label className="settings-field">
              <span>
                JS Script HTML <span className="page-settings-acl">Developer-admin</span>
              </span>
              <textarea
                name={lockedScripts ? undefined : 'faJsScriptHtml'}
                rows={2}
                value={faJsScriptHtml}
                disabled={lockedScripts}
                onChange={(e) => setFaJsScriptHtml(e.target.value)}
                placeholder="Optional raw <script> override"
              />
            </label>
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
                      onChange={(e) =>
                        setAtoms((prev) =>
                          prev.map((a) => (a.id === atom.id ? { ...a, enabled: e.target.checked } : a)),
                        )
                      }
                    />
                    <strong>{def?.label || atom.type}</strong>
                  </label>
                  <code>{atom.type}</code>
                  <AtomSettingsPopover title={def?.label || atom.type}>
                    {atom.type === 'custom-css-js' ? (
                      <div className="gantry-typed-form">
                        <label>
                          CSS
                          <textarea
                            rows={5}
                            value={String(atom.config.css ?? '')}
                            disabled={lockedScripts}
                            onChange={(e) =>
                              updateAtomConfig(atom.id, { ...atom.config, css: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          JavaScript <span className="page-settings-acl">Developer-admin</span>
                          <textarea
                            rows={5}
                            value={String(atom.config.javascript ?? '')}
                            disabled={lockedScripts}
                            onChange={(e) =>
                              updateAtomConfig(atom.id, {
                                ...atom.config,
                                javascript: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : atom.type === 'analytics' ? (
                      <div className="gantry-typed-form">
                        <label>
                          Provider
                          <select
                            value={String(atom.config.provider ?? 'google')}
                            disabled={lockedScripts}
                            onChange={(e) =>
                              updateAtomConfig(atom.id, {
                                ...atom.config,
                                provider: e.target.value,
                              })
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
                    onClick={() => setAtoms((prev) => prev.filter((a) => a.id !== atom.id))}
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

        <div className="page-settings-actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Saving…' : isPage ? 'Save page override' : 'Save site defaults'}
          </button>
        </div>
      </form>

      {isPage && bootstrap.hasOverride ? (
        <form action={clearAction} className="page-settings-clear">
          <input type="hidden" name="pageKey" value={bootstrap.editingPageKey ?? ''} />
          <button type="submit" className="danger" disabled={clearPending}>
            {clearPending ? 'Clearing…' : 'Clear override (inherit site defaults)'}
          </button>
        </form>
      ) : null}
    </div>
  )
}

