'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import { LocaleInput } from '@/core/localization/LocaleInput'

import {
  createMarketplaceCategoryAction,
  deleteMarketplaceCategoryAction,
  updateMarketplaceCategoryAction,
  type MarketplaceAdminActionState,
} from '../actions'

type CategoryRow = {
  id: string
  title: string
  slug: string
  description: string
  parentId: string
  depth: number
  enabled: boolean
  sortOrder: number
  titleLocales: Record<string, string>
  descriptionLocales: Record<string, string>
  updatedAt: string
}

type Props = {
  categories: CategoryRow[]
  locales: ContentLocaleOption[]
}

function treeLabel(title: string, depth: number): string {
  if (depth <= 0) return title
  return `${'—'.repeat(depth)} ${title}`
}

/** Parent picker options; excludes self and descendants when editing. */
function parentPickerOptions(
  categories: CategoryRow[],
  exceptId?: string,
): Array<{ id: string; label: string }> {
  const blocked = new Set<string>()
  if (exceptId) {
    blocked.add(exceptId)
    const byParent = new Map<string, string[]>()
    for (const row of categories) {
      const key = row.parentId || ''
      const list = byParent.get(key) ?? []
      list.push(row.id)
      byParent.set(key, list)
    }
    const walk = (id: string) => {
      for (const child of byParent.get(id) ?? []) {
        blocked.add(child)
        walk(child)
      }
    }
    walk(exceptId)
  }
  return categories
    .filter((row) => !blocked.has(row.id))
    .map((row) => ({ id: row.id, label: treeLabel(row.title, row.depth) }))
}

const initial: MarketplaceAdminActionState = {}

function Feedback({ state }: { state: MarketplaceAdminActionState }) {
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

function CategoryFields({
  row,
  categories,
  locales,
  busy,
}: {
  row?: CategoryRow
  categories: CategoryRow[]
  locales: ContentLocaleOption[]
  busy: boolean
}) {
  const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? ''
  const [title, setTitle] = useState(row?.title ?? '')
  const [description, setDescription] = useState(row?.description ?? '')
  const [titleLocales, setTitleLocales] = useState<Record<string, string>>(
    row?.titleLocales ?? {},
  )
  const [descriptionLocales, setDescriptionLocales] = useState<Record<string, string>>(
    row?.descriptionLocales ?? {},
  )
  const [parentId, setParentId] = useState(row?.parentId ?? '')
  const [enabled, setEnabled] = useState(row?.enabled !== false)
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0))
  const parentOptions = parentPickerOptions(categories, row?.id)

  useEffect(() => {
    setTitle(row?.title ?? '')
    setDescription(row?.description ?? '')
    setTitleLocales(row?.titleLocales ?? {})
    setDescriptionLocales(row?.descriptionLocales ?? {})
    setParentId(row?.parentId ?? '')
    setEnabled(row?.enabled !== false)
    setSortOrder(String(row?.sortOrder ?? 0))
  }, [row])

  return (
    <div className="sf-events-form-mosaic">
      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Basics</legend>
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="titleLocales" value={JSON.stringify(titleLocales)} />
        <input
          type="hidden"
          name="descriptionLocales"
          value={JSON.stringify(descriptionLocales)}
        />
        <LocaleInput
          locales={locales}
          label="Title"
          requiredDefault
          values={{
            ...titleLocales,
            ...(defaultCode ? { [defaultCode]: title } : {}),
          }}
          onChange={(code, value) => {
            setTitleLocales((prev) => ({ ...prev, [code]: value }))
            if (code === defaultCode) setTitle(value)
          }}
        />
        <label className="settings-field">
          <span>Parent</span>
          <select
            name="parentId"
            value={parentId}
            disabled={busy}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">None (top level)</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">Choose a parent to nest this as a sub-category.</span>
        </label>
        <label className="settings-field">
          <span>Slug</span>
          <input
            type="text"
            name="slug"
            maxLength={120}
            defaultValue={row?.slug ?? ''}
            disabled={busy}
            autoComplete="off"
            placeholder="gear"
          />
          <span className="settings-hint">Leave blank to build it from the title.</span>
        </label>
        <LocaleInput
          locales={locales}
          label="Description"
          multiline
          rows={4}
          values={{
            ...descriptionLocales,
            ...(defaultCode ? { [defaultCode]: description } : {}),
          }}
          onChange={(code, value) => {
            setDescriptionLocales((prev) => ({ ...prev, [code]: value }))
            if (code === defaultCode) setDescription(value)
          }}
        />
        <p className="settings-hint">
          Other languages sync to{' '}
          <code>data/content-locales/{'{locale}'}/marketplace/{'{id}'}.json</code> and can also
          be edited under <Link href="/admin/localization">Localization</Link>.
        </p>
        <label className="settings-field">
          <span>Sort order</span>
          <input
            type="number"
            name="sortOrder"
            step={1}
            value={sortOrder}
            disabled={busy}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <label className="settings-field settings-flag">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enabled</span>
        </label>
        <input type="hidden" name="enabled" value={enabled ? '1' : '0'} />
      </fieldset>
    </div>
  )
}

