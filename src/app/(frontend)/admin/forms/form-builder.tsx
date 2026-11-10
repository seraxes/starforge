'use client'

import React, { useActionState, useMemo, useState } from 'react'

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
  appendEmptyRowToSection,
  appendFieldRow,
  ensureFormSectionsEmptyRows,
  moveFieldInSections,
  removeEmptyRowFromSection,
  removeFieldFromSections,
  renameFieldInSections,
  resizeRowColumns,
  sectionFieldNames,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  clampGridWidth,
} from '@/core/forms/rows'
import {
  fieldsToJsonSchema,
  isFormFieldType,
  stringifyFormJsonSchema,
} from '@/core/forms/schema-json'
import {
  pairMosaicSectionWidths,
  widthToPercentLabel,
} from '@/core/modules/grid'
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

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import { resolveAccessTags } from '@/core/acl/nav-access'
import type { UserGroupOption } from '@/core/acl/types'
import {
  UNIQUE_FORM_FIELD_CATEGORY_LABELS,
  availableUniqueFormFieldTemplates,
  createUniqueFormFieldDraft,
  isUniqueFormFieldKey,
  resolveFormFieldUniqueKey,
} from '@/core/forms/unique-fields'
import { MediaPicker } from '@/modules/media/api'

import { useNotifySavedOnOk } from '../admin-toast'
import {
  CanvasRows,
  CanvasSectionFrame,
  useCanvasSectionListDrag,
  type CanvasRowModel,
} from '../canvas/section-row-canvas'
import type { CanvasItemDrag } from '../canvas/section-row-drag'
import { ParticleSettingsPopover } from '../layouts/particle-settings-popover'
import { useAutosaveForm } from '../use-autosave-form'

/** Palette → canvas row. The canvas owns the drop. */
const DND_FORM_FIELD = 'application/x-starforge-form-field'

/** Unique Profile (etc.) catalog field — value is uniqueKey. */
const DND_FORM_UNIQUE = 'application/x-starforge-form-unique'

