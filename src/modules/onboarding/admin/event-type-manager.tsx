'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createOnboardingEventTypeAction,
  deleteOnboardingEventTypeAction,
  setOnboardingEventTypeEnabledAction,
  updateOnboardingEventTypeAction,
  type OnboardingAdminActionState,
} from '../actions'
import { EmailTemplateEditLink } from './email-template-edit-dialog'

const initial: OnboardingAdminActionState = {}

type TemplateOption = { id: string; label: string }
type FormOption = { id: string; label: string }
type StatusOption = { id: string; label: string }

export type EventTypeRow = {
  id: string
  key: string
  label: string
  enabled: boolean
  templateId: string
  formDefinitionId: string
  dateFieldNames: string[]
  activeStatusIds: string[]
  completedStatusIds: string[]
  sortOrder: number
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

function withCurrentOption(options: TemplateOption[], currentId: string): TemplateOption[] {
  const id = currentId.trim()
  if (!id) return options
  if (options.some((opt) => opt.id === id)) return options
  return [...options, { id, label: `${id} (missing)` }]
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
        <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
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

function EventTypeFields({
  pending,
  templateOptions,
  formOptions,
  statusOptions,
  label,
  typeKey,
  templateId,
  formDefinitionId,
  dateFieldNames,
  activeStatusIds,
  completedStatusIds,
  onLabel,
  onKey,
  onTemplateId,
  onFormDefinitionId,
  onDateFieldNames,
  onActiveStatusIds,
  onCompletedStatusIds,
  lockKey,
}: {
  pending: boolean
  templateOptions: TemplateOption[]
  formOptions: FormOption[]
  statusOptions: StatusOption[]
  label: string
  typeKey: string
  templateId: string
  formDefinitionId: string
  dateFieldNames: string
  activeStatusIds: string[]
  completedStatusIds: string[]
  onLabel: (next: string) => void
  onKey: (next: string) => void
  onTemplateId: (next: string) => void
  onFormDefinitionId: (next: string) => void
  onDateFieldNames: (next: string) => void
  onActiveStatusIds: (next: string[]) => void
  onCompletedStatusIds: (next: string[]) => void
  lockKey?: boolean
}) {
  const templateChoices = withCurrentOption(templateOptions, templateId)
  const formChoices = withCurrentOption(formOptions, formDefinitionId)
  return (
    <>
      <label className="settings-field">
        <span>Label</span>
        <input
          name="label"
          value={label}
          required
          disabled={pending}
          onChange={(e) => onLabel(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Key</span>
        <input
          name="key"
          value={typeKey}
          required={!lockKey}
          readOnly={lockKey}
          disabled={pending || lockKey}
          onChange={(e) => onKey(e.target.value)}
        />
        <span className="settings-hint">
          Stored on person cards. A duplicate key is refused. Empty label is refused.
        </span>
      </label>
      <label className="settings-field">
        <span>Confirmation email template</span>
        <select
          name="templateId"
          value={templateId}
          disabled={pending}
          onChange={(e) => onTemplateId(e.target.value)}
        >
          <option value="">None</option>
          {templateChoices.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.label}
            </option>
          ))}
        </select>
        <span className="settings-hint">
          Subject and body stay in Email Manager. Empty clears.{' '}
          <EmailTemplateEditLink templateId={templateId} />
        </span>
      </label>
      <label className="settings-field">
        <span>Forms definition</span>
        <select
          name="formDefinitionId"
          value={formDefinitionId}
          disabled={pending}
          onChange={(e) => onFormDefinitionId(e.target.value)}
        >
          <option value="">None</option>
          {formChoices.map((form) => (
            <option key={form.id} value={form.id}>
              {form.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Date field names</span>
        <textarea
          name="dateFieldNames"
          value={dateFieldNames}
          disabled={pending}
          rows={3}
          onChange={(e) => onDateFieldNames(e.target.value)}
        />
        <span className="settings-hint">One or more Forms field names, comma or newline.</span>
      </label>
      <StatusIdChecklist
        name="activeStatusIds"
        label="Active statuses"
        hint="Card stays editable while the person is on one of these statuses."
        options={statusOptions}
        selected={activeStatusIds}
        pending={pending}
        onChange={onActiveStatusIds}
      />
      <StatusIdChecklist
        name="completedStatusIds"
        label="Completed statuses"
        hint="Moving a person onto one of these sets that open event’s outcome to passed."
        options={statusOptions}
        selected={completedStatusIds}
        pending={pending}
        onChange={onCompletedStatusIds}
      />
    </>
  )
}

export function EventTypeManager({
  eventTypes,
  templateOptions,
  formOptions,
  statusOptions,
}: {
  eventTypes: EventTypeRow[]
  templateOptions: TemplateOption[]
  formOptions: FormOption[]
  statusOptions: StatusOption[]
}) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createOnboardingEventTypeAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateOnboardingEventTypeAction,
    initial,
  )
  const [enabledState, enabledAction, enabledPending] = useActionState(
    setOnboardingEventTypeEnabledAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingEventTypeAction,
    initial,
  )
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [typeKey, setTypeKey] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [formDefinitionId, setFormDefinitionId] = useState('')
  const [dateFieldNames, setDateFieldNames] = useState('')
  const [activeStatusIds, setActiveStatusIds] = useState<string[]>([])
  const [completedStatusIds, setCompletedStatusIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)
  const [editTemplateId, setEditTemplateId] = useState('')
  const [editFormId, setEditFormId] = useState('')
  const [editDates, setEditDates] = useState('')
  const [editActive, setEditActive] = useState<string[]>([])
  const [editCompleted, setEditCompleted] = useState<string[]>([])
  const [editSort, setEditSort] = useState(0)

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(enabledState)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (createState.ok || updateState.ok || enabledState.ok || deleteState.ok) {
      setOpen(false)
      setLabel('')
      setTypeKey('')
      setTemplateId('')
      setFormDefinitionId('')
      setDateFieldNames('')
      setActiveStatusIds([])
      setCompletedStatusIds([])
      setEditingId(null)
      router.refresh()
    }
  }, [createState.ok, updateState.ok, enabledState.ok, deleteState.ok, router])

  const busy = createPending || updatePending || enabledPending || deletePending

  function beginEdit(row: EventTypeRow) {
    setEditingId(row.id)
    setEditLabel(row.label)
    setEditKey(row.key)
    setEditEnabled(row.enabled)
    setEditTemplateId(row.templateId)
    setEditFormId(row.formDefinitionId)
    setEditDates(row.dateFieldNames.join('\n'))
    setEditActive(row.activeStatusIds)
    setEditCompleted(row.completedStatusIds)
    setEditSort(row.sortOrder)
  }

  return (
    <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
      <header className="page-settings-panel-head">
        <h3>Event types</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Ride-along, test day, trial day, and training day start enabled. Add another type with a
          label and a unique key. Deactivate hides it from new person cards. Existing cards keep
          it. Delete is refused while a person card uses that key.
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
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Close' : 'Add +'}
            </button>
          </div>
          {open ? (
            <form action={createAction} key={`create-etype-${createState.ok ? 'saved' : 'open'}`}>
              <input type="hidden" name="enabled" value="1" />
              <EventTypeFields
                pending={busy}
                templateOptions={templateOptions}
                formOptions={formOptions}
                statusOptions={statusOptions}
                label={label}
                typeKey={typeKey}
                templateId={templateId}
                formDefinitionId={formDefinitionId}
                dateFieldNames={dateFieldNames}
                activeStatusIds={activeStatusIds}
                completedStatusIds={completedStatusIds}
                onLabel={setLabel}
                onKey={setTypeKey}
                onTemplateId={setTemplateId}
                onFormDefinitionId={setFormDefinitionId}
                onDateFieldNames={setDateFieldNames}
                onActiveStatusIds={setActiveStatusIds}
                onCompletedStatusIds={setCompletedStatusIds}
              />
              <Feedback state={createState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={busy}
                >
                  {createPending ? 'Saving…' : 'Create event type'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {eventTypes.length === 0 ? (
          <p className="settings-hint">No event types yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
            {eventTypes.map((row) => {
              const editing = editingId === row.id
              return (
                <li key={row.id} className="page-settings-panel" style={{ marginBottom: '0.75rem' }}>
                  {editing ? (
                    <form
                      action={updateAction}
                      key={`edit-etype-${row.id}-${row.label}-${row.templateId}-${row.formDefinitionId}-${row.enabled}`}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="enabled" value={editEnabled ? '1' : '0'} />
                      <input type="hidden" name="sortOrder" value={String(editSort)} />
                      <EventTypeFields
                        pending={busy}
                        templateOptions={templateOptions}
                        formOptions={formOptions}
                        statusOptions={statusOptions}
                        label={editLabel}
                        typeKey={editKey}
                        templateId={editTemplateId}
                        formDefinitionId={editFormId}
                        dateFieldNames={editDates}
                        activeStatusIds={editActive}
                        completedStatusIds={editCompleted}
                        onLabel={setEditLabel}
                        onKey={setEditKey}
                        onTemplateId={setEditTemplateId}
                        onFormDefinitionId={setEditFormId}
                        onDateFieldNames={setEditDates}
                        onActiveStatusIds={setEditActive}
                        onCompletedStatusIds={setEditCompleted}
                        lockKey
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
                        <strong>{row.label}</strong>
                        <p className="settings-hint" style={{ marginTop: '0.25rem' }}>
                          {row.key}
                          {row.enabled ? ' · enabled' : ' · deactivated'}
                        </p>
                      </div>
                      <div className="page-settings-actions admin-action-row">
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          disabled={busy}
                          onClick={() => beginEdit(row)}
                        >
                          Edit
                        </button>
                        <form action={enabledAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="enabled" value={row.enabled ? '0' : '1'} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn"
                            disabled={busy}
                          >
                            {row.enabled ? 'Deactivate' : 'Activate'}
                          </button>
                        </form>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                      <Feedback state={enabledState} />
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
