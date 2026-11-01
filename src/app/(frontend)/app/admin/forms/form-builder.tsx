'use client'

import React, { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

import {
  saveFormDefinitionAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import {
  FORM_WEEKDAY_LABELS,
  htmlInputTypeForField,
  isDateTimeFieldType,
  normalizeDateTimeConstraints,
  normalizeDaysOfMonth,
} from '@/core/forms/date-constraints'
import {
  createFieldDraft,
  createSectionDraft,
  normalizeFormSections,
} from '@/core/forms/definition'
import { FORM_CONDITION_OP_LABELS } from '@/core/forms/logic'
import { FORM_PRESETS } from '@/core/forms/presets'
import { fieldsToJsonSchema, stringifyFormJsonSchema } from '@/core/forms/schema-json'
import type {
  FormCondition,
  FormConditionGroup,
  FormConditionOp,
  FormDateTimeConstraints,
  FormDefinitionDocument,
  FormEmailNotifyConfig,
  FormFieldDef,
  FormFieldOption,
  FormFieldType,
  FormPresetId,
  FormSectionDef,
  FormWeekday,
} from '@/core/forms/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { FormsAdminNav } from './forms-admin-nav'

const FIELD_PALETTE: { type: FormFieldType; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'Single line' },
  { type: 'email', label: 'Email', hint: 'Validated email' },
  { type: 'textarea', label: 'Textarea', hint: 'Multi-line' },
  { type: 'number', label: 'Number', hint: 'Numeric + bounds' },
  { type: 'tel', label: 'Phone', hint: 'Telephone' },
  { type: 'url', label: 'URL', hint: 'Web address' },
  { type: 'date', label: 'Date', hint: 'Calendar day' },
  { type: 'time', label: 'Time', hint: 'Clock time' },
  { type: 'datetime', label: 'Date & time', hint: 'Combined' },
  { type: 'select', label: 'Select', hint: 'Dropdown + media' },
  { type: 'radio', label: 'Radio', hint: 'Single choice + media' },
  { type: 'checkbox', label: 'Checkbox', hint: 'Yes / no' },
  { type: 'checkbox-group', label: 'Choices', hint: 'Multi + media' },
  { type: 'computed', label: 'Computed', hint: 'Math expression' },
]

const OPTION_TYPES = new Set<FormFieldType>(['select', 'radio', 'checkbox-group'])

const initial: FormAdminActionState = {}

type Props = {
  formId: string
  initialDocument: FormDefinitionDocument
}

function SortableFieldBar({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: FormFieldDef
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const id = field.id || field.name
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`gantry-slot sf-form-slot${selected ? ' is-selected' : ''}${isDragging ? ' is-slot-dragging' : ''}`}
    >
      <header className="gantry-slot-head">
        <div className="gantry-slot-title">
          <button
            type="button"
            className="gantry-slot-handle"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            ▣
          </button>
          <button type="button" className="sf-form-slot-main" onClick={onSelect}>
            <strong>{field.label || field.name}</strong>
            <span className="gantry-slot-sub">
              {field.type}
              {field.required ? ' · required' : ''}
              {field.logic?.showWhen ? ' · conditional' : ''}
              {field.computed ? ' · expr' : ''}
              {' · '}
              <code>{field.name}</code>
            </span>
          </button>
        </div>
        <div className="gantry-slot-end">
          <button
            type="button"
            className="gantry-toolbar-btn danger"
            onClick={onRemove}
            aria-label={`Remove ${field.label || field.name}`}
          >
            ×
          </button>
        </div>
      </header>
    </article>
  )
}

function emptyGroup(): FormConditionGroup {
  return { logic: 'and', conditions: [{ field: '', op: 'eq', value: '' }] }
}

