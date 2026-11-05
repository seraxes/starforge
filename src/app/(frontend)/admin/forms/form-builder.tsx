'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

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
import { listFormPresetMetas } from '@/core/forms/presets'
import {
  addFieldToRow,
  appendFieldRow,
  mergeRows,
  moveFieldInSections,
  removeFieldFromSections,
  renameFieldInSections,
  resizeRowColumns,
  sectionFieldNames,
  splitFieldToOwnRow,
  LAYOUT_WIDTH_FULL,
} from '@/core/forms/rows'
import { fieldsToJsonSchema, stringifyFormJsonSchema } from '@/core/forms/schema-json'
import { resizeAdjacentPair, widthToPercentLabel } from '@/core/modules/grid'
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
  FormRowDef,
  FormSectionDef,
  FormWeekday,
} from '@/core/forms/types'

import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import { MediaPicker } from '@/modules/media/api'

import { useNotifySavedOnOk } from '../admin-toast'
import { ParticleSettingsPopover } from '../layouts/particle-settings-popover'
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
  { type: 'file', label: 'File', hint: 'Upload → Media' },
  { type: 'hidden', label: 'Hidden', hint: 'Default value' },
  { type: 'computed', label: 'Computed', hint: 'Math expression' },
  { type: 'captcha', label: 'Captcha', hint: 'Turnstile widget' },
]

const STRING_CONSTRAINT_TYPES = new Set<FormFieldType>([
  'text',
  'email',
  'textarea',
  'tel',
  'url',
  'hidden',
])

const OPTION_TYPES = new Set<FormFieldType>(['select', 'radio', 'checkbox-group'])

const initial: FormAdminActionState = {}

/** Site Settings → Security snapshot for builder warnings (no secrets). */
export type FormBuilderSiteCaptcha = {
  enabled: boolean
  provider: string
  /** Turnstile site + secret both present in env. */
  configured: boolean
}

type Props = {
  formId: string
  initialDocument: FormDefinitionDocument
  siteCaptcha?: FormBuilderSiteCaptcha
}

function emptyGroup(): FormConditionGroup {
  return { logic: 'and', conditions: [{ field: '', op: 'eq', value: '' }] }
}

function fieldKey(field: FormFieldDef) {
  return field.id || field.name
}

type FieldSettingsProps = {
  field: FormFieldDef
  fields: FormFieldDef[]
  onPatch: (patch: Partial<FormFieldDef>) => void
  onRename: (nextName: string) => void
  onPatchConstraints: (patch: Partial<FormDateTimeConstraints>) => void
  onUpdateOptions: (options: FormFieldOption[]) => void
  onPatchLogic: (key: 'showWhen' | 'requireWhen', group: FormConditionGroup | undefined) => void
  onRemove: () => void
  saveNow: () => void
  /** Blur flush — no-op unless a real edit marked the form dirty. */
  flushOnBlur: () => void
  siteCaptcha?: FormBuilderSiteCaptcha
  /** Column width percent when sitting in a multi-column row. */
  widthPercent?: number
  /** Split this column out to its own full-width row. */
  onSplitToOwnRow?: () => void
  /** Merge this field's row with the next row (side-by-side). */
  onJoinNextRow?: () => void
  canSplit?: boolean
  canJoinNext?: boolean
  /** Layout-like slot drop edge while dragging another field over this one. */
  dropEdge?: 'before' | 'after' | null
}

function captchaSiteStatusMessage(siteCaptcha?: FormBuilderSiteCaptcha): string | null {
  if (!siteCaptcha) return null
  if (!siteCaptcha.enabled || siteCaptcha.provider === 'none') {
    return 'Site captcha is off (Settings → Security). This field stays idle on public forms until enabled.'
  }
  if (siteCaptcha.provider === 'turnstile' && !siteCaptcha.configured) {
    return 'Turnstile keys missing in Environment (NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY).'
  }
  if (siteCaptcha.provider !== 'turnstile') {
    return `${siteCaptcha.provider} is selected but not implemented yet — field stays idle.`
  }
  return null
}

