'use client'

import React, { useActionState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createFormDefinitionAction,
  deleteFormDefinitionAction,
  duplicateFormDefinitionAction,
  type FormAdminActionState,
} from '@/modules/forms/actions'
import {
  FORM_CATEGORY_LABELS,
  FORM_CATEGORY_ORDER,
  categoryForPreset,
  isProtectedFormDefinitionId,
  listFormPresetMetas,
  listFormPresetsByCategory,
} from '@/modules/forms/presets'
import type { FormPresetCategoryId } from '@/modules/forms/presets'
import type { FormPresetId } from '@/modules/forms/types'

import { useNotifySavedOnOk } from '../admin-toast'

type FormRow = {
  id: string
  label: string
  preset: FormPresetId
  fieldCount: number
  updatedAt: string
}

type CategoryFilter = FormPresetCategoryId | 'all'

type Props = {
  forms: FormRow[]
  categoryFilter: CategoryFilter
}

const initial: FormAdminActionState = {}

function formsListHref(category: CategoryFilter): string {
  return category === 'all'
    ? '/admin/forms'
    : `/admin/forms?category=${encodeURIComponent(category)}`
}

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
            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
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

export function FormsManager({ forms, categoryFilter }: Props) {
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

  const countsByCategory = useMemo(() => {
    const counts = new Map<FormPresetCategoryId, number>()
    for (const category of FORM_CATEGORY_ORDER) {
      counts.set(category, 0)
    }
    for (const form of forms) {
      const category = categoryForPreset(form.preset)
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
    return counts
  }, [forms])

  const categoryTabs = useMemo(() => {
    const presetsWithCategory = new Set(
      listFormPresetsByCategory().map((group) => group.category),
    )
    return FORM_CATEGORY_ORDER.filter(
      (category) =>
        presetsWithCategory.has(category) || (countsByCategory.get(category) ?? 0) > 0,
    ).map((category) => ({
      category,
      label: FORM_CATEGORY_LABELS[category],
      count: countsByCategory.get(category) ?? 0,
    }))
  }, [countsByCategory])

  const visibleForms = useMemo(() => {
    if (categoryFilter === 'all') return forms
    return forms.filter((form) => categoryForPreset(form.preset) === categoryFilter)
  }, [forms, categoryFilter])

  const showCategoryColumn = categoryFilter === 'all'
  const emptyCategoryLabel =
    categoryFilter === 'all' ? 'forms' : FORM_CATEGORY_LABELS[categoryFilter]

  return (
    <div className="sf-forms-manager outlines-manager">
      <section className="outlines-create" aria-label="Filter forms">
        <h3>Category</h3>
        <div className="sf-forms-filters">
          <div className="sf-forms-filter-group" role="group" aria-label="Category">
            <Link
              href={formsListHref('all')}
              className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                categoryFilter === 'all' ? ' is-active' : ''
              }`}
              aria-current={categoryFilter === 'all' ? 'true' : undefined}
            >
              All ({forms.length})
            </Link>
            {categoryTabs.map((tab) => (
              <Link
                key={tab.category}
                href={formsListHref(tab.category)}
                className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                  categoryFilter === tab.category ? ' is-active' : ''
                }`}
                aria-current={categoryFilter === tab.category ? 'true' : undefined}
              >
                {tab.label} ({tab.count})
              </Link>
            ))}
          </div>
        </div>
      </section>

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

      <div className="outlines-table-wrap">
        {visibleForms.length === 0 ? (
          <p className="admin-empty">
            {forms.length === 0
              ? 'No form definitions yet. Create one from a preset (Contact ships ready).'
              : `No forms in ${emptyCategoryLabel}.`}
          </p>
        ) : (
          <table className="outlines-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                {showCategoryColumn ? <th scope="col">Category</th> : null}
                <th scope="col">Preset</th>
                <th scope="col">Fields</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleForms.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/admin/forms/${f.id}`} className="outlines-name-link">
                      {f.label}
                    </Link>
                    <div className="layout-muted">
                      <code>{f.id}</code>
                    </div>
                  </td>
                  {showCategoryColumn ? (
                    <td>{FORM_CATEGORY_LABELS[categoryForPreset(f.preset)]}</td>
                  ) : null}
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
        )}
      </div>
    </div>
  )
}
