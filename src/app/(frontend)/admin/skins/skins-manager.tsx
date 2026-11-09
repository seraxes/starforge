'use client'

import React, { useActionState, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  setDefaultSkinAction,
  uploadSkinPackAction,
  type SkinActionState,
  type SkinUploadActionState,
} from '@/core/skin/actions'

export type SkinRow = {
  id: string
  label: string
  colorScheme: 'light' | 'dark'
  isDefault: boolean
  isActive: boolean
  source?: 'bundled' | 'installed'
}

type Props = {
  skins: SkinRow[]
  activeSkinId: string
  envPinned: boolean
  previewHref: string
}

const initial: SkinActionState = {}
const uploadInitial: SkinUploadActionState = {}

function Feedback({
  state,
}: {
  state: SkinActionState | SkinUploadActionState
}) {
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

/** Same chrome as Media upload: hidden native input + gantry Choose button. */
function SkinPackFileField({ disabled }: { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)

  function applyFiles(files: FileList | null) {
    const input = inputRef.current
    if (!input || !files?.length) {
      setFileName('')
      return
    }
    const dt = new DataTransfer()
    dt.items.add(files[0]!)
    input.files = dt.files
    setFileName(files[0]!.name)
  }

  return (
    <div
      className={[
        'sf-media-file-field',
        dragging ? 'is-dragging' : '',
        fileName ? 'has-file' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
        if (disabled) return
        applyFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name="pack"
        accept=".zip,application/zip"
        required
        disabled={disabled}
        className="sf-media-file-field-input"
        onChange={(e) => applyFiles(e.target.files)}
      />
      <div className="sf-media-file-field-body">
        <p className="sf-media-file-field-title">
          {fileName ? fileName : 'Drop a skin pack here, or choose a file'}
        </p>
        <p className="sf-media-file-field-hint settings-hint">
          Zip with <code>skin.yaml</code>, <code>outlines/*.yaml</code>, optional{' '}
          <code>skin.css</code>.
        </p>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {fileName ? 'Change pack…' : 'Choose pack…'}
        </button>
      </div>
    </div>
  )
}

export function SkinsManager({ skins, activeSkinId, envPinned, previewHref }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(setDefaultSkinAction, initial)
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadSkinPackAction,
    uploadInitial,
  )

  return (
    <div className="sf-skins-manager outlines-manager">
      {envPinned ? (
        <p className="admin-inline-error" role="status">
          Active skin is pinned by <code>STARFORGE_SKIN</code> ({activeSkinId}). Clear that env
          var to change the default here.
        </p>
      ) : null}

      <Feedback state={state} />
      <Feedback state={uploadState} />

      <section className="outlines-create" aria-label="Upload skin pack">
        <h3>Install skin pack</h3>
        <form
          action={uploadAction}
          className="outlines-create-form admin-create-form"
          encType="multipart/form-data"
          onSubmit={() => setTimeout(() => router.refresh(), 80)}
        >
          <div className="settings-field">
            <span>Pack zip</span>
            <SkinPackFileField disabled={uploadPending} />
          </div>
          <p className="settings-hint">
            Installed under <code>data/skins/</code>.
          </p>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={uploadPending}
            >
              {uploadPending ? 'Installing…' : 'Upload & install'}
            </button>
          </div>
        </form>
      </section>

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
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={envPinned || pending}
            >
              {pending ? 'Saving…' : 'Set as default'}
            </button>
          </div>
        </form>
        <p className="settings-hint" style={{ marginTop: '0.75rem' }}>
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
              <th scope="col">Source</th>
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
                <td className="outlines-muted">
                  {skin.source === 'installed' ? 'Installed' : 'Bundled'}
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
                    <a
                      className="gantry-toolbar-btn"
                      href={`/api/admin/skins/download?id=${encodeURIComponent(skin.id)}`}
                    >
                      Download
                    </a>
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
