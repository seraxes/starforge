'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createOnboardingDashboardTileAction,
  deleteOnboardingDashboardTileAction,
  updateOnboardingDashboardTileAction,
  type OnboardingAdminActionState,
} from '../actions'

const initial: OnboardingAdminActionState = {}

type StatusOption = { id: string; label: string }

export type DashboardTileRow = {
  id: string
  title: string
  icon: string
  url: string
  sortOrder: number
  published: boolean
  statusIds: string[]
  staffOnly: boolean
}

function Feedback({ state }: { state: OnboardingAdminActionState }) {
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

function StatusIdChecklist({
  name,
  label,
  hint,
  options,
  selected,
  pending,
  onChange,
}: {
  name: string
  label: string
  hint: string
  options: StatusOption[]
  selected: string[]
  pending: boolean
  onChange: (next: string[]) => void
}) {
  const selectedSet = new Set(selected)
  return (
    <fieldset className="settings-field" disabled={pending}>
      <legend>{label}</legend>
      <span className="settings-hint">{hint}</span>
      {options.length === 0 ? (
        <p className="settings-hint">No statuses yet. Add them under Statuses.</p>
      ) : (
        <ul
          className="admin-inline-actions"
          style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}
        >
          {options.map((opt) => {
            const checked = selectedSet.has(opt.id)
            return (
              <li key={opt.id} className="settings-field settings-flag">
                <label>
                  <input
                    type="checkbox"
                    name={name}
                    value={opt.id}
                    checked={checked}
                    disabled={pending}
                    onChange={() => {
                      if (checked) onChange(selected.filter((id) => id !== opt.id))
                      else onChange([...selected, opt.id])
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </fieldset>
  )
}

function TileFields({
  pending,
  statusOptions,
  title,
  icon,
  url,
  published,
  statusIds,
  staffOnly,
  onTitle,
  onIcon,
  onUrl,
  onPublished,
  onStatusIds,
  onStaffOnly,
}: {
  pending: boolean
  statusOptions: StatusOption[]
  title: string
  icon: string
  url: string
  published: boolean
  statusIds: string[]
  staffOnly: boolean
  onTitle: (next: string) => void
  onIcon: (next: string) => void
  onUrl: (next: string) => void
  onPublished: (next: boolean) => void
  onStatusIds: (next: string[]) => void
  onStaffOnly: (next: boolean) => void
}) {
  return (
    <>
      <label className="settings-field">
        <span>Title</span>
        <input
          name="title"
          value={title}
          required
          disabled={pending}
          onChange={(e) => onTitle(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Icon</span>
        <input
          name="icon"
          value={icon}
          disabled={pending}
          placeholder="calendar"
          onChange={(e) => onIcon(e.target.value)}
        />
        <span className="settings-hint">Short icon key or class name shown on the tile.</span>
      </label>
      <label className="settings-field">
        <span>URL</span>
        <input
          name="url"
          value={url}
          disabled={pending}
          placeholder="/exam"
          onChange={(e) => onUrl(e.target.value)}
        />
      </label>
      <StatusIdChecklist
        name="statusIds"
        label="Visible for statuses"
        hint="Empty = every person who has a status. Limit to one or more to hide on other statuses."
        options={statusOptions}
        selected={statusIds}
        pending={pending}
        onChange={onStatusIds}
      />
      <label className="settings-field settings-flag">
        <input
          type="checkbox"
          name="published"
          value="1"
          checked={published}
          disabled={pending}
          onChange={(e) => onPublished(e.target.checked)}
        />
        <span>Published</span>
      </label>
      <label className="settings-field settings-flag">
        <input
          type="checkbox"
          name="staffOnly"
          value="1"
          checked={staffOnly}
          disabled={pending}
          onChange={(e) => onStaffOnly(e.target.checked)}
        />
        <span>Staff only</span>
      </label>
    </>
  )
}

/** Dashboard tile list — Add / Edit / Delete. Status multi-select is controlled. */
export function DashboardTileManager({
  tiles,
  statusOptions,
}: {
  tiles: DashboardTileRow[]
  statusOptions: StatusOption[]
}) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createOnboardingDashboardTileAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateOnboardingDashboardTileAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingDashboardTileAction,
    initial,
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [url, setUrl] = useState('')
  const [published, setPublished] = useState(true)
  const [statusIds, setStatusIds] = useState<string[]>([])
  const [staffOnly, setStaffOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editPublished, setEditPublished] = useState(true)
  const [editStatusIds, setEditStatusIds] = useState<string[]>([])
  const [editStaffOnly, setEditStaffOnly] = useState(false)

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      setOpen(false)
      setTitle('')
      setIcon('')
      setUrl('')
      setPublished(true)
      setStatusIds([])
      setStaffOnly(false)
      setEditingId(null)
      router.refresh()
    }
  }, [createState.ok, updateState.ok, deleteState.ok, router])

  const busy = createPending || updatePending || deletePending

  return (
    <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
      <header className="page-settings-panel-head">
        <h3>Dashboard tiles</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Driver-home particle tiles. Empty status list shows for every status. Unpublished tiles
          are hidden. Staff-only tiles need Onboarding edit (or app admin).
        </p>

        <div className="outlines-create sf-events-add-panel">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={
                open
                  ? 'gantry-toolbar-btn gantry-toolbar-btn-muted'
                  : 'gantry-toolbar-btn gantry-toolbar-btn-save'
              }
              disabled={busy}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Close' : 'Add +'}
            </button>
          </div>
          {open ? (
            <form
              action={createAction}
              key={`create-tile-${createState.ok ? 'saved' : 'open'}-${statusIds.join(',')}`}
            >
              <TileFields
                pending={busy}
                statusOptions={statusOptions}
                title={title}
                icon={icon}
                url={url}
                published={published}
                statusIds={statusIds}
                staffOnly={staffOnly}
                onTitle={setTitle}
                onIcon={setIcon}
                onUrl={setUrl}
                onPublished={setPublished}
                onStatusIds={setStatusIds}
                onStaffOnly={setStaffOnly}
              />
              <Feedback state={createState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={busy}
                >
                  {createPending ? 'Saving…' : 'Create tile'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {tiles.length === 0 ? (
          <p className="settings-hint">No tiles yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
            {tiles.map((tile) => {
              const editing = editingId === tile.id
              return (
                <li
                  key={tile.id}
                  className="page-settings-panel"
                  style={{ marginBottom: '0.75rem' }}
                >
                  {editing ? (
                    <form
                      action={updateAction}
                      key={`edit-tile-${tile.id}-${tile.title}-${tile.published}-${tile.statusIds.join(',')}-${tile.staffOnly}`}
                    >
                      <input type="hidden" name="id" value={tile.id} />
                      <input type="hidden" name="sortOrder" value={String(tile.sortOrder)} />
                      <TileFields
                        pending={busy}
                        statusOptions={statusOptions}
                        title={editTitle}
                        icon={editIcon}
                        url={editUrl}
                        published={editPublished}
                        statusIds={editStatusIds}
                        staffOnly={editStaffOnly}
                        onTitle={setEditTitle}
                        onIcon={setEditIcon}
                        onUrl={setEditUrl}
                        onPublished={setEditPublished}
                        onStatusIds={setEditStatusIds}
                        onStaffOnly={setEditStaffOnly}
                      />
                      <Feedback state={updateState} />
                      <div className="page-settings-actions admin-action-row">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-save"
                          disabled={busy}
                        >
                          {updatePending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="page-settings-panel-body">
                        <strong>{tile.title}</strong>
                        <p className="settings-hint" style={{ margin: '0.25rem 0 0' }}>
                          {tile.url || '(no URL)'}
                          {tile.icon ? ` · icon ${tile.icon}` : ''}
                          {tile.published ? '' : ' · unpublished'}
                          {tile.staffOnly ? ' · staff only' : ''}
                          {tile.statusIds.length === 0
                            ? ' · all statuses'
                            : ` · ${tile.statusIds.length} status(es)`}
                        </p>
                      </div>
                      <div className="page-settings-actions admin-action-row">
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(tile.id)
                            setEditTitle(tile.title)
                            setEditIcon(tile.icon)
                            setEditUrl(tile.url)
                            setEditPublished(tile.published)
                            setEditStatusIds([...tile.statusIds])
                            setEditStaffOnly(tile.staffOnly)
                          }}
                        >
                          Edit
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={tile.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                      <Feedback state={deleteState} />
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