export function FormBuilder({ formId, initialDocument }: Props) {
  const [state, formAction, pending] = useActionState(saveFormDefinitionAction, initial)
  useNotifySavedOnOk(state)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const [title, setTitle] = useState(initialDocument.title)
  const [description, setDescription] = useState(initialDocument.description ?? '')
  const [preset, setPreset] = useState<FormPresetId>(initialDocument.preset)
  const [successMessage, setSuccessMessage] = useState(initialDocument.successMessage)
  const [submitLabel, setSubmitLabel] = useState(initialDocument.submitLabel)
  const [useSiteCaptchaDefault, setUseSiteCaptchaDefault] = useState(
    initialDocument.useSiteCaptchaDefault !== false,
  )
  const [emailNotify, setEmailNotify] = useState<FormEmailNotifyConfig>(
    () => initialDocument.emailNotify ?? {},
  )
  const [fields, setFields] = useState<FormFieldDef[]>(() =>
    initialDocument.fields.map((f) => ({
      ...f,
      id: f.id || `fld_${f.name}`,
    })),
  )
  const [sections, setSections] = useState<FormSectionDef[]>(() =>
    normalizeFormSections(initialDocument.sections, initialDocument.fields),
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    () => fields[0]?.id || fields[0]?.name || null,
  )
  const [schemaDirty, setSchemaDirty] = useState(Boolean(initialDocument.schemaDirty))
  const [schemaJson, setSchemaJson] = useState(() =>
    stringifyFormJsonSchema(
      initialDocument.schemaDirty
        ? initialDocument.schema
        : fieldsToJsonSchema(initialDocument.fields, {
            title: initialDocument.title,
            description: initialDocument.description,
          }),
    ),
  )
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const selected = useMemo(
    () => fields.find((f) => (f.id || f.name) === selectedId) ?? null,
    [fields, selectedId],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function regenerateSchema(nextFields: FormFieldDef[], nextTitle = title, nextDesc = description) {
    if (schemaDirty) return
    setSchemaJson(
      stringifyFormJsonSchema(
        fieldsToJsonSchema(nextFields, {
          title: nextTitle,
          description: nextDesc || undefined,
        }),
      ),
    )
  }

  function syncSectionsWithFields(nextFields: FormFieldDef[], nextSections: FormSectionDef[]) {
    return normalizeFormSections(nextSections, nextFields)
  }

  function updateFields(next: FormFieldDef[], nextSections?: FormSectionDef[]) {
    setFields(next)
    setSections(syncSectionsWithFields(next, nextSections ?? sections))
    regenerateSchema(next)
    saveDebounced()
  }

  function addField(type: FormFieldType, sectionId?: string) {
    const draft = createFieldDraft(type)
    const names = new Set(fields.map((f) => f.name))
    let name = draft.name
    let n = 2
    while (names.has(name)) {
      name = `${draft.name}_${n}`
      n += 1
    }
    draft.name = name
    const next = [...fields, draft]
    const targetSec = sectionId || sections[0]?.id
    const nextSections = sections.map((s) =>
      s.id === targetSec ? { ...s, fieldNames: [...s.fieldNames, draft.name] } : s,
    )
    setSelectedId(draft.id || draft.name)
    updateFields(next, nextSections.length ? nextSections : undefined)
  }

  function patchSelected(patch: Partial<FormFieldDef>) {
    if (!selected) return
    const id = selected.id || selected.name
    const next = fields.map((f) => ((f.id || f.name) === id ? { ...f, ...patch } : f))
    updateFields(next)
  }

  function patchSelectedConstraints(patch: Partial<FormDateTimeConstraints>) {
    if (!selected || !isDateTimeFieldType(selected.type)) return
    const merged: FormDateTimeConstraints = {
      ...(selected.constraints ?? {}),
      ...patch,
    }
    if (patch.min !== undefined && !patch.min) delete merged.min
    if (patch.max !== undefined && !patch.max) delete merged.max
    if (patch.weekdays !== undefined && (!patch.weekdays || patch.weekdays.length === 0)) {
      delete merged.weekdays
    }
    if (
      patch.daysOfMonth !== undefined &&
      (!patch.daysOfMonth || patch.daysOfMonth.length === 0)
    ) {
      delete merged.daysOfMonth
    }
    patchSelected({ constraints: normalizeDateTimeConstraints(selected.type, merged) })
  }

  function onDragEnd(event: DragEndEvent, sectionId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    const ids = section.fieldNames
    const oldIndex = ids.findIndex((name) => {
      const f = fields.find((x) => x.name === name)
      return (f?.id || name) === active.id
    })
    const newIndex = ids.findIndex((name) => {
      const f = fields.find((x) => x.name === name)
      return (f?.id || name) === over.id
    })
    if (oldIndex < 0 || newIndex < 0) return
    const nextNames = arrayMove(ids, oldIndex, newIndex)
    const nextSections = sections.map((s) =>
      s.id === sectionId ? { ...s, fieldNames: nextNames } : s,
    )
    // Reorder flat fields to match section order concatenation
    const orderedNames = nextSections.flatMap((s) => s.fieldNames)
    const byName = new Map(fields.map((f) => [f.name, f]))
    const nextFields = orderedNames.map((n) => byName.get(n)!).filter(Boolean)
    updateFields(nextFields, nextSections)
  }

  function applySchemaJson(raw: string) {
    setSchemaJson(raw)
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setSchemaError('Schema must be a JSON object.')
        return
      }
      setSchemaError(null)
      setSchemaDirty(true)
      saveDebounced()
    } catch {
      setSchemaError('Invalid JSON.')
    }
  }

  function resetSchemaFromFields() {
    setSchemaDirty(false)
    setSchemaError(null)
    setSchemaJson(
      stringifyFormJsonSchema(
        fieldsToJsonSchema(fields, {
          title,
          description: description || undefined,
        }),
      ),
    )
    saveDebounced()
  }

  function updateOptions(options: FormFieldOption[]) {
    patchSelected({ options })
  }

  function patchLogicGroup(
    key: 'showWhen' | 'requireWhen',
    group: FormConditionGroup | undefined,
  ) {
    if (!selected) return
    const logic = { ...(selected.logic ?? {}) }
    if (!group || !group.conditions.length) delete logic[key]
    else logic[key] = group
    patchSelected({
      logic: logic.showWhen || logic.requireWhen ? logic : undefined,
    })
  }

  return (
    <div className="sf-form-builder gantry-editor">
      <FormsAdminNav active="forms" />
      <p className="admin-lede">
        <Link href="/app/admin/forms">← Forms</Link>
        {' · '}
        Layout-aligned builder: palette → section canvas (dnd-kit) → inspector. Same Gantry dark
        chrome as Layouts; fields stay a flat Form model (sections are grouping only).
      </p>

      <form ref={formRef} action={formAction} className="sf-form-builder-form">
        <input type="hidden" name="formId" value={formId} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />
        <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
        <input type="hidden" name="schemaJson" value={schemaJson} />
        <input type="hidden" name="schemaDirty" value={schemaDirty ? '1' : '0'} />
        <input type="hidden" name="preset" value={preset} />
        <input type="hidden" name="emailNotifyJson" value={JSON.stringify(emailNotify)} />

        <div className="sf-form-builder-meta gantry-typed-form">
          <label>
            <span>Title</span>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                regenerateSchema(fields, e.target.value, description)
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label>
            <span>Description</span>
            <input
              type="text"
              name="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                regenerateSchema(fields, title, e.target.value)
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label>
            <span>Preset</span>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as FormPresetId)
                queueMicrotask(saveNow)
              }}
            >
              {FORM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.stub ? ' (stub)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Success message</span>
            <input
              type="text"
              name="successMessage"
              value={successMessage}
              onChange={(e) => {
                setSuccessMessage(e.target.value)
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label>
            <span>Submit label</span>
            <input
              type="text"
              name="submitLabel"
              value={submitLabel}
              onChange={(e) => {
                setSubmitLabel(e.target.value)
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label className="gantry-typed-check">
            <input
              type="checkbox"
              name="useSiteCaptchaDefault"
              checked={useSiteCaptchaDefault}
              onChange={(e) => {
                setUseSiteCaptchaDefault(e.target.checked)
                queueMicrotask(saveNow)
              }}
            />
            <span>Use site captcha default (Site Chrome)</span>
          </label>
        </div>

        <div className="gantry-workspace sf-form-workspace">
          <aside className="gantry-palette" aria-label="Field types">
            <h3>Fields</h3>
            <ul className="gantry-palette-list">
              {FIELD_PALETTE.map((item) => (
                <li key={item.type}>
                  <button
                    type="button"
                    className="gantry-palette-item"
                    onClick={() => addField(item.type)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="layout-muted">
              Option media: interim URL / mediaId until SF-28 Payload picker.
            </p>
          </aside>

          <div className="gantry-sections sf-form-sections" aria-label="Form canvas">
            <div className="gantry-section-actions">
              <button
                type="button"
                className="gantry-toolbar-btn secondary"
                onClick={() => {
                  const sec = createSectionDraft(`Section ${sections.length + 1}`)
                  setSections([...sections, sec])
                  saveDebounced()
                }}
              >
                Add section
              </button>
            </div>
            {sections.map((section) => {
              const sectionFields = section.fieldNames
                .map((n) => fields.find((f) => f.name === n))
                .filter((f): f is FormFieldDef => Boolean(f))
              const sortableIds = sectionFields.map((f) => f.id || f.name)
              return (
                <section key={section.id} className="gantry-section">
                  <header className="gantry-section-head">
                    <div className="gantry-section-title">
                      <input
                        type="text"
                        className="gantry-section-name-input"
                        value={section.label}
                        onChange={(e) => {
                          setSections(
                            sections.map((s) =>
                              s.id === section.id ? { ...s, label: e.target.value } : s,
                            ),
                          )
                          saveDebounced()
                        }}
                        onBlur={saveNow}
                        aria-label="Section label"
                      />
                    </div>
                    <div className="gantry-section-actions">
                      {sections.length > 1 ? (
                        <button
                          type="button"
                          className="gantry-toolbar-btn danger"
                          onClick={() => {
                            const orphan = section.fieldNames
                            const remaining = sections.filter((s) => s.id !== section.id)
                            if (!remaining[0]) return
                            remaining[0] = {
                              ...remaining[0],
                              fieldNames: [...remaining[0].fieldNames, ...orphan],
                            }
                            setSections(remaining)
                            saveDebounced()
                          }}
                        >
                          Remove section
                        </button>
                      ) : null}
                    </div>
                  </header>
                  <div className="gantry-row sf-form-section-row">
                    {sectionFields.length === 0 ? (
                      <p className="gantry-drop-empty admin-empty">
                        Drop fields here — add from the palette.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => onDragEnd(e, section.id)}
                      >
                        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                          <div className="sf-form-section-fields">
                            {sectionFields.map((field) => {
                              const id = field.id || field.name
                              return (
                                <SortableFieldBar
                                  key={id}
                                  field={field}
                                  selected={id === selectedId}
                                  onSelect={() => setSelectedId(id)}
                                  onRemove={() => {
                                    const next = fields.filter((f) => (f.id || f.name) !== id)
                                    const nextSections = sections.map((s) => ({
                                      ...s,
                                      fieldNames: s.fieldNames.filter((n) => n !== field.name),
                                    }))
                                    if (selectedId === id) {
                                      setSelectedId(next[0]?.id || next[0]?.name || null)
                                    }
                                    updateFields(next, nextSections)
                                  }}
                                />
                              )
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </section>
              )
            })}
          </div>

          <aside className="sf-form-builder-inspector gantry-typed-form" aria-label="Field settings">
            <h3>Inspector</h3>
            {!selected ? (
              <p className="layout-muted">Select a field bar to edit (Layout cog pattern).</p>
            ) : (
              <>
                <label>
                  <span>Label</span>
                  <input
                    type="text"
                    value={selected.label}
                    onChange={(e) => patchSelected({ label: e.target.value })}
                    onBlur={saveNow}
                  />
                </label>
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => {
                      const nextName = e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_:-]/g, '')
                      const prev = selected.name
                      const nextFields = fields.map((f) =>
                        (f.id || f.name) === (selected.id || selected.name)
                          ? { ...f, name: nextName }
                          : f,
                      )
                      const nextSections = sections.map((s) => ({
                        ...s,
                        fieldNames: s.fieldNames.map((n) => (n === prev ? nextName : n)),
                      }))
                      updateFields(nextFields, nextSections)
                    }}
                    onBlur={saveNow}
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={selected.type}
                    onChange={(e) => {
                      const type = e.target.value as FormFieldType
                      const next: Partial<FormFieldDef> = {
                        type,
                        options: OPTION_TYPES.has(type)
                          ? selected.options ?? [
                              { value: 'option_a', label: 'Option A' },
                              { value: 'option_b', label: 'Option B' },
                            ]
                          : undefined,
                        computed:
                          type === 'computed'
                            ? selected.computed ?? { expression: '0', precision: 2 }
                            : undefined,
                      }
                      if (isDateTimeFieldType(type)) {
                        next.constraints = normalizeDateTimeConstraints(
                          type,
                          selected.constraints ?? {},
                        )
                      } else {
                        next.constraints = undefined
                      }
                      patchSelected(next)
                      queueMicrotask(saveNow)
                    }}
                  >
                    {FIELD_PALETTE.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!isDateTimeFieldType(selected.type) && selected.type !== 'computed' ? (
                  <label>
                    <span>Placeholder</span>
                    <input
                      type="text"
                      value={selected.placeholder ?? ''}
                      onChange={(e) => patchSelected({ placeholder: e.target.value })}
                      onBlur={saveNow}
                    />
                  </label>
                ) : null}
                <label>
                  <span>Help text</span>
                  <input
                    type="text"
                    value={selected.description ?? ''}
                    onChange={(e) => patchSelected({ description: e.target.value })}
                    onBlur={saveNow}
                  />
                </label>
                <label className="gantry-typed-check">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.required)}
                    onChange={(e) => {
                      patchSelected({ required: e.target.checked })
                      queueMicrotask(saveNow)
                    }}
                  />
                  <span>Required</span>
                </label>

                {OPTION_TYPES.has(selected.type) ? (
                  <fieldset className="sf-form-builder-constraints">
                    <legend>Options + media</legend>
                    <p className="layout-muted">
                      value|label|url|mediaId|alt per line (URL / id interim until SF-28).
                    </p>
                    <textarea
                      rows={5}
                      value={(selected.options ?? [])
                        .map((o) => {
                          const parts = [o.value, o.label]
                          if (o.media?.url) parts.push(o.media.url)
                          else parts.push('')
                          if (o.media?.mediaId) parts.push(o.media.mediaId)
                          else parts.push('')
                          if (o.media?.alt) parts.push(o.media.alt)
                          return parts.join('|')
                        })
                        .join('\n')}
                      onChange={(e) => {
                        const options = e.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [value, label, url, mediaId, alt] = line.split('|')
                            const opt: FormFieldOption = {
                              value: (value ?? '').trim(),
                              label: (label ?? value ?? '').trim() || (value ?? '').trim(),
                            }
                            const mediaUrl = url?.trim()
                            const mid = mediaId?.trim()
                            const malt = alt?.trim()
                            if (mediaUrl || mid) {
                              opt.media = {
                                ...(mediaUrl ? { url: mediaUrl } : {}),
                                ...(mid ? { mediaId: mid } : {}),
                                ...(malt ? { alt: malt } : {}),
                                kind: 'image',
                              }
                            }
                            return opt
                          })
                          .filter((o) => o.value)
                        updateOptions(options)
                      }}
                      onBlur={saveNow}
                      spellCheck={false}
                    />
                  </fieldset>
                ) : null}

                {isDateTimeFieldType(selected.type) ? (
                  <fieldset className="sf-form-builder-constraints">
                    <legend>Date / time constraints</legend>
                    <label>
                      <span>Minimum</span>
                      <input
                        type={htmlInputTypeForField(selected.type)!}
                        value={selected.constraints?.min ?? ''}
                        onChange={(e) =>
                          patchSelectedConstraints({ min: e.target.value || undefined })
                        }
                        onBlur={saveNow}
                      />
                    </label>
                    <label>
                      <span>Maximum</span>
                      <input
                        type={htmlInputTypeForField(selected.type)!}
                        value={selected.constraints?.max ?? ''}
                        onChange={(e) =>
                          patchSelectedConstraints({ max: e.target.value || undefined })
                        }
                        onBlur={saveNow}
                      />
                    </label>
                    {selected.type !== 'time' ? (
                      <>
                        <div className="sf-form-builder-weekdays">
                          <span className="sf-form-builder-constraints-label">Weekdays</span>
                          <ul className="sf-form-builder-weekday-list">
                            {FORM_WEEKDAY_LABELS.map((day) => {
                              const checked = Boolean(
                                selected.constraints?.weekdays?.includes(day.value),
                              )
                              return (
                                <li key={day.value}>
                                  <label className="gantry-typed-check">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const current = new Set<FormWeekday>(
                                          selected.constraints?.weekdays ?? [],
                                        )
                                        if (e.target.checked) current.add(day.value)
                                        else current.delete(day.value)
                                        patchSelectedConstraints({
                                          weekdays: [...current] as FormWeekday[],
                                        })
                                        queueMicrotask(saveNow)
                                      }}
                                    />
                                    <span>{day.short}</span>
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                        <label>
                          <span>Days of month</span>
                          <input
                            type="text"
                            placeholder="1, 15, 28"
                            value={(selected.constraints?.daysOfMonth ?? []).join(', ')}
                            onChange={(e) => {
                              const parts = e.target.value
                                .split(/[\s,]+/)
                                .map((p) => p.trim())
                                .filter(Boolean)
                              patchSelectedConstraints({
                                daysOfMonth: normalizeDaysOfMonth(parts.map((p) => Number(p))),
                              })
                            }}
                            onBlur={saveNow}
                          />
                        </label>
                      </>
                    ) : null}
                  </fieldset>
                ) : null}

                {selected.type === 'computed' || selected.type === 'number' ? (
                  <fieldset className="sf-form-builder-constraints">
                    <legend>Math</legend>
                    {selected.type === 'computed' ? (
                      <>
                        <label>
                          <span>Expression</span>
                          <input
                            type="text"
                            value={selected.computed?.expression ?? ''}
                            placeholder="price * qty"
                            onChange={(e) =>
                              patchSelected({
                                computed: {
                                  expression: e.target.value,
                                  precision: selected.computed?.precision ?? 2,
                                },
                              })
                            }
                            onBlur={saveNow}
                            spellCheck={false}
                          />
                        </label>
                        <label>
                          <span>Precision</span>
                          <input
                            type="number"
                            min={0}
                            max={8}
                            value={selected.computed?.precision ?? 2}
                            onChange={(e) =>
                              patchSelected({
                                computed: {
                                  expression: selected.computed?.expression ?? '0',
                                  precision: Number(e.target.value) || 0,
                                },
                              })
                            }
                            onBlur={saveNow}
                          />
                        </label>
                      </>
                    ) : null}
                    <label>
                      <span>Min (static)</span>
                      <input
                        type="number"
                        value={selected.numberBounds?.min ?? ''}
                        onChange={(e) =>
                          patchSelected({
                            numberBounds: {
                              ...selected.numberBounds,
                              min: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        onBlur={saveNow}
                      />
                    </label>
                    <label>
                      <span>Max (static)</span>
                      <input
                        type="number"
                        value={selected.numberBounds?.max ?? ''}
                        onChange={(e) =>
                          patchSelected({
                            numberBounds: {
                              ...selected.numberBounds,
                              max: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        onBlur={saveNow}
                      />
                    </label>
                    <label>
                      <span>Min expression</span>
                      <input
                        type="text"
                        value={selected.numberBounds?.minExpr ?? ''}
                        placeholder="min(a, b)"
                        onChange={(e) =>
                          patchSelected({
                            numberBounds: {
                              ...selected.numberBounds,
                              minExpr: e.target.value || undefined,
                            },
                          })
                        }
                        onBlur={saveNow}
                        spellCheck={false}
                      />
                    </label>
                    <label>
                      <span>Max expression</span>
                      <input
                        type="text"
                        value={selected.numberBounds?.maxExpr ?? ''}
                        onChange={(e) =>
                          patchSelected({
                            numberBounds: {
                              ...selected.numberBounds,
                              maxExpr: e.target.value || undefined,
                            },
                          })
                        }
                        onBlur={saveNow}
                        spellCheck={false}
                      />
                    </label>
                    <label>
                      <span>Validate expression</span>
                      <input
                        type="text"
                        value={selected.validateExpr?.expression ?? ''}
                        placeholder="total >= 10"
                        onChange={(e) =>
                          patchSelected({
                            validateExpr: e.target.value
                              ? {
                                  expression: e.target.value,
                                  message: selected.validateExpr?.message,
                                }
                              : undefined,
                          })
                        }
                        onBlur={saveNow}
                        spellCheck={false}
                      />
                    </label>
                    <label>
                      <span>Validate message</span>
                      <input
                        type="text"
                        value={selected.validateExpr?.message ?? ''}
                        onChange={(e) =>
                          patchSelected({
                            validateExpr: selected.validateExpr?.expression
                              ? {
                                  expression: selected.validateExpr.expression,
                                  message: e.target.value || undefined,
                                }
                              : undefined,
                          })
                        }
                        onBlur={saveNow}
                      />
                    </label>
                  </fieldset>
                ) : null}

                <fieldset className="sf-form-builder-constraints">
                  <legend>Conditional logic</legend>
                  <p className="layout-muted">Show / require when other fields match.</p>
                  {(['showWhen', 'requireWhen'] as const).map((key) => {
                    const group = selected.logic?.[key] ?? emptyGroup()
                    const enabled = Boolean(selected.logic?.[key])
                    return (
                      <div key={key} className="sf-form-logic-block">
                        <label className="gantry-typed-check">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              patchLogicGroup(key, e.target.checked ? emptyGroup() : undefined)
                              queueMicrotask(saveNow)
                            }}
                          />
                          <span>{key === 'showWhen' ? 'Show when' : 'Require when'}</span>
                        </label>
                        {enabled ? (
                          <>
                            <label>
                              <span>Match</span>
                              <select
                                value={group.logic}
                                onChange={(e) => {
                                  patchLogicGroup(key, {
                                    ...group,
                                    logic: e.target.value === 'or' ? 'or' : 'and',
                                  })
                                  queueMicrotask(saveNow)
                                }}
                              >
                                <option value="and">all (AND)</option>
                                <option value="or">any (OR)</option>
                              </select>
                            </label>
                            {group.conditions.map((cond, idx) => (
                              <div key={idx} className="sf-form-logic-row">
                                <select
                                  value={cond.field}
                                  onChange={(e) => {
                                    const conditions = group.conditions.map((c, i) =>
                                      i === idx ? { ...c, field: e.target.value } : c,
                                    )
                                    patchLogicGroup(key, { ...group, conditions })
                                    queueMicrotask(saveNow)
                                  }}
                                >
                                  <option value="">Field…</option>
                                  {fields
                                    .filter((f) => f.name !== selected.name)
                                    .map((f) => (
                                      <option key={f.name} value={f.name}>
                                        {f.label || f.name}
                                      </option>
                                    ))}
                                </select>
                                <select
                                  value={cond.op}
                                  onChange={(e) => {
                                    const conditions = group.conditions.map((c, i) =>
                                      i === idx
                                        ? { ...c, op: e.target.value as FormConditionOp }
                                        : c,
                                    )
                                    patchLogicGroup(key, { ...group, conditions })
                                    queueMicrotask(saveNow)
                                  }}
                                >
                                  {FORM_CONDITION_OP_LABELS.map((op) => (
                                    <option key={op.value} value={op.value}>
                                      {op.label}
                                    </option>
                                  ))}
                                </select>
                                {cond.op !== 'empty' && cond.op !== 'notEmpty' ? (
                                  <input
                                    type="text"
                                    value={
                                      Array.isArray(cond.value)
                                        ? cond.value.join(',')
                                        : (cond.value ?? '')
                                    }
                                    onChange={(e) => {
                                      const conditions = group.conditions.map((c, i) =>
                                        i === idx ? { ...c, value: e.target.value } : c,
                                      ) as FormCondition[]
                                      patchLogicGroup(key, { ...group, conditions })
                                    }}
                                    onBlur={saveNow}
                                    placeholder="value"
                                  />
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="gantry-toolbar-btn secondary"
                              onClick={() => {
                                patchLogicGroup(key, {
                                  ...group,
                                  conditions: [
                                    ...group.conditions,
                                    { field: '', op: 'eq', value: '' },
                                  ],
                                })
                                queueMicrotask(saveNow)
                              }}
                            >
                              Add condition
                            </button>
                          </>
                        ) : null}
                      </div>
                    )
                  })}
                </fieldset>
              </>
            )}

            <fieldset className="sf-form-builder-constraints">
              <legend>Email on submit</legend>
              <p className="layout-muted">
                Transport is stubbed until platform email is ready — settings still save.
              </p>
              <label className="gantry-typed-check">
                <input
                  type="checkbox"
                  checked={Boolean(emailNotify.notifyAdmin)}
                  onChange={(e) => {
                    setEmailNotify({ ...emailNotify, notifyAdmin: e.target.checked })
                    queueMicrotask(saveNow)
                  }}
                />
                <span>Notify admin</span>
              </label>
              <label className="gantry-typed-check">
                <input
                  type="checkbox"
                  checked={Boolean(emailNotify.notifyRespondent)}
                  onChange={(e) => {
                    setEmailNotify({ ...emailNotify, notifyRespondent: e.target.checked })
                    queueMicrotask(saveNow)
                  }}
                />
                <span>Notify respondent</span>
              </label>
              <label>
                <span>Respondent email field</span>
                <input
                  type="text"
                  value={emailNotify.respondentEmailField ?? 'email'}
                  onChange={(e) =>
                    setEmailNotify({ ...emailNotify, respondentEmailField: e.target.value })
                  }
                  onBlur={saveNow}
                />
              </label>
              <label>
                <span>Admin emails override</span>
                <input
                  type="text"
                  value={(emailNotify.adminEmails ?? []).join(', ')}
                  placeholder="Leave empty → Forms Settings default"
                  onChange={(e) =>
                    setEmailNotify({
                      ...emailNotify,
                      adminEmails: e.target.value
                        .split(/[,;\s]+/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  onBlur={saveNow}
                />
              </label>
            </fieldset>
          </aside>
        </div>

        <section className="sf-form-builder-schema" aria-label="JSON Schema">
          <div className="sf-form-builder-schema-head">
            <h3>JSON Schema</h3>
            <div className="sf-form-builder-schema-actions">
              {schemaDirty ? (
                <button
                  type="button"
                  className="gantry-toolbar-btn secondary"
                  onClick={resetSchemaFromFields}
                >
                  Reset from fields
                </button>
              ) : (
                <span className="layout-muted">Synced from fields</span>
              )}
            </div>
          </div>
          <textarea
            className="sf-form-builder-schema-editor"
            rows={14}
            value={schemaJson}
            onChange={(e) => applySchemaJson(e.target.value)}
            onBlur={saveNow}
            spellCheck={false}
          />
          {schemaError ? (
            <p className="admin-inline-error" role="alert">
              {schemaError}
            </p>
          ) : null}
        </section>

        {pending ? <p className="layout-muted">Saving…</p> : null}
        {state.error ? (
          <p className="admin-inline-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  )
}
