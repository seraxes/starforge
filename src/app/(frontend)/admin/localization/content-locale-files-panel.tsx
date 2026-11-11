'use client'

import React, { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import {
  downloadContentLocaleFileAction,
  downloadContentLocaleZipAction,
  loadContentLocaleFileTextAction,
  migrateContentLocalesAction,
  saveContentLocaleFileAction,
  uploadContentLocaleFileAction,
  uploadContentLocaleZipAction,
  type ContentLocaleFilesActionState,
} from '@/core/i18n/content-locales/actions'
import type { ContentLocaleScope } from '@/core/i18n/content-locales/paths'

import { useNotifySavedOnOk } from '../admin-toast'

type FileOption = {
  scope: ContentLocaleScope
  ownerId: string
  relativePath: string
}

type Props = {
  locales: string[]
  filesByLocale: Record<string, FileOption[]>
  defaultLocale: string
}

const initialState: ContentLocaleFilesActionState = {}

function triggerDownload(filename: string, contents: BlobPart, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ContentLocaleFilesPanel({ locales, filesByLocale, defaultLocale }: Props) {
  const router = useRouter()
  const [locale, setLocale] = useState(locales[0] || defaultLocale || 'en')
  const fileOptions = filesByLocale[locale] ?? []
  const [fileKey, setFileKey] = useState(() =>
    fileOptions[0] ? `${fileOptions[0].scope}:${fileOptions[0].ownerId}` : 'layouts:default',
  )
  const selected = useMemo(() => {
    const [scope, ownerId] = fileKey.split(':')
    if (scope === 'layouts' || scope === 'nav') {
      return { scope, ownerId: ownerId || 'default' }
    }
    return { scope: 'layouts' as const, ownerId: 'default' }
  }, [fileKey])

  const [text, setText] = useState('{\n}\n')
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [pendingConfirm, setPendingConfirm] = useState<'upload-file' | 'upload-zip' | null>(null)
  const [uploadMode, setUploadMode] = useState<'replace' | 'merge'>('replace')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [busy, startTransition] = useTransition()

  const [saveState, saveAction, savePending] = useActionState(
    saveContentLocaleFileAction,
    initialState,
  )
  const [uploadFileState, uploadFileAction, uploadFilePending] = useActionState(
    uploadContentLocaleFileAction,
    initialState,
  )
  const [uploadZipState, uploadZipAction, uploadZipPending] = useActionState(
    uploadContentLocaleZipAction,
    initialState,
  )

  useNotifySavedOnOk(saveState, { toastErrors: true })
  useNotifySavedOnOk(uploadFileState, { toastErrors: true })
  useNotifySavedOnOk(uploadZipState, { toastErrors: true })

  useEffect(() => {
    if (saveState.ok || uploadFileState.ok || uploadZipState.ok) router.refresh()
  }, [saveState.ok, saveState.message, uploadFileState.ok, uploadFileState.message, uploadZipState.ok, uploadZipState.message, router])

  useEffect(() => {
    const options = filesByLocale[locale] ?? []
    if (options.length === 0) {
      setFileKey('layouts:default')
      return
    }
    if (!options.some((f) => `${f.scope}:${f.ownerId}` === fileKey)) {
      setFileKey(`${options[0]!.scope}:${options[0]!.ownerId}`)
    }
  }, [locale, filesByLocale, fileKey])

  useEffect(() => {
    let cancelled = false
    startTransition(async () => {
      const result = await loadContentLocaleFileTextAction(
        locale,
        selected.scope,
        selected.ownerId,
      )
      if (cancelled) return
      setText(result.text)
      setEditorEpoch((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [locale, selected.scope, selected.ownerId])

  useEffect(() => {
    if (saveState.text) {
      setText(saveState.text)
      setEditorEpoch((n) => n + 1)
    }
  }, [saveState.text, saveState.message])

  useEffect(() => {
    if (uploadFileState.text) {
      setText(uploadFileState.text)
      setEditorEpoch((n) => n + 1)
    }
  }, [uploadFileState.text, uploadFileState.message])

  const waiting = busy || savePending || uploadFilePending || uploadZipPending

  return (
    <div className="page-settings-panel sf-content-locale-files">
      <div className="page-settings-panel-head">
        <h3>Content locale files</h3>
      </div>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Layout and nav strings for translators. Keys encode belonging (do not rename them —
          only edit values). Files live under{' '}
          <code>data/content-locales/{'{locale}'}/layouts|nav/{'{id}'}.json</code>. LocaleInput
          in Layouts/Nav writes the same files; this editor is for bulk/CAT workflows. Missing
          keys fall back to the default locale when Localization fallback is on, then the entity
          scalar.
        </p>

        <div className="admin-inline-actions sf-content-locale-files-toolbar">
          <label className="settings-field">
            <span>Language</span>
            <select
              value={locale}
              disabled={waiting}
              onChange={(event) => setLocale(event.target.value)}
            >
              {locales.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>File</span>
            <select
              value={fileKey}
              disabled={waiting}
              onChange={(event) => setFileKey(event.target.value)}
            >
              {(fileOptions.length > 0
                ? fileOptions
                : [{ scope: 'layouts' as const, ownerId: 'default', relativePath: 'layouts/default.json' }]
              ).map((file) => (
                <option key={file.relativePath} value={`${file.scope}:${file.ownerId}`}>
                  {file.relativePath}
                </option>
              ))}
            </select>
          </label>
        </div>

        <CodeEditorField
          key={`${locale}-${fileKey}-${editorEpoch}`}
          label={`${locale}/${selected.scope}/${selected.ownerId}.json`}
          language="json"
          initialValue={text}
          initialHeight={280}
          onValueChange={setText}
        />

        <div className="admin-inline-actions sf-content-locale-files-actions">
          <button
            type="button"
            className="gantry-toolbar-btn"
            disabled={waiting}
            onClick={() => {
              startTransition(async () => {
                const result = await downloadContentLocaleFileAction(
                  locale,
                  selected.scope,
                  selected.ownerId,
                )
                if (result.error || !result.filename) return
                triggerDownload(result.filename, result.text, 'application/json')
              })
            }}
          >
            Download file
          </button>
          <button
            type="button"
            className="gantry-toolbar-btn"
            disabled={waiting}
            onClick={() => {
              startTransition(async () => {
                const result = await downloadContentLocaleZipAction(locale)
                if (result.error || !result.base64) return
                const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
                triggerDownload(result.filename, bytes, 'application/zip')
              })
            }}
          >
            Download locale zip
          </button>
          <label className="gantry-toolbar-btn">
            Upload file…
            <input
              type="file"
              accept="application/json,.json"
              hidden
              disabled={waiting}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                event.target.value = ''
                if (!file) return
                setPendingFile(file)
                setPendingConfirm('upload-file')
              }}
            />
          </label>
          <label className="gantry-toolbar-btn">
            Upload locale zip…
            <input
              type="file"
              accept="application/zip,.zip"
              hidden
              disabled={waiting}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                event.target.value = ''
                if (!file) return
                setPendingFile(file)
                setPendingConfirm('upload-zip')
              }}
            />
          </label>
          <button
            type="button"
            className="gantry-toolbar-btn"
            disabled={waiting}
            onClick={() => {
              startTransition(async () => {
                await migrateContentLocalesAction()
              })
            }}
          >
            Migrate embedded maps
          </button>
        </div>

        {pendingConfirm === 'upload-file' ? (
          <label className="settings-field settings-flag">
            <span>Merge into current file (off = replace)</span>
            <input
              type="checkbox"
              checked={uploadMode === 'merge'}
              onChange={(event) => setUploadMode(event.target.checked ? 'merge' : 'replace')}
            />
          </label>
        ) : null}

        <form action={saveAction} className="page-settings-actions">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="scope" value={selected.scope} />
          <input type="hidden" name="ownerId" value={selected.ownerId} />
          <input type="hidden" name="text" value={text} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={waiting}
          >
            Save file
          </button>
        </form>

        {saveState.error ? (
          <p className="admin-inline-error" role="alert">
            {saveState.error}
          </p>
        ) : null}
        {uploadFileState.error ? (
          <p className="admin-inline-error" role="alert">
            {uploadFileState.error}
          </p>
        ) : null}
        {uploadZipState.error ? (
          <p className="admin-inline-error" role="alert">
            {uploadZipState.error}
          </p>
        ) : null}
      </div>

      <AdminConfirmDialog
        open={pendingConfirm === 'upload-file'}
        title={uploadMode === 'merge' ? 'Merge locale file?' : 'Replace locale file?'}
        message={
          uploadMode === 'merge'
            ? `Merge keys from the upload into ${locale}/${selected.scope}/${selected.ownerId}.json?`
            : `Replace ${locale}/${selected.scope}/${selected.ownerId}.json with the uploaded JSON?`
        }
        confirmLabel={uploadMode === 'merge' ? 'Merge' : 'Replace'}
        cancelLabel="Cancel"
        danger={uploadMode === 'replace'}
        onCancel={() => {
          setPendingConfirm(null)
          setPendingFile(null)
        }}
        onConfirm={() => {
          if (!pendingFile) return
          const data = new FormData()
          data.set('locale', locale)
          data.set('scope', selected.scope)
          data.set('ownerId', selected.ownerId)
          data.set('mode', uploadMode)
          data.set('file', pendingFile)
          setPendingConfirm(null)
          setPendingFile(null)
          startTransition(() => {
            uploadFileAction(data)
          })
        }}
      />

      <AdminConfirmDialog
        open={pendingConfirm === 'upload-zip'}
        title="Upload locale zip?"
        message={`Unpack layouts/*.json and nav/*.json into data/content-locales/${locale}/? Existing matching files will be overwritten.`}
        confirmLabel="Upload"
        cancelLabel="Cancel"
        danger
        onCancel={() => {
          setPendingConfirm(null)
          setPendingFile(null)
        }}
        onConfirm={() => {
          if (!pendingFile) return
          const data = new FormData()
          data.set('locale', locale)
          data.set('file', pendingFile)
          setPendingConfirm(null)
          setPendingFile(null)
          startTransition(() => {
            uploadZipAction(data)
          })
        }}
      />
    </div>
  )
}