/** After placing beside, make the pair fit on one flex row (default 50|50). */
function pairSectionWidths(
  sections: FormSectionDef[],
  aId: string,
  bId: string,
): FormSectionDef[] {
  const a = sections.find((s) => s.id === aId)
  const b = sections.find((s) => s.id === bId)
  if (!a || !b) return sections
  const paired = pairMosaicSectionWidths(a.width, b.width)
  if (!paired) return sections
  const [aW, bW] = paired
  return sections.map((s) => {
    if (s.id === aId) return { ...s, width: aW }
    if (s.id === bId) return { ...s, width: bW }
    return s
  })
}

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
  /** Users → Groups for field accessTags (Layout-style). */
  groups?: UserGroupOption[]
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
  groups?: UserGroupOption[]
  /** Column width percent when sitting in a multi-column row. */
  widthPercent?: number
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
  groups = [],
}: Omit<FieldSettingsProps, 'onRemove'>) {
  const captchaWarn = field.type === 'captcha' ? captchaSiteStatusMessage(siteCaptcha) : null
  const uniqueKey = resolveFormFieldUniqueKey(field)
  const isUnique = Boolean(uniqueKey)
  const accessTags = resolveAccessTags({ accessTags: field.accessTags })
  return (
    <div className="gantry-typed-form sf-form-field-cog-body">
      {field.type === 'captcha' ? (
        <p className={captchaWarn ? 'admin-inline-error' : 'layout-muted'} role={captchaWarn ? 'alert' : undefined}>
          {captchaWarn
            ? captchaWarn
            : 'Renders Cloudflare Turnstile using Site Settings → Security. Keys stay in Environment.'}
        </p>
      ) : null}
      {isUnique ? (
        <p className="layout-muted">
          Unique Profile field — only one per form. Name and type are fixed; remove it to return it
          to the Profile palette.
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
          disabled={isUnique}
          title={isUnique ? 'Unique field name is fixed' : undefined}
          onChange={(e) => {
            if (isUnique) return
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
          disabled={isUnique}
          title={isUnique ? 'Unique field type is fixed' : undefined}
          onChange={(e) => {
            if (isUnique) return
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
      <AccessTagsField
        legend="Who can see"
        groups={groups}
        value={accessTags}
        onChange={(next) => {
          onPatch({ accessTags: next })
          queueMicrotask(saveNow)
        }}
      />
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
  groups,
  widthPercent,
}: FieldSettingsProps) {
  const displayName = field.label || field.name
  const captchaWarn = field.type === 'captcha' ? captchaSiteStatusMessage(siteCaptcha) : null
  const pct = widthPercent ?? LAYOUT_WIDTH_FULL

  return (
    <header className="gantry-slot-head">
      <div className="gantry-slot-title">
        <span className="gantry-slot-handle" aria-hidden="true" title="Drag this bar to move it">
          ▣
        </span>
        <span className="gantry-slot-pct" title="Column width">
          {widthToPercentLabel(pct)}
        </span>
        <div className="gantry-slot-labels">
          <strong
            className="sf-form-slot-name"
            title="Drag the whole bar to move — blue line shows where it lands"
          >
            {displayName}
          </strong>
          <span className="gantry-slot-sub">
            {field.type}
            {resolveFormFieldUniqueKey(field) ? ' · unique' : ''}
            {field.required ? ' · required' : ''}
            {field.logic?.showWhen ? ' · conditional' : ''}
            {field.computed ? ' · expr' : ''}
            {captchaWarn ? ' · inactive' : field.type === 'captcha' ? ' · Turnstile' : ''}
            {' · drag bar to move · '}
            <code>{field.name}</code>
          </span>
          {captchaWarn ? (
            <span className="sf-form-captcha-warn" role="status">
              {captchaWarn}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className="gantry-slot-end"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="gantry-slot-actions">
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
                    groups={groups ?? []}
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
  )
}

function formRowsToCanvas(section: FormSectionDef, fields: FormFieldDef[]): CanvasRowModel[] {
  return section.rows.map((row) => ({
    id: row.id,
    items: row.columns.flatMap((col) => {
      const field = fields.find((item) => item.name === col.fieldName)
      if (!field) return []
      return [{ id: fieldKey(field), width: col.width }]
    }),
  }))
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

type PaletteKindFilter = 'all' | 'normal' | 'unique'

export function FormBuilder({ formId, initialDocument, siteCaptcha, groups = [] }: Props) {
  const [state, formAction, pending] = useActionState(saveFormDefinitionAction, initial)
  useNotifySavedOnOk(state)
  const { formRef, saveDebounced, saveNow, flushOnBlur } = useAutosaveForm()

  const [editTab, setEditTab] = useState<FormEditTab>('editor')
  const [paletteKind, setPaletteKind] = useState<PaletteKindFilter>('all')
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
  const [newSectionWidth, setNewSectionWidth] = useState(LAYOUT_WIDTH_FULL)
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
  const [draggingPaletteType, setDraggingPaletteType] = useState<FormFieldType | null>(null)
  const [draggingUniqueKey, setDraggingUniqueKey] = useState<string | null>(null)

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormFieldDef>()
    for (const f of fields) map.set(fieldKey(f), f)
    return map
  }, [fields])

  const availableUniqueFields = useMemo(
    () => availableUniqueFormFieldTemplates(fields, 'profiles'),
    [fields],
  )

  const showNormalPalette = paletteKind === 'all' || paletteKind === 'normal'
  const showUniquePalette = paletteKind === 'all' || paletteKind === 'unique'

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

  function mintFieldDraft(type: FormFieldType): FormFieldDef {
    const draft = createFieldDraft(type)
    const names = new Set(fields.map((f) => f.name))
    let name = draft.name
    let n = 2
    while (names.has(name)) {
      name = `${draft.name}_${n}`
      n += 1
    }
    draft.name = name
    return draft
  }

  function addField(type: FormFieldType, sectionId?: string) {
    const draft = mintFieldDraft(type)
    const next = [...fields, draft]
    const targetSec = sectionId || sections[0]?.id
    if (!targetSec) {
      updateFields(next)
      return
    }
    // Click → fill open trailing empty drop row, else append a filled row.
    updateFields(next, appendFieldRow(sections, targetSec, draft.name))
  }

  /** Palette HTML5 drop onto a specific open/filled row. */
  function addFieldOntoRow(type: FormFieldType, sectionId: string, rowId: string) {
    if (!isFormFieldType(type)) return
    const draft = mintFieldDraft(type)
    updateFields([...fields, draft], addFieldToRow(sections, sectionId, rowId, draft.name))
  }

  function addUniqueField(uniqueKey: string, sectionId?: string) {
    if (!isUniqueFormFieldKey(uniqueKey)) return
    if (fields.some((f) => resolveFormFieldUniqueKey(f) === uniqueKey)) return
    const draft = createUniqueFormFieldDraft(uniqueKey)
    if (!draft) return
    const next = [...fields, draft]
    const targetSec = sectionId || sections[0]?.id
    if (!targetSec) {
      updateFields(next)
      return
    }
    updateFields(next, appendFieldRow(sections, targetSec, draft.name))
  }

  function addUniqueFieldOntoRow(uniqueKey: string, sectionId: string, rowId: string) {
    if (!isUniqueFormFieldKey(uniqueKey)) return
    if (fields.some((f) => resolveFormFieldUniqueKey(f) === uniqueKey)) return
    const draft = createUniqueFormFieldDraft(uniqueKey)
    if (!draft) return
    updateFields([...fields, draft], addFieldToRow(sections, sectionId, rowId, draft.name))
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

  function reorderFieldsFromSections(nextSections: FormSectionDef[]) {
    const orderedNames = nextSections.flatMap((s) => sectionFieldNames(s))
    const byName = new Map(fields.map((f) => [f.name, f]))
    return orderedNames.map((n) => byName.get(n)!).filter(Boolean)
  }

  function commitSections(nextSections: FormSectionDef[]) {
    const synced = ensureFormSectionsEmptyRows(normalizeFormSections(nextSections, fields))
    if (JSON.stringify(synced) === JSON.stringify(sections)) return
    setSections(synced)
    const nextFields = reorderFieldsFromSections(synced)
    if (JSON.stringify(nextFields) !== JSON.stringify(fields)) {
      setFields(nextFields)
      regenerateSchema(nextFields)
    }
    saveDebounced()
  }

  function applySectionDrop(
    movingId: string,
    targetId: string,
    position: 'before' | 'after',
    placeBeside: boolean,
  ) {
    if (!movingId || movingId === targetId) return
    const without = sections.filter((s) => s.id !== movingId)
    const moving = sections.find((s) => s.id === movingId)
    if (!moving) return
    const targetIndex = without.findIndex((s) => s.id === targetId)
    if (targetIndex < 0) return
    const insertAt = position === 'before' ? targetIndex : targetIndex + 1
    let next = [...without.slice(0, insertAt), moving, ...without.slice(insertAt)]
    if (placeBeside) {
      next = pairSectionWidths(next, movingId, targetId)
    }
    commitSections(next)
  }

  function openEmptyRow(sectionId: string) {
    commitSections(appendEmptyRowToSection(sections, sectionId))
  }

  function closeEmptyRow(sectionId: string, rowId: string) {
    commitSections(removeEmptyRowFromSection(sections, sectionId, rowId))
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

  function fieldByCanvasId(id: string): FormFieldDef | undefined {
    return fields.find((field) => fieldKey(field) === id)
  }

  function stackCanvasField(
    source: CanvasItemDrag,
    targetSectionId: string,
    targetRowId: string,
    position: 'before' | 'after',
  ) {
    const field = fieldByCanvasId(source.itemId)
    const fromSection = sections.find((section) => section.id === source.sectionId)
    const fromRow = fromSection?.rows.find((row) => row.id === source.rowId)
    const targetSection = sections.find((section) => section.id === targetSectionId)
    if (!field || !fromRow || !targetSection) return
    const targetIndex = targetSection.rows.findIndex((row) => row.id === targetRowId)
    if (targetIndex < 0) return
    let insertAt = position === 'before' ? targetIndex : targetIndex + 1
    if (source.sectionId === targetSectionId && fromRow.columns.length === 1) {
      const fromRowIndex = targetSection.rows.findIndex((row) => row.id === fromRow.id)
      if (fromRowIndex >= 0 && fromRowIndex < insertAt) insertAt -= 1
    }
    commitSections(
      moveFieldInSections(sections, field.name, {
        sectionId: targetSectionId,
        rowId: null,
        index: insertAt,
      }),
    )
  }

  const sectionDrag = useCanvasSectionListDrag(applySectionDrop)

  return (
    <div className="sf-form-builder gantry-editor">
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
            <aside className="gantry-palette sf-form-palette" aria-label="Field types">
              <h3>Fields</h3>
              <div className="sf-forms-filters sf-form-palette-filters">
                <div className="sf-forms-filter-group" role="group" aria-label="Field kind">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'normal', label: 'Normal' },
                      { id: 'unique', label: 'Unique' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                        paletteKind === tab.id ? ' is-active' : ''
                      }`}
                      aria-pressed={paletteKind === tab.id}
                      onClick={() => setPaletteKind(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {showNormalPalette ? (
                <ul className="gantry-palette-list">
                  {FIELD_PALETTE.map((item) => (
                    <li key={item.type}>
                      <div
                        className={
                          draggingPaletteType === item.type
                            ? 'gantry-palette-item is-dragging'
                            : 'gantry-palette-item'
                        }
                        draggable
                        title={`${item.label} — click to append, or drag onto a row`}
                        role="button"
                        tabIndex={0}
                        onClick={() => addField(item.type)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            addField(item.type)
                          }
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(DND_FORM_FIELD, item.type)
                          event.dataTransfer.setData('text/plain', item.type)
                          event.dataTransfer.effectAllowed = 'copy'
                          setDraggingPaletteType(item.type)
                          setDraggingUniqueKey(null)
                        }}
                        onDragEnd={() => setDraggingPaletteType(null)}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {showUniquePalette ? (
                <>
                  {paletteKind === 'all' ? (
                    <h4 className="sf-form-palette-subhead">
                      {UNIQUE_FORM_FIELD_CATEGORY_LABELS.profiles}
                    </h4>
                  ) : null}
                  {availableUniqueFields.length === 0 ? (
                    <p className="layout-muted sf-form-palette-empty">
                      All unique Profile fields are on the canvas — remove one to add it again.
                    </p>
                  ) : (
                    <ul className="gantry-palette-list">
                      {availableUniqueFields.map((item) => (
                        <li key={item.uniqueKey}>
                          <div
                            className={
                              draggingUniqueKey === item.uniqueKey
                                ? 'gantry-palette-item is-dragging'
                                : 'gantry-palette-item'
                            }
                            draggable
                            title={`${item.label} — unique; only one per form`}
                            role="button"
                            tabIndex={0}
                            onClick={() => addUniqueField(item.uniqueKey)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                addUniqueField(item.uniqueKey)
                              }
                            }}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(DND_FORM_UNIQUE, item.uniqueKey)
                              event.dataTransfer.setData('text/plain', item.uniqueKey)
                              event.dataTransfer.effectAllowed = 'copy'
                              setDraggingUniqueKey(item.uniqueKey)
                              setDraggingPaletteType(null)
                            }}
                            onDragEnd={() => setDraggingUniqueKey(null)}
                          >
                            <strong>{item.label}</strong>
                            <span>{item.hint}</span>
                            <em>unique</em>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
              <p className="layout-muted">
                Filter <strong>All / Normal / Unique</strong>. Unique Profile fields leave the list
                while on the canvas. Drag the blue <strong>row bar</strong> to reorder rows;
                section <strong>⋮⋮</strong> above/below or beside.
              </p>
            </aside>

            <div className="sf-form-canvas" aria-label="Form canvas">
              <div className="gantry-section-actions gantry-toolbar-create">
                <div className="gantry-section-create" role="group" aria-label="Add section">
                  <button
                    type="button"
                    className="gantry-section-create-submit"
                    onClick={() => {
                      const sec = createSectionDraft(
                        `Section ${sections.length + 1}`,
                        newSectionWidth,
                      )
                      setSections([...sections, sec])
                      saveDebounced()
                    }}
                  >
                    <span className="gantry-section-create-plus" aria-hidden="true">
                      +
                    </span>
                    <span>Section</span>
                  </button>
                  <label className="gantry-section-create-width">
                    <span className="sr-only">Width %</span>
                    <input
                      type="number"
                      value={newSectionWidth}
                      min={LAYOUT_WIDTH_MIN}
                      max={LAYOUT_WIDTH_FULL}
                      step={5}
                      aria-label="New section width percent"
                      title="Percent width for the new section (5–100)"
                      onChange={(e) => {
                        setNewSectionWidth(clampGridWidth(e.target.value, LAYOUT_WIDTH_FULL))
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span aria-hidden="true">%</span>
                  </label>
                </div>
              </div>
              <ol className="gantry-sections sf-form-sections">
                {sections.map((section) => {
                  const drag = sectionDrag.bind(section.id)
                  const sectionWidth = clampGridWidth(
                    section.width ?? LAYOUT_WIDTH_FULL,
                    LAYOUT_WIDTH_FULL,
                  )
                  return (
                    <CanvasSectionFrame
                      key={section.id}
                      sectionId={section.id}
                      label={section.label}
                      width={sectionWidth}
                      drag={drag}
                      widthTitle="Section mosaic width (not field column %). Two ~50% sections sit side by side."
                      onLabelChange={(value) => {
                        setSections(
                          sections.map((item) =>
                            item.id === section.id ? { ...item, label: value } : item,
                          ),
                        )
                        saveDebounced()
                      }}
                      onLabelBlur={flushOnBlur}
                      onWidthChange={(value) => {
                        setSections(
                          sections.map((item) =>
                            item.id === section.id ? { ...item, width: value } : item,
                          ),
                        )
                        saveDebounced()
                      }}
                      headEnd={
                        sections.length > 1 ? (
                          <div className="gantry-section-actions">
                            <button
                              type="button"
                              className="gantry-toolbar-btn danger"
                              onClick={() => {
                                const orphanRows = section.rows
                                const remaining = sections.filter((item) => item.id !== section.id)
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
                          </div>
                        ) : null
                      }
                    >
                      <CanvasRows
                        sectionId={section.id}
                        rows={formRowsToCanvas(section, fields)}
                        paletteMimes={[DND_FORM_FIELD, DND_FORM_UNIQUE]}
                        rowClassName="sf-form-builder-row"
                        emptyRowClassName="sf-form-builder-row-empty"
                        slotsClassName="sf-form-row-slots"
                        emptyMetaClassName="sf-form-empty-row-meta"
                        emptyMetaLabel="Empty row · drop fields here · drag empty zone to reorder"
                        emptyZoneLabel="Drop fields here… · drag to reorder row"
                        resizeLabel="Resize form columns"
                        emptyMessage={
                          <p className="layout-muted">Add a field from the palette, or open + row.</p>
                        }
                        renderItem={(item) => {
                          const field = fieldByCanvasId(item.id)
                          if (!field) return null
                          return (
                            <FieldBar
                              field={field}
                              fields={fields}
                              widthPercent={item.width}
                              onPatch={(patch) => patchField(item.id, patch)}
                              onRename={(nextName) => renameField(item.id, nextName)}
                              onPatchConstraints={(patch) => patchFieldConstraints(item.id, patch)}
                              onUpdateOptions={(options) => patchField(item.id, { options })}
                              onPatchLogic={(key, group) => patchFieldLogic(item.id, key, group)}
                              onRemove={() => removeField(item.id, field.name)}
                              saveNow={saveNow}
                              flushOnBlur={flushOnBlur}
                              siteCaptcha={siteCaptcha}
                              groups={groups}
                            />
                          )
                        }}
                        itemClassName={(item) => {
                          const field = fieldByCanvasId(item.id)
                          const warn =
                            field?.type === 'captcha' ? captchaSiteStatusMessage(siteCaptcha) : null
                          return ['sf-form-slot', warn ? 'sf-form-slot-captcha-warn' : '']
                            .filter(Boolean)
                            .join(' ')
                        }}
                        itemTitle={(item) => {
                          const field = fieldByCanvasId(item.id)
                          const name = field?.label || field?.name || 'field'
                          return 'Drag ' + name + ' to move — blue line shows where it will land'
                        }}
                        onPaletteDrop={(mime, value, rowId) => {
                          if (mime === DND_FORM_UNIQUE) {
                            addUniqueFieldOntoRow(value, section.id, rowId)
                            return
                          }
                          if (isFormFieldType(value)) addFieldOntoRow(value, section.id, rowId)
                        }}
                        onReorderItems={(rowId, orderedIds) => {
                          commitSections(
                            sections.map((item) => {
                              if (item.id !== section.id) return item
                              return {
                                ...item,
                                rows: item.rows.map((row) => {
                                  if (row.id !== rowId) return row
                                  return {
                                    ...row,
                                    columns: orderedIds.flatMap((id) => {
                                      const field = fieldByCanvasId(id)
                                      const col = row.columns.find(
                                        (column) => column.fieldName === field?.name,
                                      )
                                      return col ? [col] : []
                                    }),
                                  }
                                }),
                              }
                            }),
                          )
                        }}
                        onMoveItem={(source, rowId, index) => {
                          const field = fieldByCanvasId(source.itemId)
                          if (!field) return
                          commitSections(
                            moveFieldInSections(sections, field.name, {
                              sectionId: section.id,
                              rowId,
                              index,
                            }),
                          )
                        }}
                        onStackItem={(source, rowId, position) =>
                          stackCanvasField(source, section.id, rowId, position)
                        }
                        onReorderRows={(orderedIds) => {
                          commitSections(
                            sections.map((item) => {
                              if (item.id !== section.id) return item
                              const byId = new Map(item.rows.map((row) => [row.id, row]))
                              return {
                                ...item,
                                rows: orderedIds.flatMap((id) => {
                                  const row = byId.get(id)
                                  return row ? [row] : []
                                }),
                              }
                            }),
                          )
                        }}
                        onResize={(rowId, leftId, _rightId, leftWidth, _rightWidth, commit) => {
                          setSections((prev) => {
                            const current = prev.find((item) => item.id === section.id)
                            const row = current?.rows.find((item) => item.id === rowId)
                            if (!row) return prev
                            const leftIndex = row.columns.findIndex((column) => {
                              const field = fields.find((item) => item.name === column.fieldName)
                              return Boolean(field && fieldKey(field) === leftId)
                            })
                            if (leftIndex < 0) return prev
                            return resizeRowColumns(prev, section.id, rowId, leftIndex, leftWidth)
                          })
                          if (commit) saveDebounced()
                        }}
                        onAddEmptyRow={() => openEmptyRow(section.id)}
                        onRemoveEmptyRow={(rowId) => closeEmptyRow(section.id, rowId)}
                      />
                    </CanvasSectionFrame>
                  )
                })}
              </ol>
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
