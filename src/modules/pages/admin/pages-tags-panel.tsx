'use client'

import React, { useActionState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createPageTagAction,
  deletePageTagAction,
  renamePageTagAction,
  type PagesAdminActionState,
} from '../actions'

type TagRow = {
  id: string
  title: string
  pageCount: number
}

type Chrome = {
  tagsHeading: string
  tagsLede: string
  tagTitle: string
  tagAdd: string
  tagRename: string
  tagDelete: string
  tagConfirmDelete: string
  tagEmpty: string
}

const initial: PagesAdminActionState = {}

function TagRowForm({
  tag,
  chrome,
}: {
  tag: TagRow
  chrome: Chrome
}) {
  const router = useRouter()
  const [renameState, renameAction, renamePending] = useActionState(renamePageTagAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deletePageTagAction, initial)
  useNotifySavedOnOk(renameState, { successMessage: renameState.message })
  useNotifySavedOnOk(deleteState, { successMessage: deleteState.message })
  React.useEffect(() => {
    if (renameState.ok || deleteState.deleted) router.refresh()
  }, [renameState.ok, deleteState.deleted, router])

  return (
    <div className="admin-inline-actions">
      <form action={renameAction} className="admin-inline-actions">
        <input type="hidden" name="id" value={tag.id} />
        <label className="settings-field">
          <span>{chrome.tagTitle}</span>
          <input type="text" name="title" defaultValue={tag.title} maxLength={80} required />
        </label>
        <button className="gantry-toolbar-btn" type="submit" disabled={renamePending}>
          {chrome.tagRename}
        </button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm(chrome.tagConfirmDelete)) event.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={tag.id} />
        <button className="gantry-toolbar-btn" type="submit" disabled={deletePending}>
          {chrome.tagDelete}
          {tag.pageCount > 0 ? ` (${tag.pageCount})` : ''}
        </button>
      </form>
      {renameState.error ? (
        <p className="admin-inline-error" role="alert">
          {renameState.error}
        </p>
      ) : null}
      {deleteState.error ? (
        <p className="admin-inline-error" role="alert">
          {deleteState.error}
        </p>
      ) : null}
    </div>
  )
}

export function PagesTagsPanel({ tags, chrome }: { tags: TagRow[]; chrome: Chrome }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createPageTagAction, initial)
  useNotifySavedOnOk(state, { successMessage: state.message })
  React.useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <section className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h3>{chrome.tagsHeading}</h3>
      </div>
      <div className="page-settings-panel-body">
        <p className="settings-hint">{chrome.tagsLede}</p>
        <form action={action} className="admin-inline-actions">
          <label className="settings-field">
            <span>{chrome.tagTitle}</span>
            <input type="text" name="title" maxLength={80} required />
          </label>
          <button className="gantry-toolbar-btn" type="submit" disabled={pending}>
            {chrome.tagAdd}
          </button>
        </form>
        {state.error ? (
          <p className="admin-inline-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {tags.length === 0 ? (
          <p className="settings-hint">{chrome.tagEmpty}</p>
        ) : (
          tags.map((tag) => (
            <TagRowForm
              key={`${tag.id}-${tag.title}`}
              tag={tag}
              chrome={chrome}
            />
          ))
        )}
      </div>
    </section>
  )
}
