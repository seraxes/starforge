'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createFormDefinitionAction,
  deleteFormDefinitionAction,
  duplicateFormDefinitionAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import { FORM_PRESETS } from '@/core/forms/presets'
import type { FormPresetId } from '@/core/forms/types'

import { useNotifySavedOnOk } from '../admin-toast'

type FormRow = {
  id: string
  label: string
  preset: FormPresetId
  fieldCount: number
  updatedAt: string
}

type Props = {
  forms: FormRow[]
}

const initial: FormAdminActionState = {}

function Feedback({ state }: { state: FormAdminActionState }) {
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

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

function presetLabel(id: FormPresetId): string {
  return FORM_PRESETS.find((p) => p.id === id)?.label ?? id
}

export function FormsManager({ forms }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createFormDefinitionAction,
    initial,
  )
  const [dupState, dupAction, dupPending] = useActionState(
    duplicateFormDefinitionAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFormDefinitionAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(dupState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok && createState.formId) {
      router.refresh()
    }
    if (dupState.ok) router.refresh()
    if (deleteState.ok) router.refresh()
  }, [createState, dupState, deleteState, router])

  return (
    <div className="sf-forms-manager">
      <section className="outlines-create" aria-label="Create form">
        <h3>Create form</h3>
        <form action={createAction} className="outlines-create-form admin-create-form">
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="label" placeholder="e.g. Contact" required maxLength={80} />
          </label>
          <label className="settings-field">
            <span>Id (optional)</span>
            <input type="text" name="id" placeholder="auto from name" maxLength={64} />
          </label>
          <label className="settings-field">
            <span>Preset</span>
            <select name="preset" defaultValue="contact">
              {FORM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.stub ? ' (stub)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Copy from</span>
            <select name="copyFromId" defaultValue="">
              <option value="">Preset fields only</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.id})
                </option>
              ))}
            </select>
          </label>
          <label className="outlines-check">
            <input type="checkbox" name="openAfter" value="1" defaultChecked />
            <span>Open builder after create</span>
          </label>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={createPending}
          >
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={dupState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Preset</th>
              <th scope="col">Fields</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  No form definitions yet. Create one from a preset (Contact ships ready).
                </td>
              </tr>
            ) : (
              forms.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/app/admin/forms/${f.id}`} className="outlines-name-link">
                      {f.label}
                    </Link>
                    <div className="layout-muted">
                      <code>{f.id}</code>
                    </div>
                  </td>
                  <td>{presetLabel(f.preset)}</td>
                  <td>{f.fieldCount}</td>
                  <td>{formatUpdated(f.updatedAt)}</td>
                  <td className="outlines-actions">
                    <Link
                      href={`/app/admin/forms/${f.id}`}
                      className="gantry-toolbar-btn secondary"
                    >
                      Edit
                    </Link>
                    <form action={dupAction} className="outlines-inline-form">
                      <input type="hidden" name="formId" value={f.id} />
                      <button
                        type="submit"
                        className="gantry-toolbar-btn secondary"
                        disabled={dupPending}
                      >
                        Duplicate
                      </button>
                    </form>
                    {f.id !== 'contact' ? (
                      <form action={deleteAction} className="outlines-inline-form">
                        <input type="hidden" name="formId" value={f.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn danger"
                          disabled={deletePending}
                          onClick={(e) => {
                            if (!confirm(`Delete form “${f.label}”?`)) e.preventDefault()
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
