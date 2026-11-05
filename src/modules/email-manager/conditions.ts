/**
 * Simple Email Manager condition evaluation (AND group on trigger payload).
 */

import type { EmailCondition, EmailConditionGroup, EmailConditionOp } from './types'

const OPS: readonly EmailConditionOp[] = [
  'eq',
  'neq',
  'contains',
  'exists',
  'truthy',
  'falsy',
]

export function isEmailConditionOp(value: unknown): value is EmailConditionOp {
  return typeof value === 'string' && (OPS as readonly string[]).includes(value)
}

/** Resolve `a.b.c` against a plain object; missing → undefined. */
export function resolvePayloadPath(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path
    .trim()
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return undefined
  let cur: unknown = payload
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function asComparableString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(asComparableString).join(',')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    return s !== '' && s !== '0' && s !== 'false' && s !== 'no'
  }
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function evaluateEmailCondition(
  condition: EmailCondition,
  payload: Record<string, unknown>,
): boolean {
  const path = (condition.path || '').trim()
  if (!path) return false
  const actual = resolvePayloadPath(payload, path)
  const op = condition.op

  switch (op) {
    case 'exists':
      return actual !== undefined && actual !== null
    case 'truthy':
      return isTruthy(actual)
    case 'falsy':
      return !isTruthy(actual)
    case 'eq':
      return asComparableString(actual) === asComparableString(condition.value)
    case 'neq':
      return asComparableString(actual) !== asComparableString(condition.value)
    case 'contains': {
      const hay = asComparableString(actual).toLowerCase()
      const needle = asComparableString(condition.value).toLowerCase()
      if (!needle) return false
      return hay.includes(needle)
    }
    default:
      return false
  }
}

/**
 * AND-group: every listed condition must pass. Empty / missing `all` → true
 * (automatic rules and unconditional conditional rules).
 */
export function evaluateEmailConditionGroup(
  group: EmailConditionGroup | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  const all = group?.all
  if (!all?.length) return true
  return all.every((c) => evaluateEmailCondition(c, payload))
}

export function normalizeEmailConditionGroup(raw: unknown): EmailConditionGroup {
  if (!raw || typeof raw !== 'object') return { all: [] }
  const rec = raw as { all?: unknown }
  if (!Array.isArray(rec.all)) return { all: [] }
  const all: EmailCondition[] = []
  for (const row of rec.all) {
    if (!row || typeof row !== 'object') continue
    const r = row as { path?: unknown; op?: unknown; value?: unknown }
    const path = typeof r.path === 'string' ? r.path.trim() : ''
    if (!path || !isEmailConditionOp(r.op)) continue
    const cond: EmailCondition = { path, op: r.op }
    if (r.value !== undefined) {
      if (
        typeof r.value === 'string' ||
        typeof r.value === 'number' ||
        typeof r.value === 'boolean' ||
        r.value === null
      ) {
        cond.value = r.value
      } else {
        cond.value = asComparableString(r.value)
      }
    }
    all.push(cond)
  }
  return { all }
}
