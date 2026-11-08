'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  setDefaultSkinAction,
  type SkinActionState,
} from '@/core/skin/actions'

export type SkinOutlineRow = {
  id: string
  label: string
  defaultForSite?: boolean
}

export type SkinRow = {
  id: string
  label: string
  colorScheme: 'light' | 'dark'
  isDefault: boolean
  isActive: boolean
  outlines: SkinOutlineRow[]
  preferredOutlineId?: string
}

type Props = {
  skins: SkinRow[]
  activeSkinId: string
  envPinned: boolean
  previewHref: string
}

const initial: SkinActionState = {}

function Feedback({ state }: { state: SkinActionState }) {
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

export function SkinsManager({ skins, activeSkinId, envPinned, previewHref }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(setDefaultSkinAction, initial)

  return (
    <div className="sf-skins-manager outlines-manager">
      {envPinned ? (
        <p className="admin-inline-error" role="status">
          Active skin is pinned by <code>STARFORGE_SKIN</code> ({activeSkinId}). Clear that env
          var to change the default here.
        </p>
      ) : null}

      <Feedback state={state} />

      <section className="outlines-create" aria-label="Set default skin">
        <h3>Site default</h3>
        <form
          action={action}
          className="outlines-create-form admin-create-form"
          onSubmit={() => setTimeout(() => router.refresh(), 50)}
        >
          <label className="settings-field">
            <span>Skin</span>
            <select
              name="skinId"
              defaultValue={skins.find((s) => s.isDefault)?.id ?? activeSkinId}
              disabled={envPinned || pending}
              required
            >
              {skins.map((skin) => (
                <option key={skin.id} value={skin.id}>
                  {skin.label} ({skin.id})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={envPinned || pending}
          >
            {pending ? 'Saving…' : 'Set as default'}
          </button>
        </form>
        <p className="admin-lede" style={{ marginTop: '0.75rem' }}>
          Sets brand tokens/CSS and installs this skin&apos;s outline seeds into Layouts. Existing
          outline edits are kept.
        </p>
      </section>

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Id</th>
              <th scope="col">Scheme</th>
              <th scope="col">Outlines</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {skins.map((skin) => (
              <tr key={skin.id} data-sf-skin-row={skin.id}>
                <td>
                  <strong>{skin.label}</strong>
                  {skin.isActive ? <span className="outlines-badge">Active</span> : null}
                  {skin.isDefault && !skin.isActive ? (
                    <span className="outlines-badge">Default</span>
                  ) : null}
                </td>
                <td>
                  <code>{skin.id}</code>
                </td>
                <td className="outlines-muted">{skin.colorScheme}</td>
                <td>
                  {skin.outlines.length === 0 ? (
                    <span className="outlines-muted">—</span>
                  ) : (
                    <ul className="sf-skins-outline-list">
                      {skin.outlines.map((outline) => (
                        <li key={outline.id}>
                          <Link
                            className="button-link"
                            href={`/admin/layouts?outline=${encodeURIComponent(outline.id)}`}
                          >
                            {outline.label}
                          </Link>
                          {outline.defaultForSite ||
                          outline.id === skin.preferredOutlineId ? (
                            <span className="outlines-badge">Site</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="outlines-actions">
                  <div className="outlines-actions">
                    {skin.isActive || envPinned ? null : (
                      <form
                        action={action}
                        onSubmit={() => setTimeout(() => router.refresh(), 50)}
                      >
                        <input type="hidden" name="skinId" value={skin.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-save"
                          disabled={pending}
                        >
                          Set default
                        </button>
                      </form>
                    )}
                    {skin.preferredOutlineId || skin.outlines[0]?.id ? (
                      <Link
                        className="gantry-toolbar-btn"
                        href={`/admin/layouts?outline=${encodeURIComponent(
                          skin.preferredOutlineId || skin.outlines[0]!.id,
                        )}`}
                      >
                        Open layout
                      </Link>
                    ) : null}
                    <a
                      className="gantry-toolbar-btn"
                      href={previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Preview
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
