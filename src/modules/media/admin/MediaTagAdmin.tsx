'use client'

import React, { useState } from 'react'

import type { MediaTagOption } from '@/core/media/resolve'

import type { MediaLibraryChrome } from './media-chrome'

type Props = {
  tags: MediaTagOption[]
  chrome: MediaLibraryChrome
  busy?: boolean
  error?: string | null
  onCreate: (title: string) => void
  onRename: (input: { id: string; title: string }) => void
}

/** Tag create / rename for `/admin/media`. Slug stays stable on rename. */
export function MediaTagAdmin({ tags, chrome, busy, error, onCreate, onRename }: Props) {
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <section className="sf-media-tag-admin" aria-label={chrome.tagsHeading}>
      <h3 className="admin-settings-panel-title">{chrome.tagsHeading}</h3>
      <form
        className="sf-media-tag-create"
        onSubmit={(e) => {
          e.preventDefault()
          const next = title.trim()
          if (!next || busy) return
          onCreate(next)
          setTitle('')
        }}
      >
        <label className="settings-field">
          <span>{chrome.tagTitle}</span>
          <input
            type="text"
            value={title}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button type="submit" className="gantry-toolbar-btn" disabled={busy || !title.trim()}>
          {chrome.tagCreate}
        </button>
      </form>

      {tags.length === 0 ? <p className="layout-muted">{chrome.tagEmpty}</p> : null}

      {tags.length ? (
        <ul className="sf-media-tag-list">
          {tags.map((tag) => {
            const editing = editingId === tag.id
            return (
              <li key={tag.id} className="sf-media-tag-row">
                {editing ? (
                  <form
                    className="sf-media-tag-create"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const next = draft.trim()
                      if (!next || busy) return
                      onRename({ id: tag.id, title: next })
                      setEditingId(null)
                    }}
                  >
                    <label className="settings-field">
                      <span className="visually-hidden">{chrome.tagTitle}</span>
                      <input
                        type="text"
                        value={draft}
                        disabled={busy}
                        autoComplete="off"
                        onChange={(e) => setDraft(e.target.value)}
                      />
                    </label>
                    <button
                      type="submit"
                      className="gantry-toolbar-btn"
                      disabled={busy || !draft.trim()}
                    >
                      {chrome.tagSave}
                    </button>
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                    >
                      {chrome.tagCancel}
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="sf-media-tag-name">
                      {tag.title}
                      {tag.slug ? <span className="layout-muted"> {tag.slug}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(tag.id)
                        setDraft(tag.title)
                      }}
                    >
                      {chrome.tagRename}
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