/** Field config body — same content as the old right inspector, for the Layout cog popup. */
function FieldSettingsBody({
  field,
  fields,
  onPatch,
  onRename,
  onPatchConstraints,
  onUpdateOptions,
  onPatchLogic,
  saveNow,
  flushOnBlur,
  siteCaptcha,
}: Omit<FieldSettingsProps, 'onRemove'>) {
  const captchaWarn = field.type === 'captcha' ? captchaSiteStatusMessage(siteCaptcha) : null
  return (
    <div className="gantry-typed-form sf-form-field-cog-body">
      {field.type === 'captcha' ? (
        <p className={captchaWarn ? 'admin-inline-error' : 'layout-muted'} role={captchaWarn ? 'alert' : undefined}>
          {captchaWarn
            ? captchaWarn
            : 'Renders Cloudflare Turnstile using Site Settings → Security. Keys stay in Environment.'}
        </p>
      ) : null}
      <label>
        <span>Label</span>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          onBlur={flushOnBlur}
        />
      </label>
      <label>
        <span>Name</span>
        <input
          type="text"
          value={field.name}
          onChange={(e) => {
            const nextName = e.target.value
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_:-]/g, '')
            onRename(nextName)
          }}
          onBlur={flushOnBlur}
        />
      </label>
      <label>
        <span>Type</span>
        <select
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FormFieldType
            const next: Partial<FormFieldDef> = {
              type,
              options: OPTION_TYPES.has(type)
                ? field.options ?? [
                    { value: 'option_a', label: 'Option A' },
                    { value: 'option_b', label: 'Option B' },
                  ]
                : undefined,
              computed:
                type === 'computed'
                  ? field.computed ?? { expression: '0', precision: 2 }
                  : undefined,
              upload:
                type === 'file'
                  ? field.upload ?? {
                      accept: 'image/png,image/jpeg,image/gif,image/webp,application/pdf',
                      maxSizeBytes: 10 * 1024 * 1024,
                    }
                  : undefined,
              stringConstraints: STRING_CONSTRAINT_TYPES.has(type)
                ? field.stringConstraints
                : undefined,
              defaultValue:
                type === 'hidden'
                  ? field.defaultValue ?? ''
                  : field.defaultValue,
            }
            if (isDateTimeFieldType(type)) {
              next.constraints = normalizeDateTimeConstraints(type, field.constraints ?? {})
            } else {
              next.constraints = undefined
            }
            if (type === 'hidden' || type === 'computed' || type === 'captcha') {
              next.required = false
            }
            onPatch(next)
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
      {!isDateTimeFieldType(field.type) &&
      field.type !== 'computed' &&
      field.type !== 'hidden' &&
      field.type !== 'file' &&
      field.type !== 'captcha' ? (
        <label>
          <span>Placeholder</span>
          <input
            type="text"
            value={field.placeholder ?? ''}
            onChange={(e) => onPatch({ placeholder: e.target.value })}
            onBlur={flushOnBlur}
          />
        </label>
      ) : null}
      {field.type === 'hidden' ||
      field.type === 'text' ||
      field.type === 'email' ||
      field.type === 'tel' ||
      field.type === 'url' ||
      field.type === 'textarea' ||
      field.type === 'number' ? (
        <label>
          <span>{field.type === 'hidden' ? 'Default value' : 'Default value (optional)'}</span>
          <input
            type="text"
            value={field.defaultValue ?? ''}
            onChange={(e) => onPatch({ defaultValue: e.target.value })}
            onBlur={flushOnBlur}
            placeholder={field.type === 'hidden' ? 'tracking / context value' : undefined}
          />
        </label>
      ) : null}
      <label>
        <span>Help text</span>
        <input
          type="text"
          value={field.description ?? ''}
          onChange={(e) => onPatch({ description: e.target.value })}
          onBlur={flushOnBlur}
        />
      </label>
      {field.type !== 'hidden' && field.type !== 'computed' && field.type !== 'captcha' ? (
        <label className="gantry-typed-check">
          <input
            type="checkbox"
            checked={Boolean(field.required)}
            onChange={(e) => {
              onPatch({ required: e.target.checked })
              queueMicrotask(saveNow)
            }}
          />
          <span>Required</span>
        </label>
      ) : null}

      {OPTION_TYPES.has(field.type) ? (
        <fieldset className="sf-form-builder-constraints">
          <legend>Options + media</legend>
          <p className="layout-muted">
            Library Media id is primary per option; raw URL remains advanced fallback.
          </p>
          <ul className="sf-form-option-editor-list">
            {(field.options ?? []).map((opt, index) => (
              <li key={`${field.id ?? field.name}-opt-${index}`} className="sf-form-option-editor-row">
                <label>
                  <span>Value</span>
                  <input
                    type="text"
                    value={opt.value}
                    onChange={(e) => {
                      const next = [...(field.options ?? [])]
                      next[index] = { ...opt, value: e.target.value }
                      onUpdateOptions(next.filter((o) => o.value.trim()))
                    }}
                    onBlur={flushOnBlur}
                  />
                </label>
                <label>
                  <span>Label</span>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...(field.options ?? [])]
                      next[index] = { ...opt, label: e.target.value }
                      onUpdateOptions(next)
                    }}
                    onBlur={flushOnBlur}
                  />
                </label>
                <MediaPicker
                  label="Option media"
                  value={{
                    mediaId: opt.media?.mediaId ?? '',
                    url: opt.media?.url ?? '',
                    alt: opt.media?.alt ?? '',
                  }}
                  defaultFolder="forms"
                  defaultPurpose="other"
                  includeHiddenInputs={false}
                  onChange={(media) => {
                    const next = [...(field.options ?? [])]
                    const hasMedia = Boolean(media.mediaId || media.url)
                    next[index] = {
                      ...opt,
                      media: hasMedia
                        ? {
                            ...(media.mediaId ? { mediaId: media.mediaId } : {}),
                            ...(media.url ? { url: media.url } : {}),
                            ...(media.alt ? { alt: media.alt } : {}),
                            kind: 'image',
                          }
                        : undefined,
                    }
                    onUpdateOptions(next)
                    queueMicrotask(saveNow)
                  }}
                />
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  onClick={() => {
                    const next = (field.options ?? []).filter((_, i) => i !== index)
                    onUpdateOptions(next)
                    queueMicrotask(saveNow)
                  }}
                >
                  Remove option
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            onClick={() => {
              const n = (field.options ?? []).length + 1
              onUpdateOptions([
                ...(field.options ?? []),
                { value: `option-${n}`, label: `Option ${n}` },
              ])
              queueMicrotask(saveNow)
            }}
          >
            Add option
          </button>
        </fieldset>
      ) : null}

      {isDateTimeFieldType(field.type) ? (
        <fieldset className="sf-form-builder-constraints">
          <legend>Date / time constraints</legend>
          <label>
            <span>Minimum</span>
            <input
              type={htmlInputTypeForField(field.type)!}
              value={field.constraints?.min ?? ''}
              onChange={(e) => onPatchConstraints({ min: e.target.value || undefined })}
              onBlur={flushOnBlur}
            />
          </label>
          <label>
            <span>Maximum</span>
            <input
              type={htmlInputTypeForField(field.type)!}
              value={field.constraints?.max ?? ''}
              onChange={(e) => onPatchConstraints({ max: e.target.value || undefined })}
              onBlur={flushOnBlur}
            />
          </label>
          {field.type !== 'time' ? (
            <>
              <div className="sf-form-builder-weekdays">
                <span className="sf-form-builder-constraints-label">Weekdays</span>
                <ul className="sf-form-builder-weekday-list">
                  {FORM_WEEKDAY_LABELS.map((day) => {
                    const checked = Boolean(field.constraints?.weekdays?.includes(day.value))
                    return (
                      <li key={day.value}>
                        <label className="gantry-typed-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = new Set<FormWeekday>(field.constraints?.weekdays ?? [])
                              if (e.target.checked) current.add(day.value)
                              else current.delete(day.value)
                              onPatchConstraints({
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
                  value={(field.constraints?.daysOfMonth ?? []).join(', ')}
                  onChange={(e) => {
                    const parts = e.target.value
                      .split(/[\s,]+/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                    onPatchConstraints({
                      daysOfMonth: normalizeDaysOfMonth(parts.map((p) => Number(p))),
                    })
                  }}
                  onBlur={flushOnBlur}
                />
              </label>
            </>
          ) : null}
        </fieldset>
      ) : null}

      {field.type === 'file' ? (
        <fieldset className="sf-form-builder-constraints">
          <legend>Upload → Media</legend>
          <p className="layout-muted">
            Files land in the Payload Media library (folder Forms). Submission stores the media id.
          </p>
          <label>
            <span>Accept</span>
            <input
              type="text"
              value={field.upload?.accept ?? ''}
              placeholder="image/png,image/jpeg,application/pdf"
              onChange={(e) =>
                onPatch({
                  upload: {
                    ...field.upload,
                    accept: e.target.value || undefined,
                  },
                })
              }
              onBlur={flushOnBlur}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Max size (MB)</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={
                field.upload?.maxSizeBytes != null
                  ? Math.round((field.upload.maxSizeBytes / (1024 * 1024)) * 10) / 10
                  : 10
              }
              onChange={(e) => {
                const mb = Number(e.target.value)
                onPatch({
                  upload: {
                    ...field.upload,
                    maxSizeBytes:
                      Number.isFinite(mb) && mb > 0
                        ? Math.floor(mb * 1024 * 1024)
                        : undefined,
                  },
                })
              }}
              onBlur={flushOnBlur}
            />
          </label>
        </fieldset>
      ) : null}

      {STRING_CONSTRAINT_TYPES.has(field.type) ? (
        <fieldset className="sf-form-builder-constraints">
          <legend>String validation</legend>
          <label>
            <span>Min length</span>
            <input
              type="number"
              min={0}
              value={field.stringConstraints?.minLength ?? ''}
              onChange={(e) =>
                onPatch({
                  stringConstraints: {
                    ...field.stringConstraints,
                    minLength:
                      e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                  },
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
          <label>
            <span>Max length</span>
            <input
              type="number"
              min={0}
              value={field.stringConstraints?.maxLength ?? ''}
              onChange={(e) =>
                onPatch({
                  stringConstraints: {
                    ...field.stringConstraints,
                    maxLength:
                      e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                  },
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
          <label>
            <span>Pattern (RegExp)</span>
            <input
              type="text"
              value={field.stringConstraints?.pattern ?? ''}
              placeholder="^[A-Z0-9_-]+$"
              onChange={(e) =>
                onPatch({
                  stringConstraints: {
                    ...field.stringConstraints,
                    pattern: e.target.value || undefined,
                  },
                })
              }
              onBlur={flushOnBlur}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Pattern message</span>
            <input
              type="text"
              value={field.stringConstraints?.patternMessage ?? ''}
              onChange={(e) =>
                onPatch({
                  stringConstraints: {
                    ...field.stringConstraints,
                    patternMessage: e.target.value || undefined,
                  },
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
        </fieldset>
      ) : null}

      {field.type === 'computed' || field.type === 'number' ? (
        <fieldset className="sf-form-builder-constraints">
          <legend>Math</legend>
          {field.type === 'computed' ? (
            <>
              <label>
                <span>Expression</span>
                <input
                  type="text"
                  value={field.computed?.expression ?? ''}
                  placeholder="price * qty"
                  onChange={(e) =>
                    onPatch({
                      computed: {
                        expression: e.target.value,
                        precision: field.computed?.precision ?? 2,
                      },
                    })
                  }
                  onBlur={flushOnBlur}
                  spellCheck={false}
                />
              </label>
              <label>
                <span>Precision</span>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={field.computed?.precision ?? 2}
                  onChange={(e) =>
                    onPatch({
                      computed: {
                        expression: field.computed?.expression ?? '0',
                        precision: Number(e.target.value) || 0,
                      },
                    })
                  }
                  onBlur={flushOnBlur}
                />
              </label>
            </>
          ) : null}
          <label>
            <span>Min (static)</span>
            <input
              type="number"
              value={field.numberBounds?.min ?? ''}
              onChange={(e) =>
                onPatch({
                  numberBounds: {
                    ...field.numberBounds,
                    min: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
          <label>
            <span>Max (static)</span>
            <input
              type="number"
              value={field.numberBounds?.max ?? ''}
              onChange={(e) =>
                onPatch({
                  numberBounds: {
                    ...field.numberBounds,
                    max: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
          <label>
            <span>Min expression</span>
            <input
              type="text"
              value={field.numberBounds?.minExpr ?? ''}
              placeholder="min(a, b)"
              onChange={(e) =>
                onPatch({
                  numberBounds: {
                    ...field.numberBounds,
                    minExpr: e.target.value || undefined,
                  },
                })
              }
              onBlur={flushOnBlur}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Max expression</span>
            <input
              type="text"
              value={field.numberBounds?.maxExpr ?? ''}
              onChange={(e) =>
                onPatch({
                  numberBounds: {
                    ...field.numberBounds,
                    maxExpr: e.target.value || undefined,
                  },
                })
              }
              onBlur={flushOnBlur}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Validate expression</span>
            <input
              type="text"
              value={field.validateExpr?.expression ?? ''}
              placeholder="total >= 10"
              onChange={(e) =>
                onPatch({
                  validateExpr: e.target.value
                    ? {
                        expression: e.target.value,
                        message: field.validateExpr?.message,
                      }
                    : undefined,
                })
              }
              onBlur={flushOnBlur}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Validate message</span>
            <input
              type="text"
              value={field.validateExpr?.message ?? ''}
              onChange={(e) =>
                onPatch({
                  validateExpr: field.validateExpr?.expression
                    ? {
                        expression: field.validateExpr.expression,
                        message: e.target.value || undefined,
                      }
                    : undefined,
                })
              }
              onBlur={flushOnBlur}
            />
          </label>
        </fieldset>
      ) : null}

      <fieldset className="sf-form-builder-constraints">
        <legend>Conditional logic</legend>
        <p className="layout-muted">Show / require when other fields match.</p>
        {(['showWhen', 'requireWhen'] as const).map((key) => {
          const group = field.logic?.[key] ?? emptyGroup()
          const enabled = Boolean(field.logic?.[key])
          return (
            <div key={key} className="sf-form-logic-block">
              <label className="gantry-typed-check">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    onPatchLogic(key, e.target.checked ? emptyGroup() : undefined)
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
                        onPatchLogic(key, {
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
                          onPatchLogic(key, { ...group, conditions })
                          queueMicrotask(saveNow)
                        }}
                      >
                        <option value="">Field…</option>
                        {fields
                          .filter((f) => f.name !== field.name)
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
                            i === idx ? { ...c, op: e.target.value as FormConditionOp } : c,
                          )
                          onPatchLogic(key, { ...group, conditions })
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
                            onPatchLogic(key, { ...group, conditions })
                          }}
                          onBlur={flushOnBlur}
                          placeholder="value"
                        />
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="gantry-toolbar-btn secondary"
                    onClick={() => {
                      onPatchLogic(key, {
                        ...group,
                        conditions: [...group.conditions, { field: '', op: 'eq', value: '' }],
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
    </div>
  )
}

type FieldBarProps = FieldSettingsProps & {
  /** Optional sortable node ref / transform when DnD is active. */
  setNodeRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  isDragging?: boolean
  /** Drag handle props from useDraggable; omitted until client DnD mounts. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

/**
 * Presentational field bar. Drag handle props are optional so SSR / pre-hydration
 * can render the same markup without dnd-kit's generated aria-describedby ids
 * (DndDescribedBy-N), which drift vs the client counter and cause hydration mismatches.
 */
function FieldBar({
  field,
  fields,
  onPatch,
  onRename,
  onPatchConstraints,
  onUpdateOptions,
  onPatchLogic,
  onRemove,
  saveNow,
  flushOnBlur,
  siteCaptcha,
  widthPercent,
  onSplitToOwnRow,
  onJoinNextRow,
  canSplit,
  canJoinNext,
  dropEdge = null,
  setNodeRef,
  style,
  isDragging = false,
  dragHandleProps,
}: FieldBarProps) {
  const displayName = field.label || field.name
  const captchaWarn = field.type === 'captcha' ? captchaSiteStatusMessage(siteCaptcha) : null
  const pct = widthPercent ?? LAYOUT_WIDTH_FULL
  const classNames = [
    'gantry-slot',
    'sf-form-slot',
    isDragging ? 'is-slot-dragging' : '',
    captchaWarn ? 'sf-form-slot-captcha-warn' : '',
    dropEdge === 'before' ? 'is-slot-drop-before' : '',
    dropEdge === 'after' ? 'is-slot-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article ref={setNodeRef} style={style} className={classNames} data-sf-width={pct}>
      <header className="gantry-slot-head">
        <div className="gantry-slot-title">
          <button
            type="button"
            className="gantry-slot-handle"
            aria-label="Drag to reorder"
            {...(dragHandleProps ?? {})}
          >
            ▣
          </button>
          <span className="gantry-slot-pct" title="Column width">
            {widthToPercentLabel(pct)}
          </span>
          <div className="gantry-slot-labels">
            <strong className="sf-form-slot-name">{displayName}</strong>
            <span className="gantry-slot-sub">
              {field.type}
              {field.required ? ' · required' : ''}
              {field.logic?.showWhen ? ' · conditional' : ''}
              {field.computed ? ' · expr' : ''}
              {captchaWarn ? ' · inactive' : field.type === 'captcha' ? ' · Turnstile' : ''}
              {' · '}
              <code>{field.name}</code>
            </span>
            {captchaWarn ? (
              <span className="sf-form-captcha-warn" role="status">
                {captchaWarn}
              </span>
            ) : null}
          </div>
        </div>
        <div className="gantry-slot-end">
          <div className="gantry-slot-actions sf-form-slot-row-actions">
            {canJoinNext && onJoinNextRow ? (
              <button
                type="button"
                className="gantry-toolbar-btn secondary sf-form-row-action"
                title="Join with next row (side-by-side)"
                onClick={onJoinNextRow}
              >
                Join →
              </button>
            ) : null}
            {canSplit && onSplitToOwnRow ? (
              <button
                type="button"
                className="gantry-toolbar-btn secondary sf-form-row-action"
                title="Move this field to its own row"
                onClick={onSplitToOwnRow}
              >
                Own row
              </button>
            ) : null}
            <ParticleSettingsPopover
              title={`${displayName} settings`}
              tabs={[
                {
                  id: 'config',
                  label: 'Config',
                  content: (
                    <FieldSettingsBody
                      field={field}
                      fields={fields}
                      onPatch={onPatch}
                      onRename={onRename}
                      onPatchConstraints={onPatchConstraints}
                      onUpdateOptions={onUpdateOptions}
                      onPatchLogic={onPatchLogic}
                      saveNow={saveNow}
                      flushOnBlur={flushOnBlur}
                      siteCaptcha={siteCaptcha}
                    />
                  ),
                },
              ]}
            />
            <GantryBarRemoveButton
              label={`Remove ${displayName}`}
              confirmMessage={`Remove field “${displayName}”?`}
              onConfirm={onRemove}
            />
          </div>
        </div>
      </header>
    </article>
  )
}

function FormColumnResizeHandle({
  leftWidth,
  rightWidth,
  onLocalResize,
  onCommit,
}: {
  leftWidth: number
  rightWidth: number
  onLocalResize: (left: number, right: number) => void
  onCommit: (left: number, right: number) => void
}) {
  const dragging = React.useRef(false)

  return (
    <div
      className="gantry-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize form columns"
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const handle = event.currentTarget
        const rowEl = handle.closest('.sf-form-row-slots') as HTMLElement | null
        const leftEl = handle.previousElementSibling as HTMLElement | null
        if (!rowEl || !leftEl) return
        dragging.current = true
        handle.setPointerCapture(event.pointerId)
        const pairSum = leftWidth + rightWidth
        const rowRect = rowEl.getBoundingClientRect()
        const pairLeft = leftEl.getBoundingClientRect().left - rowRect.left
        let lastLeft = leftWidth
        let lastRight = rightWidth

        const onMove = (moveEvent: PointerEvent) => {
          if (!dragging.current) return
          const x = moveEvent.clientX - rowRect.left
          const pairWidthPx = Math.max(1, (pairSum / LAYOUT_WIDTH_FULL) * rowRect.width)
          const localX = x - pairLeft
          const newLeftPercent = (localX / pairWidthPx) * pairSum
          const [lw, rw] = resizeAdjacentPair(leftWidth, rightWidth, newLeftPercent)
          lastLeft = lw
          lastRight = rw
          onLocalResize(lw, rw)
        }

        const onUp = (upEvent: PointerEvent) => {
          dragging.current = false
          handle.releasePointerCapture(upEvent.pointerId)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          onCommit(lastLeft, lastRight)
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }}
    />
  )
}

/** Prefer field slots over row containers (Layout-like: drop on slot or row). */
const formRowCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    const fieldHit = hits.find((c) => !String(c.id).startsWith('row:'))
    return fieldHit ? [fieldHit] : hits
  }
  return closestCenter(args)
}

function rowDroppableId(rowId: string) {
  return `row:${rowId}`
}

function parseRowDroppableId(id: string | number): string | null {
  const raw = String(id)
  return raw.startsWith('row:') ? raw.slice(4) : null
}

/**
 * Draggable field — stays in its row during drag (opacity only).
 * Avoids useSortable live-reorder, which emptied / hid the drop-target row.
 */
function DraggableFieldBar(
  props: FieldSettingsProps & { dropEdge?: 'before' | 'after' | null },
) {
  const id = fieldKey(props.field)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  const pct = props.widthPercent ?? LAYOUT_WIDTH_FULL
  const edge = props.dropEdge ?? null
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.45 : 1,
    flex: `${pct} 1 0`,
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  }

  return (
    <FieldBar
      {...props}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dropEdge={edge}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  )
}

/** Row drop zone — highlight like Layout `.gantry-row.is-drop-target`. */
function DroppableFormRow({
  rowId,
  isDropTarget,
  isColumnTarget,
  children,
}: {
  rowId: string
  isDropTarget: boolean
  isColumnTarget: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: rowDroppableId(rowId) })
  const active = isDropTarget || isOver
  return (
    <div
      ref={setNodeRef}
      className={[
        'gantry-row',
        'sf-form-builder-row',
        active ? 'is-drop-target' : '',
        isColumnTarget ? 'is-column-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-sf-form-row={rowId}
    >
      {children}
    </div>
  )
}

type FormEditTab = 'editor' | 'settings'

const FORM_EDIT_TABS: { id: FormEditTab; label: string; title: string }[] = [
  { id: 'editor', label: 'Editor', title: 'Field palette + section canvas + JSON Schema' },
  {
    id: 'settings',
    label: 'Form settings',
    title: 'Title, success message, captcha, email notify',
  },
]

export function FormBuilder({ formId, initialDocument, siteCaptcha }: Props) {
  const [state, formAction, pending] = useActionState(saveFormDefinitionAction, initial)
  useNotifySavedOnOk(state)
  const { formRef, saveDebounced, saveNow, flushOnBlur } = useAutosaveForm()

  const [editTab, setEditTab] = useState<FormEditTab>('editor')
  const [title, setTitle] = useState(initialDocument.title)
  const [description, setDescription] = useState(initialDocument.description ?? '')
  const [preset, setPreset] = useState<FormPresetId>(initialDocument.preset)
  const [successMessage, setSuccessMessage] = useState(initialDocument.successMessage)
  const [successRedirectUrl, setSuccessRedirectUrl] = useState(
    initialDocument.successRedirectUrl ?? '',
  )
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
  /** When set, the next palette click adds a column into this row (even widths). */
  const [targetRow, setTargetRow] = useState<{ sectionId: string; rowId: string } | null>(null)

  // dnd-kit Accessibility assigns module-counter ids (DndDescribedBy-N). SSR vs client
  // counters diverge when multiple DndContexts mount — defer sortable until after hydrate
  // (same client-mount gate as Layout particle popovers).
  const [dndReady, setDndReady] = useState(false)
  useEffect(() => {
    setDndReady(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{
    sectionId: string
    kind: 'row' | 'field'
    rowId: string
    fieldId?: string
    edge?: 'before' | 'after'
  } | null>(null)

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormFieldDef>()
    for (const f of fields) map.set(fieldKey(f), f)
    return map
  }, [fields])

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
    const synced = syncSectionsWithFields(next, nextSections ?? sections)
    // Skip no-op patches (same serialized fields/sections) so focus/empty onChange
    // cannot schedule an autosave / Saved toast.
    if (
      JSON.stringify(next) === JSON.stringify(fields) &&
      JSON.stringify(synced) === JSON.stringify(sections)
    ) {
      return
    }
    setFields(next)
    setSections(synced)
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
    const targetSec = sectionId || targetRow?.sectionId || sections[0]?.id
    if (!targetSec) {
      updateFields(next)
      return
    }
    const nextSections =
      targetRow && targetRow.sectionId === targetSec
        ? addFieldToRow(sections, targetSec, targetRow.rowId, draft.name)
        : appendFieldRow(sections, targetSec, draft.name)
    setTargetRow(null)
    updateFields(next, nextSections)
  }

  function patchField(id: string, patch: Partial<FormFieldDef>) {
    const next = fields.map((f) => (fieldKey(f) === id ? { ...f, ...patch } : f))
    updateFields(next)
  }

  function renameField(id: string, nextName: string) {
    const current = fieldsByKey.get(id)
    if (!current) return
    const prev = current.name
    const nextFields = fields.map((f) => (fieldKey(f) === id ? { ...f, name: nextName } : f))
    const nextSections = renameFieldInSections(sections, prev, nextName)
    updateFields(nextFields, nextSections)
  }

  function patchFieldConstraints(id: string, patch: Partial<FormDateTimeConstraints>) {
    const current = fieldsByKey.get(id)
    if (!current || !isDateTimeFieldType(current.type)) return
    const merged: FormDateTimeConstraints = {
      ...(current.constraints ?? {}),
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
    patchField(id, { constraints: normalizeDateTimeConstraints(current.type, merged) })
  }

  function patchFieldLogic(
    id: string,
    key: 'showWhen' | 'requireWhen',
    group: FormConditionGroup | undefined,
  ) {
    const current = fieldsByKey.get(id)
    if (!current) return
    const logic = { ...(current.logic ?? {}) }
    if (!group || !group.conditions.length) delete logic[key]
    else logic[key] = group
    patchField(id, {
      logic: logic.showWhen || logic.requireWhen ? logic : undefined,
    })
  }

  function removeField(id: string, name: string) {
    const next = fields.filter((f) => fieldKey(f) !== id)
    const nextSections = removeFieldFromSections(sections, name)
    updateFields(next, nextSections)
  }

  function findFieldPlacement(section: FormSectionDef, activeId: string | number) {
    for (let rowIndex = 0; rowIndex < section.rows.length; rowIndex++) {
      const row = section.rows[rowIndex]!
      for (let colIndex = 0; colIndex < row.columns.length; colIndex++) {
        const col = row.columns[colIndex]!
        const f = fields.find((x) => x.name === col.fieldName)
        if ((f?.id || col.fieldName) === activeId) {
          return { row, rowIndex, colIndex, fieldName: col.fieldName }
        }
      }
    }
    return null
  }

  function reorderFieldsFromSections(nextSections: FormSectionDef[]) {
    const orderedNames = nextSections.flatMap((s) => sectionFieldNames(s))
    const byName = new Map(fields.map((f) => [f.name, f]))
    return orderedNames.map((n) => byName.get(n)!).filter(Boolean)
  }

  function commitSections(nextSections: FormSectionDef[]) {
    const synced = normalizeFormSections(nextSections, fields)
    if (JSON.stringify(synced) === JSON.stringify(sections)) return
    setSections(synced)
    const nextFields = reorderFieldsFromSections(synced)
    if (JSON.stringify(nextFields) !== JSON.stringify(fields)) {
      setFields(nextFields)
      regenerateSchema(nextFields)
    }
    saveDebounced()
  }

  function clearFieldDragUi() {
    setDraggingFieldId(null)
    setDropHint(null)
  }

  function onFieldDragStart(event: DragStartEvent) {
    setDraggingFieldId(String(event.active.id))
    setDropHint(null)
  }

  function onFieldDragOver(event: DragOverEvent, sectionId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setDropHint(null)
      return
    }
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    const rowId = parseRowDroppableId(over.id)
    if (rowId) {
      setDropHint({ sectionId, kind: 'row', rowId })
      return
    }
    const to = findFieldPlacement(section, over.id)
    if (!to) {
      setDropHint(null)
      return
    }
    // Same-row reorder: before/after by column index vs active.
    const from = findFieldPlacement(section, active.id)
    let edge: 'before' | 'after' = 'before'
    if (from && from.row.id === to.row.id) {
      edge = from.colIndex < to.colIndex ? 'after' : 'before'
    }
    setDropHint({
      sectionId,
      kind: 'field',
      rowId: to.row.id,
      fieldId: String(over.id),
      edge,
    })
  }

  /**
   * Layout-like drop:
   * - Onto a row droppable → append as a new column (even widths).
   * - Onto a field slot → insert before/after in that field's row.
   * Source field stays visible in its row until drop (no live sortable collapse).
   */
  function onDragEnd(event: DragEndEvent, sectionId: string) {
    const { active, over } = event
    const hint = dropHint
    clearFieldDragUi()
    if (!over || active.id === over.id) return
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    const from = findFieldPlacement(section, active.id)
    if (!from) return

    const overRowId = parseRowDroppableId(over.id) ?? (hint?.kind === 'row' ? hint.rowId : null)
    if (overRowId) {
      if (from.row.id === overRowId) return
      const target = section.rows.find((r) => r.id === overRowId)
      if (!target) return
      commitSections(
        moveFieldInSections(sections, from.fieldName, {
          sectionId,
          rowId: overRowId,
          index: target.columns.length,
        }),
      )
      return
    }

    const to = findFieldPlacement(section, over.id)
    if (!to) return

    if (from.row.id === to.row.id) {
      const names = from.row.columns.map((c) => c.fieldName)
      const edge = hint?.fieldId === String(over.id) ? hint.edge : 'before'
      let insertAt = to.colIndex
      if (edge === 'after') insertAt = to.colIndex + 1
      // Adjust when removing from an earlier index in the same row.
      const without = names.filter((_, i) => i !== from.colIndex)
      if (from.colIndex < insertAt) insertAt -= 1
      insertAt = Math.max(0, Math.min(without.length, insertAt))
      const nextNames = [
        ...without.slice(0, insertAt),
        from.fieldName,
        ...without.slice(insertAt),
      ]
      const widths = from.row.columns.map((c) => c.width)
      const nextRow: FormRowDef = {
        ...from.row,
        columns: nextNames.map((fieldName, i) => ({
          fieldName,
          // Keep prior widths by name when possible.
          width:
            from.row.columns.find((c) => c.fieldName === fieldName)?.width ??
            widths[i] ??
            LAYOUT_WIDTH_FULL,
        })),
      }
      const nextSections = sections.map((s) =>
        s.id === sectionId
          ? { ...s, rows: s.rows.map((r) => (r.id === nextRow.id ? nextRow : r)) }
          : s,
      )
      commitSections(nextSections)
      return
    }

    const edge = hint?.fieldId === String(over.id) ? hint.edge : 'before'
    const index = edge === 'after' ? to.colIndex + 1 : to.colIndex
    commitSections(
      moveFieldInSections(sections, from.fieldName, {
        sectionId,
        rowId: to.row.id,
        index,
      }),
    )
  }

  function joinWithNextRow(sectionId: string, rowId: string) {
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    const idx = section.rows.findIndex((r) => r.id === rowId)
    const next = section.rows[idx + 1]
    if (!next) return
    commitSections(mergeRows(sections, sectionId, rowId, next.id))
  }

  function splitToOwnRow(sectionId: string, fieldName: string) {
    commitSections(splitFieldToOwnRow(sections, sectionId, fieldName))
  }

  function onResizeColumns(
    sectionId: string,
    rowId: string,
    leftIndex: number,
    left: number,
    right: number,
    commit: boolean,
  ) {
    const next = resizeRowColumns(sections, sectionId, rowId, leftIndex, left)
    // Local preview: always apply; persist only on pointer-up.
    setSections(next)
    void right
    if (commit) saveDebounced()
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

  return (
    <div className="sf-form-builder gantry-editor">
      <FormsAdminNav active="forms" />
      <p className="admin-lede">
        <Link href="/admin/forms">← Forms</Link>
        {' · '}
        Layout-aligned builder: palette → section rows (side-by-side % columns) → field cog. Drag a
        field onto a row or slot (Layout-like drop zones); resize handles between columns; mobile
        stacks. Meta, success, and email live under Form settings.
      </p>

      <nav className="gantry-layouts-nav sf-form-edit-nav" aria-label="Form edit">
        <ul className="gantry-layouts-nav-tabs" role="tablist">
          {FORM_EDIT_TABS.map((tab) => {
            const selected = tab.id === editTab
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  role="tab"
                  id={`sf-form-edit-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`sf-form-edit-panel-${tab.id}`}
                  title={tab.title}
                  className={
                    selected ? 'gantry-layouts-nav-tab is-active' : 'gantry-layouts-nav-tab'
                  }
                  onClick={() => setEditTab(tab.id)}
                >
                  <span className="gantry-layouts-nav-tab-label">{tab.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <form ref={formRef} action={formAction} className="sf-form-builder-form">
        <input type="hidden" name="formId" value={formId} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />
        <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
        <input type="hidden" name="schemaJson" value={schemaJson} />
        <input type="hidden" name="schemaDirty" value={schemaDirty ? '1' : '0'} />
        <input type="hidden" name="preset" value={preset} />
        <input type="hidden" name="emailNotifyJson" value={JSON.stringify(emailNotify)} />

        {/* Keep both panels mounted so named fields + drafts survive tab switches / autosave. */}
        <div
          role="tabpanel"
          id="sf-form-edit-panel-editor"
          aria-labelledby="sf-form-edit-tab-editor"
          hidden={editTab !== 'editor'}
          className="sf-form-edit-panel"
        >
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
                Click a field type to add a new row. Select <strong>+ column</strong> on a row first
                to place the next field side-by-side. Drag a placed field onto a row or slot to join;
                the drop target stays highlighted (Layout-style). Resize with the divider.
              </p>
              {targetRow ? (
                <p className="sf-form-target-row" role="status">
                  Next field → selected row.{' '}
                  <button type="button" className="gantry-toolbar-btn secondary" onClick={() => setTargetRow(null)}>
                    Clear
                  </button>
                </p>
              ) : null}
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
                const overlayField = draggingFieldId
                  ? fields.find((f) => fieldKey(f) === draggingFieldId)
                  : null
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
                          onBlur={flushOnBlur}
                          aria-label="Section label"
                        />
                      </div>
                      <div className="gantry-section-actions">
                        {sections.length > 1 ? (
                          <button
                            type="button"
                            className="gantry-toolbar-btn danger"
                            onClick={() => {
                              const orphanRows = section.rows
                              const remaining = sections.filter((s) => s.id !== section.id)
                              if (!remaining[0]) return
                              remaining[0] = {
                                ...remaining[0],
                                rows: [...remaining[0].rows, ...orphanRows],
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
                    <div className="sf-form-section-rows">
                      {section.rows.length === 0 ? (
                        <p className="gantry-drop-empty admin-empty">
                          Drop fields here — add from the palette.
                        </p>
                      ) : dndReady ? (
                        <DndContext
                          id={`form-section-${section.id}`}
                          sensors={sensors}
                          collisionDetection={formRowCollision}
                          onDragStart={onFieldDragStart}
                          onDragOver={(e) => onFieldDragOver(e, section.id)}
                          onDragCancel={clearFieldDragUi}
                          onDragEnd={(e) => onDragEnd(e, section.id)}
                        >
                          {section.rows.map((row, rowIndex) => {
                            const isColumnTarget =
                              targetRow?.sectionId === section.id && targetRow.rowId === row.id
                            const isDropTarget =
                              Boolean(draggingFieldId) &&
                              dropHint?.sectionId === section.id &&
                              dropHint.rowId === row.id
                            return (
                              <DroppableFormRow
                                key={row.id}
                                rowId={row.id}
                                isDropTarget={isDropTarget}
                                isColumnTarget={isColumnTarget}
                              >
                                <div className="gantry-row-meta sf-form-row-meta">
                                  <span>
                                    Row · drop fields here
                                    {row.columns.length
                                      ? ` · ${row.columns.length} column${row.columns.length === 1 ? '' : 's'}`
                                      : ''}
                                  </span>
                                  <div className="gantry-row-actions">
                                    <button
                                      type="button"
                                      className={
                                        isColumnTarget
                                          ? 'gantry-toolbar-btn primary'
                                          : 'gantry-toolbar-btn secondary'
                                      }
                                      title="Next palette click adds a field into this row"
                                      onClick={() =>
                                        setTargetRow(
                                          isColumnTarget
                                            ? null
                                            : { sectionId: section.id, rowId: row.id },
                                        )
                                      }
                                    >
                                      {isColumnTarget ? 'Column target ✓' : '+ column'}
                                    </button>
                                    {rowIndex < section.rows.length - 1 ? (
                                      <button
                                        type="button"
                                        className="gantry-toolbar-btn secondary"
                                        title="Merge this row with the next"
                                        onClick={() => joinWithNextRow(section.id, row.id)}
                                      >
                                        Join next
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="gantry-row-slots sf-form-row-slots">
                                  {row.columns.length === 0 ? (
                                    <div className="gantry-row-empty">Drop fields here…</div>
                                  ) : null}
                                  {row.columns.map((col, colIndex) => {
                                    const field = fields.find((f) => f.name === col.fieldName)
                                    if (!field) return null
                                    const id = fieldKey(field)
                                    const edge =
                                      dropHint?.sectionId === section.id &&
                                      dropHint.kind === 'field' &&
                                      dropHint.fieldId === id &&
                                      draggingFieldId !== id
                                        ? dropHint.edge ?? null
                                        : null
                                    const bar = (
                                      <DraggableFieldBar
                                        key={id}
                                        field={field}
                                        fields={fields}
                                        widthPercent={col.width}
                                        dropEdge={edge}
                                        canSplit={row.columns.length > 1}
                                        canJoinNext={
                                          row.columns.length === 1 &&
                                          rowIndex < section.rows.length - 1
                                        }
                                        onSplitToOwnRow={() =>
                                          splitToOwnRow(section.id, field.name)
                                        }
                                        onJoinNextRow={() =>
                                          joinWithNextRow(section.id, row.id)
                                        }
                                        onPatch={(patch) => patchField(id, patch)}
                                        onRename={(nextName) => renameField(id, nextName)}
                                        onPatchConstraints={(patch) =>
                                          patchFieldConstraints(id, patch)
                                        }
                                        onUpdateOptions={(options) =>
                                          patchField(id, { options })
                                        }
                                        onPatchLogic={(key, group) =>
                                          patchFieldLogic(id, key, group)
                                        }
                                        onRemove={() => removeField(id, field.name)}
                                        saveNow={saveNow}
                                        flushOnBlur={flushOnBlur}
                                        siteCaptcha={siteCaptcha}
                                      />
                                    )
                                    if (colIndex >= row.columns.length - 1) return bar
                                    const right = row.columns[colIndex + 1]!
                                    return (
                                      <React.Fragment key={id}>
                                        {bar}
                                        <FormColumnResizeHandle
                                          leftWidth={col.width}
                                          rightWidth={right.width}
                                          onLocalResize={(left) =>
                                            onResizeColumns(
                                              section.id,
                                              row.id,
                                              colIndex,
                                              left,
                                              0,
                                              false,
                                            )
                                          }
                                          onCommit={(left) =>
                                            onResizeColumns(
                                              section.id,
                                              row.id,
                                              colIndex,
                                              left,
                                              0,
                                              true,
                                            )
                                          }
                                        />
                                      </React.Fragment>
                                    )
                                  })}
                                </div>
                              </DroppableFormRow>
                            )
                          })}
                          <DragOverlay dropAnimation={null}>
                            {overlayField ? (
                              <div className="sf-form-drag-overlay">
                                <FieldBar
                                  field={overlayField}
                                  fields={fields}
                                  widthPercent={LAYOUT_WIDTH_FULL}
                                  onPatch={() => {}}
                                  onRename={() => {}}
                                  onPatchConstraints={() => {}}
                                  onUpdateOptions={() => {}}
                                  onPatchLogic={() => {}}
                                  onRemove={() => {}}
                                  saveNow={() => {}}
                                  flushOnBlur={() => {}}
                                  siteCaptcha={siteCaptcha}
                                  style={{ width: '16rem', maxWidth: '80vw' }}
                                />
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                      ) : (
                        section.rows.map((row) => (
                          <div
                            key={row.id}
                            className="gantry-row sf-form-builder-row"
                            data-sf-form-row={row.id}
                          >
                            <div className="gantry-row-slots sf-form-row-slots">
                              {row.columns.map((col) => {
                                const field = fields.find((f) => f.name === col.fieldName)
                                if (!field) return null
                                const id = fieldKey(field)
                                return (
                                  <FieldBar
                                    key={id}
                                    field={field}
                                    fields={fields}
                                    widthPercent={col.width}
                                    style={{
                                      flex: `${col.width} 1 0`,
                                      minWidth: 0,
                                      maxWidth: '100%',
                                    }}
                                    onPatch={(patch) => patchField(id, patch)}
                                    onRename={(nextName) => renameField(id, nextName)}
                                    onPatchConstraints={(patch) =>
                                      patchFieldConstraints(id, patch)
                                    }
                                    onUpdateOptions={(options) => patchField(id, { options })}
                                    onPatchLogic={(key, group) =>
                                      patchFieldLogic(id, key, group)
                                    }
                                    onRemove={() => removeField(id, field.name)}
                                    saveNow={saveNow}
                                    flushOnBlur={flushOnBlur}
                                    siteCaptcha={siteCaptcha}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
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
              onBlur={flushOnBlur}
              spellCheck={false}
            />
            {schemaError ? (
              <p className="admin-inline-error" role="alert">
                {schemaError}
              </p>
            ) : null}
          </section>
        </div>

        <div
          role="tabpanel"
          id="sf-form-edit-panel-settings"
          aria-labelledby="sf-form-edit-tab-settings"
          hidden={editTab !== 'settings'}
          className="sf-form-edit-panel"
        >
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
                onBlur={flushOnBlur}
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
                onBlur={flushOnBlur}
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
                {listFormPresetMetas().map((p) => (
                  <option key={p.id} value={p.id} title={p.description}>
                    {p.label}
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
                onBlur={flushOnBlur}
              />
            </label>
            <label>
              <span>Success redirect URL (optional)</span>
              <input
                type="text"
                name="successRedirectUrl"
                value={successRedirectUrl}
                placeholder="/thanks — relative path only"
                onChange={(e) => {
                  setSuccessRedirectUrl(e.target.value)
                  saveDebounced()
                }}
                onBlur={flushOnBlur}
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
                onBlur={flushOnBlur}
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
              <span>
                Use site captcha default (Settings → Security). A Captcha field on the canvas also
                triggers Turnstile when site captcha is on.
              </span>
            </label>

            <fieldset className="sf-form-builder-constraints sf-form-builder-email">
              <legend>Email on submit</legend>
              <p className="layout-muted">
                Uses the platform Mailer (Chrome enable / provider). Soft-fails if email is
                off or misconfigured — submissions still save.
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
                  onChange={(e) => {
                    setEmailNotify({ ...emailNotify, respondentEmailField: e.target.value })
                    saveDebounced()
                  }}
                  onBlur={flushOnBlur}
                />
              </label>
              <label>
                <span>Admin emails override</span>
                <input
                  type="text"
                  value={(emailNotify.adminEmails ?? []).join(', ')}
                  placeholder="Leave empty → Forms Settings default"
                  onChange={(e) => {
                    setEmailNotify({
                      ...emailNotify,
                      adminEmails: e.target.value
                        .split(/[,;\s]+/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                    saveDebounced()
                  }}
                  onBlur={flushOnBlur}
                />
              </label>
            </fieldset>
          </div>
        </div>

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
