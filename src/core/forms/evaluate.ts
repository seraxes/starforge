/**
 * Runtime Form evaluation: visibility, computed values, math validation.
 * Used by FormWidget (client) and submit/Zod path (server).
 */

import { validateDateTimeValue, isDateTimeFieldType, normalizeValueForType } from './date-constraints'
import { evaluateFormExpression, formatComputedFixed } from './expr'
import { isFieldRequired, isFieldVisible } from './logic'
import type { FormFieldDef } from './types'

export type FormEvaluateResult = {
  values: Record<string, string>
  visible: Record<string, boolean>
  required: Record<string, boolean>
  computed: Record<string, string>
  error?: string
}

function applyComputed(fields: FormFieldDef[], values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  for (const field of fields) {
    if (field.type !== 'computed' || !field.computed?.expression) continue
    if (!isFieldVisible(field, next)) {
      next[field.name] = ''
      continue
    }
    const result = evaluateFormExpression(field.computed.expression, next)
    if (!result.ok || typeof result.value === 'boolean') {
      next[field.name] = ''
      continue
    }
    const precision = field.computed.precision ?? 2
    next[field.name] = formatComputedFixed(result.value, precision)
  }
  return next
}

function checkNumberBounds(field: FormFieldDef, values: Record<string, string>): string | null {
  if (field.type !== 'number' && field.type !== 'computed') return null
  const raw = values[field.name] ?? ''
  if (!raw.trim()) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return `Enter a valid number for ${(field.label || field.name).toLowerCase()}.`

  const bounds = field.numberBounds
  if (!bounds) return null
  let min = bounds.min
  let max = bounds.max
  if (bounds.minExpr) {
    const r = evaluateFormExpression(bounds.minExpr, values)
    if (r.ok && typeof r.value === 'number') min = r.value
  }
  if (bounds.maxExpr) {
    const r = evaluateFormExpression(bounds.maxExpr, values)
    if (r.ok && typeof r.value === 'number') max = r.value
  }
  const label = field.label || field.name
  if (min != null && n < min) return `${label} must be at least ${min}.`
  if (max != null && n > max) return `${label} must be at most ${max}.`
  return null
}

function checkValidateExpr(field: FormFieldDef, values: Record<string, string>): string | null {
  if (!field.validateExpr?.expression) return null
  if (!isFieldVisible(field, values)) return null
  const r = evaluateFormExpression(field.validateExpr.expression, values)
  if (!r.ok) {
    return field.validateExpr.message || `Invalid expression for ${field.label || field.name}.`
  }
  const truthy = typeof r.value === 'boolean' ? r.value : r.value !== 0
  if (!truthy) {
    return (
      field.validateExpr.message ||
      `${field.label || field.name} failed validation.`
    )
  }
  return null
}

/**
 * Merge raw submitted values with computed fields, then validate visible fields.
 */
export function evaluateAndValidateFields(
  fields: FormFieldDef[],
  rawValues: Record<string, string>,
): FormEvaluateResult {
  const withComputed = applyComputed(fields, rawValues)
  const visible: Record<string, boolean> = {}
  const required: Record<string, boolean> = {}
  const computed: Record<string, string> = {}
  const values: Record<string, string> = {}

  for (const field of fields) {
    const show = isFieldVisible(field, withComputed)
    visible[field.name] = show
    required[field.name] = isFieldRequired(field, withComputed)
    if (field.type === 'computed') {
      computed[field.name] = withComputed[field.name] ?? ''
    }
    if (!show) {
      values[field.name] = ''
      continue
    }
    values[field.name] = withComputed[field.name] ?? ''
  }

  for (const field of fields) {
    if (!visible[field.name]) continue
    const label = field.label || field.name
    const raw = values[field.name] ?? ''

    if (required[field.name]) {
      if (field.type === 'checkbox') {
        if (!(raw === 'on' || raw === 'true' || raw === '1')) {
          return { values, visible, required, computed, error: `${label} is required.` }
        }
      } else if (!raw.trim()) {
        return { values, visible, required, computed, error: `${label} is required.` }
      }
    }

    if (!raw.trim() && field.type !== 'checkbox') continue

    if (field.type === 'email' && raw) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return {
          values,
          visible,
          required,
          computed,
          error: `Enter a valid ${label.toLowerCase()}.`,
        }
      }
    }

    if (field.type === 'url' && raw) {
      try {
        // eslint-disable-next-line no-new
        new URL(raw)
      } catch {
        return {
          values,
          visible,
          required,
          computed,
          error: `Enter a valid URL for ${label.toLowerCase()}.`,
        }
      }
    }

    if (field.type === 'number' && raw) {
      if (Number.isNaN(Number(raw))) {
        return {
          values,
          visible,
          required,
          computed,
          error: `Enter a valid number for ${label.toLowerCase()}.`,
        }
      }
    }

    if ((field.type === 'select' || field.type === 'radio') && field.options?.length) {
      const allowed = field.options.map((o) => o.value)
      if (raw && !allowed.includes(raw)) {
        return {
          values,
          visible,
          required,
          computed,
          error: `Choose a valid ${label.toLowerCase()}.`,
        }
      }
    }

    if (field.type === 'checkbox-group' && field.options?.length && raw) {
      const allowed = new Set(field.options.map((o) => o.value))
      const picked = raw.split(',').map((s) => s.trim()).filter(Boolean)
      if (picked.some((p) => !allowed.has(p))) {
        return {
          values,
          visible,
          required,
          computed,
          error: `Choose valid options for ${label.toLowerCase()}.`,
        }
      }
    }

    if (isDateTimeFieldType(field.type)) {
      const err = validateDateTimeValue({ ...field, required: required[field.name] }, raw)
      if (err) return { values, visible, required, computed, error: err }
      if (raw) {
        values[field.name] = normalizeValueForType(field.type, raw) ?? raw
      }
    }

    const boundErr = checkNumberBounds(field, values)
    if (boundErr) return { values, visible, required, computed, error: boundErr }

    const exprErr = checkValidateExpr(field, values)
    if (exprErr) return { values, visible, required, computed, error: exprErr }
  }

  // Normalize checkboxes for storage
  for (const field of fields) {
    if (field.type === 'checkbox' && visible[field.name]) {
      const raw = values[field.name]
      values[field.name] = raw === 'on' || raw === 'true' || raw === '1' ? 'true' : 'false'
    }
  }

  return { values, visible, required, computed }
}

/** Live computed map for the widget (no full validation). */
export function computeLiveValues(
  fields: FormFieldDef[],
  values: Record<string, string>,
): {
  values: Record<string, string>
  visible: Record<string, boolean>
  required: Record<string, boolean>
} {
  const withComputed = applyComputed(fields, values)
  const visible: Record<string, boolean> = {}
  const required: Record<string, boolean> = {}
  for (const field of fields) {
    visible[field.name] = isFieldVisible(field, withComputed)
    required[field.name] = isFieldRequired(field, withComputed)
  }
  return { values: withComputed, visible, required }
}
