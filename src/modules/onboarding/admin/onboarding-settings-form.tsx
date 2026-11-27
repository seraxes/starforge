'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createOnboardingDepotAction,
  createOnboardingTagAction,
  deleteOnboardingDepotAction,
  deleteOnboardingTagAction,
  saveOnboardingSettingsAction,
  seedOnboardingEmailStartersAction,
  updateOnboardingDepotAction,
  updateOnboardingTagAction,
  type OnboardingAdminActionState,
} from '../actions'
import { ONBOARDING_EMAIL_EVENT_TYPES } from '../email-binding-rules'
import type { OnboardingEventTypeSettings } from '../event-type-settings-rules'
import type { OnboardingModuleSettings } from '../types'
import { EmailTemplateEditLink } from './email-template-edit-dialog'

const initial: OnboardingAdminActionState = {}

type TemplateOption = { id: string; label: string }
type FormOption = { id: string; label: string }
type StatusOption = { id: string; label: string }
type DepotRow = { id: string; name: string; address: string; sortOrder: number }
type TagRow = {
  id: string
  label: string
  color: string
  todo: boolean
  fade: boolean
  sortOrder: number
}

type Props = {
  settings: OnboardingModuleSettings
  templateOptions: TemplateOption[]
  formOptions: FormOption[]
  statusOptions: StatusOption[]
  depots: DepotRow[]
  tags: TagRow[]
}

const EVENT_TYPE_LABELS: Record<(typeof ONBOARDING_EMAIL_EVENT_TYPES)[number], string> = {
  ridealong: 'Ride-along',
  testday: 'Test day',
  trialday: 'Trial day',
}

function withCurrentOption(options: TemplateOption[], currentId: string): TemplateOption[] {
  const id = currentId.trim()
  if (!id) return options
  if (options.some((opt) => opt.id === id)) return options
  return [...options, { id, label: `${id} (missing)` }]
}

function settingsRemountKey(
  settings: OnboardingModuleSettings,
  depots: DepotRow[],
  tags: TagRow[],
): string {
  const typeKey = ONBOARDING_EMAIL_EVENT_TYPES.map((kind) => {
    const row = settings.eventTypeSettings[kind]
    return [
      settings.eventTemplateIds[kind],
      row.formDefinitionId,
      row.dateFieldNames.join(','),
      row.activeStatusIds.join(','),
      row.completedStatusIds.join(','),
    ].join('|')
  }).join(';')
  return [
    settings.inviteTemplateId,
    typeKey,
    depots.map((d) => `${d.id}:${d.name}:${d.address}:${d.sortOrder}`).join(';'),
    tags
      .map((t) => `${t.id}:${t.label}:${t.color}:${t.todo ? 1 : 0}:${t.fade ? 1 : 0}:${t.sortOrder}`)
      .join(';'),
  ].join('::')
}

function normalizeColor(raw: string, fallback = '#2563eb'): string {
  const value = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) return value
  return fallback
}

