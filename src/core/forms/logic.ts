/**
 * Conditional show / require evaluation for Form fields (client-safe).
 */

import type {
  FormCondition,
  FormConditionGroup,
  FormConditionOp,
  FormFieldDef,
  FormFieldLogic,
} from './types'

const OPS = new Set<FormConditionOp>([
  'eq',
  'neq',
  'in',
  'notIn',
  'empty',
  'notEmpty',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
])

export function isFormConditionOp(value: unknown): value is FormConditionOp {
  return typeof value === 'string' && OPS.has(value as FormConditionOp)
}

function asList(value: string | string[] | undefined): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => String(v))
  // checkbox-group / multi may be comma-joined
  if (value.includes(',') && !value.includes('|')) {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [value]
}

function isEmptyValue(raw: string | undefined): boolean {
  if (raw == null) return true
  const t = raw.trim()
  return t === '' || t === 'false'
}

function toComparableNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function evaluateCondition(
  condition: FormCondition,
  values: Record<string, string>,
): boolean {
  const left = values[condition.field] ?? ''
  switch (condition.op) {
    case 'empty':
      return isEmptyValue(left)
    case 'notEmpty':
      return !isEmptyValue(left)
    case 'eq':
      return left === String(condition.value ?? '')
    case 'neq':
      return left !== String(condition.value ?? '')
    case 'contains':
      return left.toLowerCase().includes(String(condition.value ?? '').toLowerCase())
    case 'in': {
      const list = asList(condition.value)
      return list.includes(left)
    }
    case 'notIn': {
      const list = asList(condition.value)
      return !list.includes(left)
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toComparableNumber(left)
      const b = toComparableNumber(String(condition.value ?? ''))
      if (a == null || b == null) return false
      if (condition.op === 'gt') return a > b
      if (condition.op === 'gte') return a >= b
      if (condition.op === 'lt') return a < b
      return a <= b
    }
    default:
      return false
  }
}

export function evaluateConditionGroup(
  group: FormConditionGroup | undefined,
  values: Record<string, string>,
): boolean {
  if (!group || !group.conditions.length) return true
  if (group.logic === 'or') {
    return group.conditions.some((c) => evaluateCondition(c, values))
  }
  return group.conditions.every((c) => evaluateCondition(c, values))
}

export function isFieldVisible(field: FormFieldDef, values: Record<string, string>): boolean {
  if (!field.logic?.showWhen) return true
  return evaluateConditionGroup(field.logic.showWhen, values)
}

export function isFieldRequired(field: FormFieldDef, values: Record<string, string>): boolean {
  if (!isFieldVisible(field, values)) return false
  if (field.logic?.requireWhen) {
    return evaluateConditionGroup(field.logic.requireWhen, values)
  }
  if (field.type === 'checkbox' || field.type === 'checkbox-group') {
    return field.required === true
  }
  if (field.type === 'computed') return false
  return field.required !== false
}

export function normalizeCondition(raw: unknown): FormCondition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const field = typeof row.field === 'string' ? row.field.trim() : ''
  if (!field || !isFormConditionOp(row.op)) return null
  const condition: FormCondition = { field, op: row.op }
  if (row.op !== 'empty' && row.op !== 'notEmpty') {
    if (Array.isArray(row.value)) {
      condition.value = row.value.map((v) => String(v))
    } else if (row.value != null) {
      condition.value = String(row.value)
    }
  }
  return condition
}

export function normalizeConditionGroup(raw: unknown): FormConditionGroup | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const logic = row.logic === 'or' ? 'or' : 'and'
  const conditions = Array.isArray(row.conditions)
    ? row.conditions.map(normalizeCondition).filter((c): c is FormCondition => Boolean(c))
    : []
  if (!conditions.length) return undefined
  return { logic, conditions }
}

export function normalizeFieldLogic(raw: unknown): FormFieldLogic | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const showWhen = normalizeConditionGroup(row.showWhen)
  const requireWhen = normalizeConditionGroup(row.requireWhen)
  if (!showWhen && !requireWhen) return undefined
  return { showWhen, requireWhen }
}

export const FORM_CONDITION_OP_LABELS: { value: FormConditionOp; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'in', label: 'is one of' },
  { value: 'notIn', label: 'is not one of' },
  { value: 'empty', label: 'is empty' },
  { value: 'notEmpty', label: 'is not empty' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
]
