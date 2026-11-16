'use client'

import React, { useActionState, useEffect, useState } from 'react'
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
  tagCancel: string
  tagConfirmDelete: string
  tagEmpty: string
}

const initial: PagesAdminActionState = {}

function TagEditForm({
  tag,
  chrome,
  onClose,
}: {
  tag: TagRow
  chrome: Chrome
  onClose: () => void
}) {
  const router = useRouter()
  const [renameState, renameAction, renamePending] = useActionState(renamePageTagAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deletePageTagAction, initial)
  useNotifySavedOnOk(renameState, { successMessage: renameState.message })
  useNotifySavedOnOk(deleteState, { successMessage: deleteState.message })
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!renameState.ok && !deleteState.deleted) return
    onCloseRef.current()
    router.refresh()
  }, [renameState.ok, deleteState.deleted, router])

  const busy = renamePending || deletePending

  return (
    <div className="sf-media-tag-create">
      <form action={renameAction} className="sf-media-tag-create">
        <input type="hidden" name="id" value={tag.id} />
        <label className="settings-field">
          <span>{chrome.tagTitle}</span>
          <input
            type="text"
            name="title"
            defaultValue={tag.title}
            maxLength={80}
            required
            disabled={busy}
            autoComplete="off"
            autoFocus
          />
        </label>
        <button className="gantry-toolbar-btn" type="submit" disabled={busy}>
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
        <button className="gantry-toolbar-btn" type="submit" disabled={busy}>
          {chrome.tagDelete}
          {tag.pageCount > 0 ? ` (${tag.pageCount})` : ''}
        </button>
      </form>
      <button
        type="button"
        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
        disabled={busy}
        onClick={onClose}
      >
        {chrome.tagCancel}
      </button>
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
  const [editingId, setEditingId] = useState<string | null>(null)
  useNotifySavedOnOk(state, { successMessage: state.message })
  useEffect(() => {
    if (state.ok) {
      setEditingId(null)
      router.refresh()
    }
  }, [state.ok, router])

  const editing = editingId ? tags.find((tag) => tag.id === editingId) : null

  return (
    <section className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h3>{chrome.tagsHeading}</h3>
      </div>
      <div className="page-settings-panel-body">
        <p className="settings-hint">{chrome.tagsLede}</p>
        <form action={action} className="sf-media-tag-create">
          <label className="settings-field">
            <span>{chrome.tagTitle}</span>
            <input type="text" name="title" maxLength={80} required disabled={pending} />
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
          <div className="sf-media-library-chips" role="list">
            {tags.map((tag) => {
              const active = editingId === tag.id
              return (
                <button
                  key={tag.id}
                  type="button"
                  role="listitem"
                  className={`sf-media-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  title={
                    tag.pageCount > 0
                      ? `${tag.title} (${tag.pageCount})`
                      : tag.title
                  }
                  onClick={() => setEditingId(active ? null : tag.id)}
                >
                  {tag.title}
                </button>
              )
            })}
          </div>
        )}
        {editing ? (
          <TagEditForm
            key={editing.id}
            tag={editing}
            chrome={chrome}
            onClose={() => setEditingId(null)}
          />
        ) : null}
      </div>
    </section>
  )
}