function TemplatePickerField({
  name,
  label,
  value,
  options,
  pending,
  onChange,
  hint,
}: {
  name: string
  label: string
  value: string
  options: TemplateOption[]
  pending: boolean
  onChange: (next: string) => void
  hint: string
}) {
  const choices = withCurrentOption(options, value)
  return (
    <label className="settings-field">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">None</option>
        {choices.map((tpl) => (
          <option key={tpl.id} value={tpl.id}>
            {tpl.label}
          </option>
        ))}
      </select>
      <span className="settings-hint">
        {hint} <EmailTemplateEditLink templateId={value} />
      </span>
    </label>
  )
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

function EventTypeSettingsCard({
  kind,
  templateId,
  typeSettings,
  templateOptions,
  formOptions,
  statusOptions,
  pending,
  onTemplateChange,
  onTypeChange,
}: {
  kind: (typeof ONBOARDING_EMAIL_EVENT_TYPES)[number]
  templateId: string
  typeSettings: OnboardingEventTypeSettings
  templateOptions: TemplateOption[]
  formOptions: FormOption[]
  statusOptions: StatusOption[]
  pending: boolean
  onTemplateChange: (next: string) => void
  onTypeChange: (next: OnboardingEventTypeSettings) => void
}) {
  const formChoices = withCurrentOption(formOptions, typeSettings.formDefinitionId)
  const [dateFieldsRaw, setDateFieldsRaw] = useState(typeSettings.dateFieldNames.join('\n'))
  useEffect(() => {
    setDateFieldsRaw(typeSettings.dateFieldNames.join('\n'))
  }, [typeSettings.dateFieldNames])

  const dateHint =
    kind === 'trialday'
      ? 'One or more Forms field names (comma or newline). Trial day may use several.'
      : kind === 'testday'
        ? 'Forms date field name for test day (usually one).'
        : 'Forms date field name(s) for requested dates.'

  return (
    <section className="page-settings-panel">
      <header className="page-settings-panel-head">
        <h3>{EVENT_TYPE_LABELS[kind]}</h3>
      </header>
      <div className="page-settings-panel-body">
        <TemplatePickerField
          name={`eventTemplateId_${kind}`}
          label="Confirmation email template"
          value={templateId}
          options={templateOptions}
          pending={pending}
          onChange={onTemplateChange}
          hint="Subject and body stay in Email Manager. Empty clears."
        />
        <label className="settings-field">
          <span>Forms definition</span>
          <select
            name={`eventFormDefinitionId_${kind}`}
            value={typeSettings.formDefinitionId}
            disabled={pending}
            onChange={(e) =>
              onTypeChange({ ...typeSettings, formDefinitionId: e.target.value })
            }
          >
            <option value="">None</option>
            {formChoices.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">Plain Forms definition id for requested dates.</span>
        </label>
        <label className="settings-field">
          <span>Date field name{kind === 'trialday' ? 's' : ''}</span>
          <textarea
            name={`eventDateFields_${kind}`}
            value={dateFieldsRaw}
            disabled={pending}
            rows={kind === 'trialday' ? 3 : 2}
            onChange={(e) => {
              const raw = e.target.value
              setDateFieldsRaw(raw)
              onTypeChange({
                ...typeSettings,
                dateFieldNames: raw
                  .split(/[\n,]/)
                  .map((part) => part.trim())
                  .filter(Boolean),
              })
            }}
          />
          <span className="settings-hint">{dateHint}</span>
        </label>
        <StatusIdChecklist
          name={`eventActiveStatusIds_${kind}`}
          label="Active statuses"
          hint="Card stays editable while the person is on one of these statuses."
          options={statusOptions}
          selected={typeSettings.activeStatusIds}
          pending={pending}
          onChange={(activeStatusIds) => onTypeChange({ ...typeSettings, activeStatusIds })}
        />
        <StatusIdChecklist
          name={`eventCompletedStatusIds_${kind}`}
          label="Completed statuses"
          hint="Moving a person onto one of these sets that open event’s outcome to passed (not failed or no-show)."
          options={statusOptions}
          selected={typeSettings.completedStatusIds}
          pending={pending}
          onChange={(completedStatusIds) =>
            onTypeChange({ ...typeSettings, completedStatusIds })
          }
        />
      </div>
    </section>
  )
}

function DepotManager({ depots }: { depots: DepotRow[] }) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createOnboardingDepotAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateOnboardingDepotAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingDepotAction,
    initial,
  )
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      setOpen(false)
      setName('')
      setAddress('')
      setEditingId(null)
      router.refresh()
    }
  }, [createState.ok, updateState.ok, deleteState.ok, router])

  const busy = createPending || updatePending || deletePending

  return (
    <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
      <header className="page-settings-panel-head">
        <h3>Depots</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Short name and address while Fleet is off. This list is the depot catalog for confirmation
          slots. Empty name is refused.
        </p>

        <div className="outlines-create sf-events-add-panel">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={
                open ? 'gantry-toolbar-btn gantry-toolbar-btn-muted' : 'gantry-toolbar-btn gantry-toolbar-btn-save'
              }
              disabled={busy}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Close' : 'Add +'}
            </button>
          </div>
          {open ? (
            <form action={createAction}>
              <label className="settings-field">
                <span>Short name</span>
                <input
                  name="name"
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>Address</span>
                <input
                  name="address"
                  value={address}
                  disabled={busy}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <Feedback state={createState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={busy}
                >
                  {createPending ? 'Saving…' : 'Create depot'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {depots.length === 0 ? (
          <p className="settings-hint">No depots yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
            {depots.map((depot) => {
              const editing = editingId === depot.id
              return (
                <li key={depot.id} className="page-settings-panel" style={{ marginBottom: '0.75rem' }}>
                  {editing ? (
                    <form action={updateAction}>
                      <input type="hidden" name="id" value={depot.id} />
                      <input type="hidden" name="sortOrder" value={String(depot.sortOrder)} />
                      <label className="settings-field">
                        <span>Short name</span>
                        <input
                          name="name"
                          value={editName}
                          disabled={busy}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </label>
                      <label className="settings-field">
                        <span>Address</span>
                        <input
                          name="address"
                          value={editAddress}
                          disabled={busy}
                          onChange={(e) => setEditAddress(e.target.value)}
                        />
                      </label>
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
                        <strong>{depot.name}</strong>
                        {depot.address ? (
                          <p className="settings-hint" style={{ marginTop: '0.25rem' }}>
                            {depot.address}
                          </p>
                        ) : null}
                      </div>
                      <div className="page-settings-actions admin-action-row">
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(depot.id)
                            setEditName(depot.name)
                            setEditAddress(depot.address)
                          }}
                        >
                          Edit
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={depot.id} />
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

function TagManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createOnboardingTagAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateOnboardingTagAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingTagAction,
    initial,
  )
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [todo, setTodo] = useState(false)
  const [fade, setFade] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('#2563eb')
  const [editTodo, setEditTodo] = useState(false)
  const [editFade, setEditFade] = useState(false)

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      setOpen(false)
      setLabel('')
      setColor('#2563eb')
      setTodo(false)
      setFade(false)
      setEditingId(null)
      router.refresh()
    }
  }, [createState.ok, updateState.ok, deleteState.ok, router])

  const busy = createPending || updatePending || deletePending

  return (
    <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
      <header className="page-settings-panel-head">
        <h3>Staff tags</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Marks on a person (waiting, on hold, to-do). A tag does not move status. Empty label is
          refused. Seeds are examples — edit or add more.
        </p>

        <div className="outlines-create sf-events-add-panel">
          <div className="sf-events-add-bar">
            <button
              type="button"
              className={
                open ? 'gantry-toolbar-btn gantry-toolbar-btn-muted' : 'gantry-toolbar-btn gantry-toolbar-btn-save'
              }
              disabled={busy}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Close' : 'Add +'}
            </button>
          </div>
          {open ? (
            <form action={createAction} key={`create-tag-${createState.ok ? 'saved' : 'open'}`}>
              <label className="settings-field">
                <span>Label</span>
                <input
                  name="label"
                  value={label}
                  disabled={busy}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>Color</span>
                <div className="admin-control-row">
                  <input
                    type="color"
                    value={normalizeColor(color)}
                    disabled={busy}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label="Tag color"
                  />
                  <input
                    name="color"
                    value={color}
                    disabled={busy}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#2563eb"
                  />
                </div>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="todo"
                  value="1"
                  checked={todo}
                  disabled={busy}
                  onChange={(e) => setTodo(e.target.checked)}
                />
                <span>To-do</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="fade"
                  value="1"
                  checked={fade}
                  disabled={busy}
                  onChange={(e) => setFade(e.target.checked)}
                />
                <span>Fade</span>
              </label>
              <Feedback state={createState} />
              <div className="page-settings-actions admin-action-row">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={busy}
                >
                  {createPending ? 'Saving…' : 'Create tag'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {tags.length === 0 ? (
          <p className="settings-hint">No tags yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
            {tags.map((tag) => {
              const editing = editingId === tag.id
              return (
                <li key={tag.id} className="page-settings-panel" style={{ marginBottom: '0.75rem' }}>
                  {editing ? (
                    <form
                      action={updateAction}
                      key={`edit-tag-${tag.id}-${tag.label}-${tag.color}-${tag.todo}-${tag.fade}`}
                    >
                      <input type="hidden" name="id" value={tag.id} />
                      <input type="hidden" name="sortOrder" value={String(tag.sortOrder)} />
                      <label className="settings-field">
                        <span>Label</span>
                        <input
                          name="label"
                          value={editLabel}
                          disabled={busy}
                          onChange={(e) => setEditLabel(e.target.value)}
                          required
                        />
                      </label>
                      <label className="settings-field">
                        <span>Color</span>
                        <div className="admin-control-row">
                          <input
                            type="color"
                            value={normalizeColor(editColor)}
                            disabled={busy}
                            onChange={(e) => setEditColor(e.target.value)}
                            aria-label="Tag color"
                          />
                          <input
                            name="color"
                            value={editColor}
                            disabled={busy}
                            onChange={(e) => setEditColor(e.target.value)}
                          />
                        </div>
                      </label>
                      <label className="settings-field settings-flag">
                        <input
                          type="checkbox"
                          name="todo"
                          value="1"
                          checked={editTodo}
                          disabled={busy}
                          onChange={(e) => setEditTodo(e.target.checked)}
                        />
                        <span>To-do</span>
                      </label>
                      <label className="settings-field settings-flag">
                        <input
                          type="checkbox"
                          name="fade"
                          value="1"
                          checked={editFade}
                          disabled={busy}
                          onChange={(e) => setEditFade(e.target.checked)}
                        />
                        <span>Fade</span>
                      </label>
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
                        <div className="admin-control-row" style={{ gap: '0.5rem' }}>
                          <span
                            aria-hidden
                            style={{
                              display: 'inline-block',
                              width: '0.85rem',
                              height: '0.85rem',
                              borderRadius: '2px',
                              background: tag.color || '#64748b',
                              opacity: tag.fade ? 0.45 : 1,
                            }}
                          />
                          <strong>{tag.label}</strong>
                          {tag.todo ? (
                            <span className="settings-hint">to-do</span>
                          ) : null}
                          {tag.fade ? <span className="settings-hint">fade</span> : null}
                        </div>
                      </div>
                      <div className="page-settings-actions admin-action-row">
                        <button
                          type="button"
                          className="gantry-toolbar-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(tag.id)
                            setEditLabel(tag.label)
                            setEditColor(tag.color || '#2563eb')
                            setEditTodo(tag.todo)
                            setEditFade(tag.fade)
                          }}
                        >
                          Edit
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={tag.id} />
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

function OnboardingSettingsFormFields({
  settings,
  templateOptions,
  formOptions,
  statusOptions,
  depots,
  tags,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveOnboardingSettingsAction, initial)
  const [seedState, seedAction, seedPending] = useActionState(
    seedOnboardingEmailStartersAction,
    initial,
  )
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(seedState)
  useEffect(() => {
    if (state.ok || seedState.ok) router.refresh()
  }, [state.ok, seedState.ok, router])

  const [inviteTemplateId, setInviteTemplateId] = useState(settings.inviteTemplateId)
  const [templates, setTemplates] = useState(settings.eventTemplateIds)
  const [typeSettings, setTypeSettings] = useState(settings.eventTypeSettings)

  useEffect(() => {
    setInviteTemplateId(settings.inviteTemplateId)
    setTemplates(settings.eventTemplateIds)
    setTypeSettings(settings.eventTypeSettings)
  }, [settings])

  const busy = pending || seedPending

  return (
    <div className="sf-onboarding-settings">
      <form action={formAction}>
        <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {pending ? 'Saving…' : 'Save settings'}
          </button>
        </div>

        <div className="admin-settings-mosaic">
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>New-driver invite</h3>
            </header>
            <div className="page-settings-panel-body">
              <TemplatePickerField
                name="inviteTemplateId"
                label="Invite email template"
                value={inviteTemplateId}
                options={templateOptions}
                pending={busy}
                onChange={setInviteTemplateId}
                hint="One template for the new-driver invite. Subject and body stay in Email Manager. Empty clears."
              />
            </div>
          </section>

          {ONBOARDING_EMAIL_EVENT_TYPES.map((kind) => (
            <EventTypeSettingsCard
              key={kind}
              kind={kind}
              templateId={templates[kind]}
              typeSettings={typeSettings[kind]}
              templateOptions={templateOptions}
              formOptions={formOptions}
              statusOptions={statusOptions}
              pending={busy}
              onTemplateChange={(next) => setTemplates((prev) => ({ ...prev, [kind]: next }))}
              onTypeChange={(next) => setTypeSettings((prev) => ({ ...prev, [kind]: next }))}
            />
          ))}
        </div>

        <Feedback state={state} />

        <div className="page-settings-actions admin-action-row" style={{ marginTop: '1rem' }}>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {pending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      <DepotManager depots={depots} />
      <TagManager tags={tags} />

      <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
        <header className="page-settings-panel-head">
          <h3>Email Manager starters</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Seed creates missing Email Manager templates and binds empty Onboarding ids (invite,
            event types, recruiting reminders). Copy stays editable under Email Manager.
          </p>
          <form action={seedAction}>
            <div className="page-settings-actions admin-action-row">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {seedPending ? 'Seeding…' : 'Seed email starters'}
              </button>
            </div>
          </form>
          <Feedback state={seedState} />
        </div>
      </section>
    </div>
  )
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

/** Remount after saved props change so controlled selects keep the just-saved value. */
export function OnboardingSettingsForm(props: Props) {
  return (
    <OnboardingSettingsFormFields
      key={settingsRemountKey(props.settings, props.depots, props.tags)}
      settings={props.settings}
      templateOptions={props.templateOptions}
      formOptions={props.formOptions}
      statusOptions={props.statusOptions}
      depots={props.depots}
      tags={props.tags}
    />
  )
}
