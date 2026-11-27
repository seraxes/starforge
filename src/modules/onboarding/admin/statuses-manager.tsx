'use client'

import React, {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

import {
  createOnboardingStatusAction,
  deleteOnboardingStatusAction,
  reorderOnboardingStatusesAction,
  updateOnboardingStatusAction,
  type OnboardingAdminActionState,
} from '../actions'
import { ONBOARDING_STATUS_PHASES, type OnboardingStatusPhase } from '../status-rules'
import { EmailTemplateEditLink } from './email-template-edit-dialog'
import {
  FormDefinitionCreateButton,
  FormDefinitionEditLink,
} from './form-definition-edit-dialog'

const initial: OnboardingAdminActionState = {}

type FormOption = { id: string; label: string }
type TemplateOption = { id: string; label: string }

type StatusRow = {
  id: string
  key: string
  name: string
  phase: OnboardingStatusPhase
  displayLabel: string
  actionChip: string
  nextStepMessage: string
  bookable: boolean
  formDefinitionId: string
  reminderTemplateId: string
  sortOrder: number
  updatedAt: string
}

type Props = {
  statuses: StatusRow[]
  formOptions: FormOption[]
  templateOptions: TemplateOption[]
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

function withCurrentOption(options: FormOption[], currentId: string): FormOption[] {
  const id = currentId.trim()
  if (!id) return options
  if (options.some((opt) => opt.id === id)) return options
  return [...options, { id, label: `${id} (missing)` }]
}

function phaseLabel(phase: OnboardingStatusPhase): string {
  switch (phase) {
    case 'recruiting':
      return 'Recruiting'
    case 'declined':
      return 'Declined'
    case 'inactive':
      return 'Inactive'
    case 'active':
      return 'Active (bookable)'
    case 'banned':
      return 'Banned'
    default:
      return phase
  }
}

function StatusFields({
  row,
  formOptions,
  templateOptions,
  pending,
}: {
  row?: StatusRow
  formOptions: FormOption[]
  templateOptions: TemplateOption[]
  pending: boolean
}) {
  const [name, setName] = useState(row?.name ?? '')
  const [key, setKey] = useState(row?.key ?? '')
  const [phase, setPhase] = useState<OnboardingStatusPhase>(row?.phase ?? 'recruiting')
  const [displayLabel, setDisplayLabel] = useState(row?.displayLabel ?? '')
  const [actionChip, setActionChip] = useState(row?.actionChip ?? '')
  const [nextStepMessage, setNextStepMessage] = useState(row?.nextStepMessage ?? '')
  const [formDefinitionId, setFormDefinitionId] = useState(row?.formDefinitionId ?? '')
  const [reminderTemplateId, setReminderTemplateId] = useState(row?.reminderTemplateId ?? '')
  const formChoices = withCurrentOption(formOptions, formDefinitionId)
  const formDeepLinkId = formDefinitionId.trim()
  const reminderChoices = withCurrentOption(templateOptions, reminderTemplateId)
  const reminderDeepLinkId = phase === 'recruiting' ? reminderTemplateId.trim() : ''
  const statusId = row?.id?.trim() ?? ''

  useEffect(() => {
    setName(row?.name ?? '')
    setKey(row?.key ?? '')
    setPhase(row?.phase ?? 'recruiting')
    setDisplayLabel(row?.displayLabel ?? '')
    setActionChip(row?.actionChip ?? '')
    setNextStepMessage(row?.nextStepMessage ?? '')
    setFormDefinitionId(row?.formDefinitionId ?? '')
    setReminderTemplateId(row?.reminderTemplateId ?? '')
  }, [row])

  useEffect(() => {
    if (phase !== 'recruiting' && reminderTemplateId) {
      setReminderTemplateId('')
    }
  }, [phase, reminderTemplateId])

  return (
    <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
      <legend>Status</legend>
      <label className="settings-field">
        <span>Name</span>
        <input
          type="text"
          name="name"
          value={name}
          required
          disabled={pending}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <span className="settings-hint">
          Adding a status with a name is enough for later pickers to list it.
        </span>
      </label>
      <label className="settings-field">
        <span>Display label</span>
        <input
          type="text"
          name="displayLabel"
          value={displayLabel}
          disabled={pending}
          autoComplete="off"
          placeholder="Shown on the people list"
          onChange={(e) => setDisplayLabel(e.target.value)}
        />
        <span className="settings-hint">Shown on the people / driver list. Blank → uses Name.</span>
      </label>
      <label className="settings-field">
        <span>Key</span>
        <input
          type="text"
          name="key"
          value={key}
          disabled={pending}
          autoComplete="off"
          placeholder="active"
          onChange={(e) => setKey(e.target.value)}
        />
        <span className="settings-hint">Leave blank on create to build it from the name.</span>
      </label>
      <label className="settings-field">
        <span>Phase</span>
        <select
          name="phase"
          value={phase}
          disabled={pending}
          onChange={(e) => setPhase(e.target.value as OnboardingStatusPhase)}
        >
          {ONBOARDING_STATUS_PHASES.map((p) => (
            <option key={p} value={p}>
              {phaseLabel(p)}
            </option>
          ))}
        </select>
        <span className="settings-hint">Active phase is bookable. No Joomla group ids.</span>
      </label>
      <label className="settings-field">
        <span>Action chip</span>
        <input
          type="text"
          name="actionChip"
          value={actionChip}
          disabled={pending}
          autoComplete="off"
          placeholder="Short action text"
          onChange={(e) => setActionChip(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Next-step message</span>
        <textarea
          name="nextStepMessage"
          value={nextStepMessage}
          disabled={pending}
          rows={3}
          placeholder="Instruction shown for this status"
          onChange={(e) => setNextStepMessage(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Forms definition</span>
        {formOptions.length > 0 || formDefinitionId ? (
          <select
            name="formDefinitionId"
            value={formDefinitionId}
            disabled={pending}
            onChange={(e) => setFormDefinitionId(e.target.value)}
          >
            <option value="">None</option>
            {formChoices.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            name="formDefinitionId"
            value={formDefinitionId}
            disabled={pending}
            placeholder="Optional Forms definition id"
            autoComplete="off"
            onChange={(e) => setFormDefinitionId(e.target.value)}
          />
        )}
        <span className="settings-hint">
          Optional intake for this step. Banned and similar statuses may have none.{' '}
          {formDeepLinkId ? (
            <FormDefinitionEditLink formId={formDeepLinkId} />
          ) : statusId ? (
            <FormDefinitionCreateButton
              statusId={statusId}
              statusName={name || row?.name || row?.key || 'Status'}
              onCreated={(id) => setFormDefinitionId(id)}
            />
          ) : null}
        </span>
      </label>
      {phase === 'recruiting' ? (
        <label className="settings-field">
          <span>Reminder email template</span>
          <select
            name="reminderTemplateId"
            value={reminderTemplateId}
            disabled={pending}
            onChange={(e) => setReminderTemplateId(e.target.value)}
          >
            <option value="">None</option>
            {reminderChoices.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Recruiting only. Subject and body stay in Email Manager. Empty clears the binding.{' '}
            <EmailTemplateEditLink templateId={reminderDeepLinkId} />
          </span>
        </label>
      ) : (
        <input type="hidden" name="reminderTemplateId" value="" />
      )}
    </fieldset>
  )
}

function AddStatusPanel({
  formOptions,
  templateOptions,
}: {
  formOptions: FormOption[]
  templateOptions: TemplateOption[]
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createOnboardingStatusAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-onboarding-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add status">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-onboarding-add-status-form"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Click Add + to create a status — drag ▣ to reorder the list.
            </p>
          ) : null}
        </div>
      </section>
      {createOpen ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-onboarding-add-status-form"
            action={action}
            aria-label="Create status"
            className="sf-events-form-mosaic-form"
          >
            <StatusFields
              formOptions={formOptions}
              templateOptions={templateOptions}
              pending={pending}
            />
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sf-onboarding-add-status-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EditStatusForm({
  row,
  formOptions,
  templateOptions,
  onClose,
  onDeleted,
}: {
  row: StatusRow
  formOptions: FormOption[]
  templateOptions: TemplateOption[]
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateOnboardingStatusAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOnboardingStatusAction,
    initial,
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  useEffect(() => {
    if (!deleteState.ok) return
    onDeleted()
    router.refresh()
  }, [deleteState.ok, onDeleted, router])

  const busy = pending || deletePending
  const formId = `sf-onboarding-edit-status-${row.id}`
  const feedback = state.error ? state : deleteState.error ? deleteState : state

  return (
    <div className="sf-events-form-mosaic" aria-label={`Edit ${row.name}`}>
      <form
        key={`${row.id}:${row.updatedAt}:${row.reminderTemplateId}`}
        id={formId}
        action={action}
        className="sf-events-form-mosaic-form"
      >
        <input type="hidden" name="id" value={row.id} />
        <StatusFields
          row={row}
          formOptions={formOptions}
          templateOptions={templateOptions}
          pending={busy}
        />
      </form>
      <Feedback state={feedback} />
      <div className="sf-events-form-actions admin-action-row page-settings-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <AdminConfirmDialog
        open={confirmDelete}
        title="Delete status"
        message={`Delete “${row.name}”? People using it must be reassigned first.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          const fd = new FormData()
          fd.set('id', row.id)
          startTransition(() => {
            void deleteAction(fd)
          })
        }}
      />
    </div>
  )
}

function SortableStatusRow({
  row,
  index,
  isOpen,
  busy,
  formOptions,
  templateOptions,
  onToggle,
  onClose,
  onDeleted,
}: {
  row: StatusRow
  index: number
  isOpen: boolean
  busy: boolean
  formOptions: FormOption[]
  templateOptions: TemplateOption[]
  onToggle: () => void
  onClose: () => void
  onDeleted: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`page-settings-panel${isDragging ? ' is-slot-dragging' : ''}`}
    >
      <div className="page-settings-panel-head">
        <div className="gantry-slot-title">
          <button
            type="button"
            className="gantry-slot-handle"
            aria-label={`Drag to reorder ${row.displayLabel || row.name || `status ${index + 1}`}`}
            title="Drag to reorder"
            disabled={busy}
            {...attributes}
            {...listeners}
          >
            ▣
          </button>
          <div className="gantry-slot-labels">
            <strong>{row.displayLabel || row.name}</strong>
            <span className="gantry-slot-sub">
              {row.key} · {row.phase}
              {row.bookable ? ' · bookable' : ''}
              {row.formDefinitionId ? ` · form ${row.formDefinitionId}` : ' · no form'}
              {row.phase === 'recruiting' && row.reminderTemplateId
                ? ` · reminder ${row.reminderTemplateId}`
                : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          aria-expanded={isOpen}
          disabled={busy}
          onClick={onToggle}
        >
          {isOpen ? 'Close' : 'Edit'}
        </button>
      </div>
      {isOpen ? (
        <div className="page-settings-panel-body">
          <EditStatusForm
            row={row}
            formOptions={formOptions}
            templateOptions={templateOptions}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        </div>
      ) : null}
    </li>
  )
}

export function StatusesManager({ statuses, formOptions, templateOptions }: Props) {
  const router = useRouter()
  const dndId = useId()
  const [openId, setOpenId] = useState<string | null>(null)
  const [ordered, setOrdered] = useState(statuses)
  const [reorderPending, startReorder] = useTransition()
  const [reorderState, setReorderState] = useState<OnboardingAdminActionState>({})

  useNotifySavedOnOk(reorderState)

  useEffect(() => {
    setOrdered(statuses)
  }, [statuses])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const sortableIds = useMemo(() => ordered.map((row) => row.id), [ordered])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ordered.findIndex((row) => row.id === active.id)
    const newIndex = ordered.findIndex((row) => row.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(ordered, oldIndex, newIndex)
    setOrdered(next)

    const fd = new FormData()
    fd.set('orderedIds', next.map((row) => row.id).join(','))
    startReorder(async () => {
      const result = await reorderOnboardingStatusesAction({}, fd)
      setReorderState(result)
      if (result.ok) router.refresh()
      if (result.error) setOrdered(statuses)
    })
  }

  return (
    <div className="sf-onboarding-statuses-manager">
      <AddStatusPanel formOptions={formOptions} templateOptions={templateOptions} />

      <section className="outlines-create" aria-label="Statuses">
        <Feedback state={reorderState} />
        {ordered.length === 0 ? (
          <p className="settings-hint">No statuses yet.</p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ul className="sf-ads-entity-list">
                {ordered.map((row, index) => {
                  const isOpen = openId === row.id
                  return (
                    <SortableStatusRow
                      key={row.id}
                      row={row}
                      index={index}
                      isOpen={isOpen}
                      busy={reorderPending}
                      formOptions={formOptions}
                      templateOptions={templateOptions}
                      onToggle={() => setOpenId(isOpen ? null : row.id)}
                      onClose={() => setOpenId(null)}
                      onDeleted={() => setOpenId(null)}
                    />
                  )
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  )
}

export type { StatusRow }