export function CategoriesManager({ categories, locales }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createState, createAction, createPending] = useActionState(
    createMarketplaceCategoryAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateMarketplaceCategoryAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMarketplaceCategoryAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      if (createState.id) setEditingId(createState.id)
      router.refresh()
      return
    }
    if (updateState.ok || deleteState.ok) {
      if (deleteState.ok) setEditingId(null)
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const busy = createPending || updatePending || deletePending
  const editing = editingId ? categories.find((row) => row.id === editingId) : null

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="sf-events-categories-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add category">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-marketplace-categories-add-form"
            onClick={() => {
              if (createOpen) resetCreate()
              else {
                setEditingId(null)
                setCreateOpen(true)
              }
            }}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Site category tree for classifieds. Airsoft taxonomy is a Hero seed later.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-marketplace-categories-add-form"
            action={createAction}
            className="sf-events-add-inline-form"
          >
            <CategoryFields categories={categories} locales={locales} busy={busy} />
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
                onClick={resetCreate}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={createPending}
              >
                {createPending ? 'Adding…' : 'Save'}
              </button>
            </div>
            <Feedback state={createState} />
          </form>
        ) : null}
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      {categories.length === 0 ? (
        <section className="outlines-create">
          <h3>No categories yet</h3>
          <p className="admin-empty">
            Use <strong>Add +</strong> for a category name, parent, and enabled flag.
          </p>
        </section>
      ) : (
        <section className="outlines-create" aria-label="Categories list">
          <h3>Categories</h3>
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Enabled</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr
                    key={row.id}
                    className={editingId === row.id ? 'is-editing' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="sf-events-list-title sf-events-list-title-btn"
                        onClick={() => {
                          setCreateOpen(false)
                          setEditingId((id) => (id === row.id ? null : row.id))
                        }}
                      >
                        {treeLabel(row.title, row.depth)}
                      </button>
                    </td>
                    <td>
                      <code>{row.slug || '—'}</code>
                    </td>
                    <td>{row.enabled ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          onClick={() => {
                            setCreateOpen(false)
                            setEditingId((id) => (id === row.id ? null : row.id))
                          }}
                        >
                          {editingId === row.id ? 'Close' : 'Edit'}
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                            disabled={busy}
                            onClick={(e) => {
                              if (
                                !window.confirm(
                                  `Delete category “${row.title}”? Child categories become top level.`,
                                )
                              ) {
                                e.preventDefault()
                              }
                            }}
                          >
                            {deletePending ? '…' : 'Delete'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <section
          className="outlines-create sf-events-inline-editor"
          aria-label={`Edit category ${editing.title}`}
        >
          <h3>Edit · {editing.title}</h3>
          <form
            key={`${editing.id}-${editing.updatedAt}`}
            id={`marketplace-category-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <CategoryFields
              row={editing}
              categories={categories}
              locales={locales}
              busy={busy}
            />
          </form>
          <div className="admin-action-row sf-events-form-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={`marketplace-category-edit-${editing.id}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {updatePending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
