'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createPageCategoryAction,
  deletePageCategoryAction,
  updatePageCategoryAction,
  type PagesAdminActionState,
} from '../actions'

type CategoryRow = {
  id: string
  title: string
  slug: string
  description: string
  sortOrder: number
  pageCount: number
  updatedAt: string
}

type Chrome = {
  add: string
  close: string
  cancel: string
  save: string
  saving: string
  adding: string
  edit: string
  delete: string
  deleting: string
  confirmDelete: string
  emptyHeading: string
  emptyLede: string
  listHeading: string
  colTitle: string
  colSlug: string
  colSort: string
  colPages: string
  colActions: string
  fieldTitle: string
  fieldSlug: string
  slugHint: string
  fieldDescription: string
  fieldSort: string
  addHint: string
  editHeading: string
}

type Props = {
  categories: CategoryRow[]
  chrome: Chrome
}

const initial: PagesAdminActionState = {}

function Feedback({ state }: { state: PagesAdminActionState }) {
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
  chrome,
  busy,
}: {
  row?: CategoryRow
  chrome: Chrome
  busy: boolean
}) {
  return (
    <div className="sf-pages-category-fields">
      <label className="settings-field">
        <span>{chrome.fieldTitle}</span>
        <input
          type="text"
          name="title"
          maxLength={120}
          defaultValue={row?.title ?? ''}
          required
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldSlug}</span>
        <input
          type="text"
          name="slug"
          maxLength={120}
          defaultValue={row?.slug ?? ''}
          disabled={busy}
          autoComplete="off"
          placeholder="guides"
        />
        <span className="settings-hint">{chrome.slugHint}</span>
      </label>
      <label className="settings-field">
        <span>{chrome.fieldDescription}</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={row?.description ?? ''}
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldSort}</span>
        <input
          type="number"
          name="sortOrder"
          step={1}
          defaultValue={row?.sortOrder ?? 0}
          disabled={busy}
        />
      </label>
    </div>
  )
}

export function PagesCategoriesManager({ categories, chrome }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createState, createAction, createPending] = useActionState(
    createPageCategoryAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updatePageCategoryAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePageCategoryAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
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
    <div className="sf-pages-categories-manager admin-settings-mosaic">
      <section className="outlines-create sf-pages-add-panel" aria-label={chrome.add}>
        <div className="sf-pages-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-pages-categories-add-form"
            onClick={() => {
              if (createOpen) resetCreate()
              else {
                setEditingId(null)
                setCreateOpen(true)
              }
            }}
          >
            {createOpen ? chrome.close : chrome.add}
          </button>
          {!createOpen ? <p className="settings-hint sf-pages-add-hint">{chrome.addHint}</p> : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-pages-categories-add-form"
            action={createAction}
            className="sf-pages-add-inline-form"
          >
            <CategoryFields chrome={chrome} busy={busy} />
            <div className="page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={createPending}
                onClick={resetCreate}
              >
                {chrome.cancel}
              </button>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={createPending}
              >
                {createPending ? chrome.adding : chrome.save}
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
          <h3>{chrome.emptyHeading}</h3>
          <p className="admin-empty">{chrome.emptyLede}</p>
        </section>
      ) : (
        <section className="outlines-create" aria-label={chrome.listHeading}>
          <h3>{chrome.listHeading}</h3>
          <div className="outlines-table-wrap">
            <table className="outlines-table">
              <thead>
                <tr>
                  <th scope="col">{chrome.colTitle}</th>
                  <th scope="col">{chrome.colSlug}</th>
                  <th scope="col">{chrome.colSort}</th>
                  <th scope="col">{chrome.colPages}</th>
                  <th scope="col">{chrome.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr key={row.id} className={editingId === row.id ? 'is-editing' : undefined}>
                    <td>
                      <button
                        type="button"
                        className="sf-pages-list-title-btn"
                        onClick={() => {
                          setCreateOpen(false)
                          setEditingId((id) => (id === row.id ? null : row.id))
                        }}
                      >
                        {row.title}
                      </button>
                    </td>
                    <td>
                      <code>{row.slug || '—'}</code>
                    </td>
                    <td>{row.sortOrder}</td>
                    <td>{row.pageCount}</td>
                    <td>
                      <div className="admin-action-row sf-pages-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          onClick={() => {
                            setCreateOpen(false)
                            setEditingId((id) => (id === row.id ? null : row.id))
                          }}
                        >
                          {editingId === row.id ? chrome.close : chrome.edit}
                        </button>
                        <form
                          action={deleteAction}
                          onSubmit={(event) => {
                            if (!window.confirm(chrome.confirmDelete.replace('{title}', row.title))) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                            disabled={busy}
                          >
                            {deletePending ? chrome.deleting : chrome.delete}
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
          className="outlines-create sf-pages-inline-editor"
          aria-label={`${chrome.editHeading} ${editing.title}`}
        >
          <h3>
            {chrome.editHeading} · {editing.title}
          </h3>
          <form
            key={`${editing.id}-${editing.updatedAt}`}
            id={`page-category-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <CategoryFields row={editing} chrome={chrome} busy={busy} />
          </form>
          <div className="admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={() => setEditingId(null)}
            >
              {chrome.cancel}
            </button>
            <button
              type="submit"
              form={`page-category-edit-${editing.id}`}
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {updatePending ? chrome.saving : chrome.save}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
