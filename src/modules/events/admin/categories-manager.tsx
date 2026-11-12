'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import { LocaleInput } from '@/core/localization/LocaleInput'

import {
  createEventCategoryAction,
  deleteEventCategoryAction,
  updateEventCategoryAction,
  type EventsAdminActionState,
} from '../actions'

type CategoryRow = {
  id: string
  title: string
  slug: string
  description: string
  registrationFormId: string
  published: boolean
  sortOrder: number
  accessTags: string[]
  titleLocales: Record<string, string>
  descriptionLocales: Record<string, string>
  updatedAt: string
}

type FormOpt = { id: string; label: string }

type Props = {
  categories: CategoryRow[]
  forms: FormOpt[]
  groups: UserGroupOption[]
  locales: ContentLocaleOption[]
}

const initial: EventsAdminActionState = {}

function Feedback({ state }: { state: EventsAdminActionState }) {
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
  forms,
  groups,
  locales,
  busy,
}: {
  row?: CategoryRow
  forms: FormOpt[]
  groups: UserGroupOption[]
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
  const [published, setPublished] = useState(row?.published !== false)
  const [accessTags, setAccessTags] = useState(
    row?.accessTags?.length ? row.accessTags : ['public'],
  )

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
          <span>Slug</span>
          <input
            type="text"
            name="slug"
            maxLength={120}
            defaultValue={row?.slug ?? ''}
            disabled={busy}
            autoComplete="off"
            placeholder="workshops"
          />
          <span className="settings-hint">
            Public filter key (`?category=`). Leave blank to build it from the title.
          </span>
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
          <code>data/content-locales/{'{locale}'}/events/{'{id}'}.json</code> and can also be
          edited under <Link href="/admin/localization">Localization</Link>.
        </p>
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Registration</legend>
        <label className="settings-field">
          <span>Registration form</span>
          <select
            name="registrationFormId"
            defaultValue={row?.registrationFormId ?? ''}
            disabled={busy}
          >
            <option value="">Default event registration</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Events in this category use this form unless the event picks another. Fields stay
            in <Link href="/admin/forms">Forms</Link>.
          </span>
        </label>
        <label className="settings-field">
          <span>Sort order</span>
          <input
            type="number"
            name="sortOrder"
            step={1}
            defaultValue={row?.sortOrder ?? 0}
            disabled={busy}
          />
        </label>
        <label className="settings-field settings-flag">
          <input
            type="checkbox"
            checked={published}
            disabled={busy}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>Published on the public hub</span>
        </label>
        <input type="hidden" name="published" value={published ? '1' : '0'} />
      </fieldset>

      <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
        <legend>Access</legend>
        <p className="settings-hint">
          Who can see this category and its events on the public hub. An event still has its
          own viewing tags. Featured is a separate carousel flag, not a category.
        </p>
        <AccessTagsField
          value={accessTags}
          groups={groups}
          disabled={busy}
          legend="Who can see"
          onChange={setAccessTags}
        />
        <input type="hidden" name="accessTagsJson" value={JSON.stringify(accessTags)} />
      </fieldset>
    </div>
  )
}

export function CategoriesManager({ categories, forms, groups, locales }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createState, createAction, createPending] = useActionState(
    createEventCategoryAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateEventCategoryAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEventCategoryAction,
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
    <div className="sf-events-categories-manager admin-settings-mosaic">
      <section className="outlines-create sf-events-add-panel" aria-label="Add category">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-categories-add-form"
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
              Labels for the public hub filter. Not the Featured carousel flag.
            </p>
          ) : null}
        </div>

        {createOpen ? (
          <form
            key={formKey}
            id="sf-categories-add-form"
            action={createAction}
            className="sf-events-add-inline-form"
          >
            <CategoryFields forms={forms} groups={groups} locales={locales} busy={busy} />
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
            Use <strong>Add +</strong> for a public filter label, its ACL, and the registration
            form events in it use.
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
                  <th scope="col">Form</th>
                  <th scope="col">Published</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => {
                  const formLabel =
                    forms.find((form) => form.id === row.registrationFormId)?.label ||
                    'Default'
                  return (
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
                          {row.title}
                        </button>
                      </td>
                      <td>
                        <code>{row.slug || '—'}</code>
                      </td>
                      <td>{formLabel}</td>
                      <td>{row.published ? 'Yes' : 'No'}</td>
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
                                    `Delete category “${row.title}”? Events keep their data and become uncategorized.`,
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
                  )
                })}
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
            id={`category-edit-${editing.id}`}
            action={updateAction}
          >
            <input type="hidden" name="id" value={editing.id} />
            <CategoryFields
              row={editing}
              forms={forms}
              groups={groups}
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
              form={`category-edit-${editing.id}`}
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
