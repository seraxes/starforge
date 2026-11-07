'use client'

import React, { useActionState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createFormDefinitionAction,
  deleteFormDefinitionAction,
  duplicateFormDefinitionAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import {
  FORM_CATEGORY_LABELS,
  FORM_CATEGORY_ORDER,
  categoryForPreset,
  isProtectedFormDefinitionId,
  listFormPresetMetas,
  listFormPresetsByCategory,
} from '@/core/forms/presets'
import type { FormPresetCategoryId } from '@/core/forms/presets'
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
  return listFormPresetMetas().find((p) => p.id === id)?.label ?? id
}

type RowActionsProps = {
  form: FormRow
  dupAction: (payload: FormData) => void
  dupPending: boolean
  deleteAction: (payload: FormData) => void
  deletePending: boolean
}

function FormRowActions({
  form,
  dupAction,
  dupPending,
  deleteAction,
  deletePending,
}: RowActionsProps) {
  const protectedForm = isProtectedFormDefinitionId(form.id)
  return (
    <td className="outlines-actions">
      <a
        href={`/api/admin/forms/export?definitionId=${encodeURIComponent(form.id)}`}
        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
      >
        Export CSV
      </a>
      <Link
        href={`/admin/forms/submissions?definitionId=${encodeURIComponent(form.id)}`}
        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
      >
        Submissions
      </Link>
      <form action={dupAction} className="admin-inline-form">
        <input type="hidden" name="formId" value={form.id} />
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={dupPending}
        >
          Duplicate
        </button>
      </form>
      {protectedForm ? null : (
        <form action={deleteAction} className="admin-inline-form">
          <input type="hidden" name="formId" value={form.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn danger"
            disabled={deletePending}
            onClick={(e) => {
              if (!confirm(`Delete form “${form.label}”?`)) e.preventDefault()
            }}
          >
            Delete
          </button>
        </form>
      )}
    </td>
  )
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

  const formsByCategory = useMemo(() => {
    const buckets = new Map<FormPresetCategoryId, FormRow[]>()
    for (const category of FORM_CATEGORY_ORDER) {
      buckets.set(category, [])
    }
    for (const form of forms) {
      const category = categoryForPreset(form.preset)
      const list = buckets.get(category) ?? []
      list.push(form)
      buckets.set(category, list)
    }
    return FORM_CATEGORY_ORDER.map((category) => ({
      category,
      label: FORM_CATEGORY_LABELS[category],
      forms: buckets.get(category) ?? [],
    })).filter((group) => group.forms.length > 0)
  }, [forms])

  return (
    <div className="sf-forms-manager admin-settings-mosaic">
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
              {listFormPresetsByCategory().map((group) => (
                <optgroup key={group.category} label={group.label}>
                  {group.presets.map((p) => (
                    <option key={p.id} value={p.id} title={p.description}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
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

      {forms.length === 0 ? (
        <div className="outlines-table-wrap admin-settings-panel-wide">
          <p className="admin-empty">
            No form definitions yet. Create one from a preset (Contact ships ready).
          </p>
        </div>
      ) : (
        formsByCategory.map((group) => (
          <div
            key={group.category}
            className="sf-forms-category-section outlines-table-wrap admin-settings-panel-wide"
          >
            <h3 className="admin-settings-panel-title">{group.label}</h3>
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
                {group.forms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/forms/${f.id}`} className="outlines-name-link">
                        {f.label}
                      </Link>
                      <div className="layout-muted">
                        <code>{f.id}</code>
                      </div>
                    </td>
                    <td>{presetLabel(f.preset)}</td>
                    <td>{f.fieldCount}</td>
                    <td>{formatUpdated(f.updatedAt)}</td>
                    <FormRowActions
                      form={f}
                      dupAction={dupAction}
                      dupPending={dupPending}
                      deleteAction={deleteAction}
                      deletePending={deletePending}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
