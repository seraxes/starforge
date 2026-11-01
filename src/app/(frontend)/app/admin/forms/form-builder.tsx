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
import { createFieldDraft } from '@/core/forms/definition'
import { FORM_PRESETS } from '@/core/forms/presets'
import { fieldsToJsonSchema, stringifyFormJsonSchema } from '@/core/forms/schema-json'
import type {
  FormDefinitionDocument,
  FormFieldDef,
  FormFieldType,
  FormPresetId,
} from '@/core/forms/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'

const FIELD_PALETTE: { type: FormFieldType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'email', label: 'Email' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'tel', label: 'Phone' },
  { type: 'url', label: 'URL' },
  { type: 'select', label: 'Select' },
  { type: 'checkbox', label: 'Checkbox' },
]

const initial: FormAdminActionState = {}

type Props = {
  formId: string
  initialDocument: FormDefinitionDocument
}

function SortableFieldRow({
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
    <li
      ref={setNodeRef}
      style={style}
      className={`sf-form-builder-field${selected ? ' is-selected' : ''}`}
    >
      <button
        type="button"
        className="sf-form-builder-drag"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="sf-form-builder-field-main" onClick={onSelect}>
        <strong>{field.label || field.name}</strong>
        <span className="layout-muted">
          {field.type}
          {field.required ? ' · required' : ''}
          {' · '}
          <code>{field.name}</code>
        </span>
      </button>
      <button
        type="button"
        className="gantry-toolbar-btn danger sf-form-builder-remove"
        onClick={onRemove}
        aria-label={`Remove ${field.label || field.name}`}
      >
        ×
      </button>
    </li>
  )
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
  const [fields, setFields] = useState<FormFieldDef[]>(() =>
    initialDocument.fields.map((f) => ({
      ...f,
      id: f.id || `fld_${f.name}`,
    })),
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

  function updateFields(next: FormFieldDef[]) {
    setFields(next)
    regenerateSchema(next)
    saveDebounced()
  }

  function addField(type: FormFieldType) {
    const draft = createFieldDraft(type)
    // Ensure unique name
    const names = new Set(fields.map((f) => f.name))
    let name = draft.name
    let n = 2
    while (names.has(name)) {
      name = `${draft.name}_${n}`
      n += 1
    }
    draft.name = name
    const next = [...fields, draft]
    setSelectedId(draft.id || draft.name)
    updateFields(next)
  }

  function patchSelected(patch: Partial<FormFieldDef>) {
    if (!selected) return
    const id = selected.id || selected.name
    const next = fields.map((f) => ((f.id || f.name) === id ? { ...f, ...patch } : f))
    updateFields(next)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex((f) => (f.id || f.name) === active.id)
    const newIndex = fields.findIndex((f) => (f.id || f.name) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    updateFields(arrayMove(fields, oldIndex, newIndex))
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
    const next = stringifyFormJsonSchema(
      fieldsToJsonSchema(fields, {
        title,
        description: description || undefined,
      }),
    )
    setSchemaJson(next)
    saveDebounced()
  }

  const sortableIds = fields.map((f) => f.id || f.name)

  return (
    <div className="sf-form-builder">
      <p className="admin-lede">
        <Link href="/app/admin/forms">← Forms</Link>
        {' · '}
        Visual builder (dnd-kit) → fields + JSON Schema. Autosaves with the global Saved toast.
      </p>

      <form
        ref={formRef}
        action={formAction}
        className="sf-form-builder-form"
        onChange={(e) => {
          const t = e.target as HTMLElement
          if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') {
            // Debounce handled by field handlers; avoid double-submit on every bubble.
          }
        }}
      >
        <input type="hidden" name="formId" value={formId} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />
        <input type="hidden" name="schemaJson" value={schemaJson} />
        <input type="hidden" name="schemaDirty" value={schemaDirty ? '1' : '0'} />
        <input type="hidden" name="preset" value={preset} />

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

        <div className="sf-form-builder-grid">
          <aside className="sf-form-builder-palette" aria-label="Field types">
            <h3>Add field</h3>
            <ul>
              {FIELD_PALETTE.map((item) => (
                <li key={item.type}>
                  <button
                    type="button"
                    className="gantry-toolbar-btn secondary"
                    onClick={() => addField(item.type)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="layout-muted">
              Media / file fields bind later to Payload media (SF-28) — not a second library.
            </p>
          </aside>

          <section className="sf-form-builder-canvas" aria-label="Form fields">
            <h3>Fields</h3>
            {fields.length === 0 ? (
              <p className="admin-empty">No fields yet — add from the palette.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <ul className="sf-form-builder-list">
                    {fields.map((field) => {
                      const id = field.id || field.name
                      return (
                        <SortableFieldRow
                          key={id}
                          field={field}
                          selected={id === selectedId}
                          onSelect={() => setSelectedId(id)}
                          onRemove={() => {
                            const next = fields.filter((f) => (f.id || f.name) !== id)
                            if (selectedId === id) {
                              setSelectedId(next[0]?.id || next[0]?.name || null)
                            }
                            updateFields(next)
                          }}
                        />
                      )
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>

          <section className="sf-form-builder-inspector gantry-typed-form" aria-label="Field settings">
            <h3>Field</h3>
            {!selected ? (
              <p className="layout-muted">Select a field to edit.</p>
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
                    onChange={(e) =>
                      patchSelected({
                        name: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '_')
                          .replace(/[^a-z0-9_:-]/g, ''),
                      })
                    }
                    onBlur={saveNow}
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={selected.type}
                    onChange={(e) => {
                      const type = e.target.value as FormFieldType
                      patchSelected({
                        type,
                        options:
                          type === 'select'
                            ? selected.options ?? [
                                { value: 'option_a', label: 'Option A' },
                                { value: 'option_b', label: 'Option B' },
                              ]
                            : undefined,
                      })
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
                <label>
                  <span>Placeholder</span>
                  <input
                    type="text"
                    value={selected.placeholder ?? ''}
                    onChange={(e) => patchSelected({ placeholder: e.target.value })}
                    onBlur={saveNow}
                  />
                </label>
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
                {selected.type === 'select' ? (
                  <label>
                    <span>Options (value|label per line)</span>
                    <textarea
                      rows={4}
                      value={(selected.options ?? [])
                        .map((o) => `${o.value}|${o.label}`)
                        .join('\n')}
                      onChange={(e) => {
                        const options = e.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [value, ...rest] = line.split('|')
                            const label = rest.join('|').trim() || value!.trim()
                            return { value: value!.trim(), label }
                          })
                        patchSelected({ options })
                      }}
                      onBlur={saveNow}
                      spellCheck={false}
                    />
                  </label>
                ) : null}
              </>
            )}
          </section>
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
            rows={16}
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
