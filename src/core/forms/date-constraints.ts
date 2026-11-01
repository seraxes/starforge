/**
 * Date / time / datetime constraint helpers (client-safe).
 * Canonical values use HTML input shapes:
 * - date: `YYYY-MM-DD`
 * - time: `HH:mm` (seconds optional)
 * - datetime: `YYYY-MM-DDTHH:mm` (seconds optional)
 */

import type {
  FormDateTimeConstraints,
  FormFieldDef,
  FormFieldType,
  FormWeekday,
} from './types'

export const FORM_WEEKDAY_LABELS: { value: FormWeekday; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
]

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function isDateTimeFieldType(
  type: FormFieldType,
): type is 'date' | 'time' | 'datetime' {
  return type === 'date' || type === 'time' || type === 'datetime'
}

export function htmlInputTypeForField(
  type: FormFieldType,
): 'date' | 'time' | 'datetime-local' | null {
  if (type === 'date') return 'date'
  if (type === 'time') return 'time'
  if (type === 'datetime') return 'datetime-local'
  return null
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Normalize time to `HH:mm` (drop seconds). */
export function normalizeTimeValue(raw: string): string | null {
  const m = TIME_RE.exec(raw.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  const ss = m[3] !== undefined ? Number(m[3]) : 0
  if (hh > 23 || mm > 59 || ss > 59) return null
  return `${pad2(hh)}:${pad2(mm)}`
}

function formatDateParts(y: number, mo: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${pad2(mo)}-${pad2(d)}`
}

export function parseDateParts(raw: string): { y: number; mo: number; d: number } | null {
  const m = DATE_RE.exec(raw.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null
  }
  return { y, mo, d }
}

export function normalizeDateString(raw: string): string | null {
  const parts = parseDateParts(raw)
  if (!parts) return null
  return formatDateParts(parts.y, parts.mo, parts.d)
}

export function normalizeDateTimeValue(raw: string): string | null {
  const trimmed = raw.trim().replace(' ', 'T')
  const m = DATETIME_RE.exec(trimmed)
  if (!m) return null
  const date = normalizeDateString(`${m[1]}-${m[2]}-${m[3]}`)
  const time = normalizeTimeValue(`${m[4]}:${m[5]}${m[6] !== undefined ? `:${m[6]}` : ''}`)
  if (!date || !time) return null
  return `${date}T${time}`
}

export function normalizeValueForType(
  type: 'date' | 'time' | 'datetime',
  raw: string,
): string | null {
  if (type === 'date') return normalizeDateString(raw)
  if (type === 'time') return normalizeTimeValue(raw)
  return normalizeDateTimeValue(raw)
}

function weekdayFromDateParts(y: number, mo: number, d: number): FormWeekday {
  // UTC noon avoids DST edge cases; getUTCDay matches civil weekday for calendar dates.
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay() as FormWeekday
}

function compareDateStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareTimeStrings(a: string, b: string): number {
  const na = normalizeTimeValue(a)
  const nb = normalizeTimeValue(b)
  if (!na || !nb) return 0
  return na < nb ? -1 : na > nb ? 1 : 0
}

function compareDateTimeStrings(a: string, b: string): number {
  const na = normalizeDateTimeValue(a)
  const nb = normalizeDateTimeValue(b)
  if (!na || !nb) return 0
  return na < nb ? -1 : na > nb ? 1 : 0
}

export function normalizeWeekdays(raw: unknown): FormWeekday[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: FormWeekday[] = []
  const seen = new Set<number>()
  for (const entry of raw) {
    const n = typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN
    if (!Number.isInteger(n) || n < 0 || n > 6 || seen.has(n)) continue
    seen.add(n)
    out.push(n as FormWeekday)
  }
  return out.length ? out.sort((a, b) => a - b) : undefined
}

export function normalizeDaysOfMonth(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: number[] = []
  const seen = new Set<number>()
  for (const entry of raw) {
    const n = typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN
    if (!Number.isInteger(n) || n < 1 || n > 31 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.length ? out.sort((a, b) => a - b) : undefined
}

/** Normalize constraint bound for a field type; drop invalid values. */
export function normalizeBoundForType(
  type: 'date' | 'time' | 'datetime',
  raw: unknown,
): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return normalizeValueForType(type, raw) ?? undefined
}

export function normalizeDateTimeConstraints(
  type: FormFieldType,
  raw: unknown,
): FormDateTimeConstraints | undefined {
  if (!isDateTimeFieldType(type)) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const constraints: FormDateTimeConstraints = {}
  const min = normalizeBoundForType(type, row.min)
  const max = normalizeBoundForType(type, row.max)
  if (min) constraints.min = min
  if (max) constraints.max = max
  if (type !== 'time') {
    const weekdays = normalizeWeekdays(row.weekdays)
    const daysOfMonth = normalizeDaysOfMonth(row.daysOfMonth)
    if (weekdays) constraints.weekdays = weekdays
    if (daysOfMonth) constraints.daysOfMonth = daysOfMonth
  }
  if (!constraints.min && !constraints.max && !constraints.weekdays && !constraints.daysOfMonth) {
    return undefined
  }
  // Drop inverted range (keep both; Zod will fail closed with a clear message).
  return constraints
}

export function emptyConstraints(): FormDateTimeConstraints {
  return {}
}

/** Human hint for help text / inspector summary. */
export function describeDateTimeConstraints(
  type: 'date' | 'time' | 'datetime',
  c: FormDateTimeConstraints | undefined,
): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.min) parts.push(`from ${c.min}`)
  if (c.max) parts.push(`to ${c.max}`)
  if (type !== 'time' && c.weekdays?.length) {
    const labels = FORM_WEEKDAY_LABELS.filter((w) => c.weekdays!.includes(w.value)).map(
      (w) => w.short,
    )
    parts.push(labels.join('/'))
  }
  if (type !== 'time' && c.daysOfMonth?.length) {
    parts.push(`days ${c.daysOfMonth.join(',')}`)
  }
  return parts.join(' · ')
}

/**
 * Validate a submitted string against type + constraints.
 * Returns null when valid, otherwise an error message.
 */
export function validateDateTimeValue(
  field: FormFieldDef,
  raw: string,
): string | null {
  if (!isDateTimeFieldType(field.type)) return null
  const label = field.label || field.name
  const trimmed = raw.trim()
  if (!trimmed) {
    return field.required !== false ? `${label} is required.` : null
  }

  const normalized = normalizeValueForType(field.type, trimmed)
  if (!normalized) {
    if (field.type === 'date') return `Enter a valid date for ${label.toLowerCase()}.`
    if (field.type === 'time') return `Enter a valid time for ${label.toLowerCase()}.`
    return `Enter a valid date and time for ${label.toLowerCase()}.`
  }

  const c = field.constraints
  if (c?.min) {
    const cmp =
      field.type === 'date'
        ? compareDateStrings(normalized, c.min)
        : field.type === 'time'
          ? compareTimeStrings(normalized, c.min)
          : compareDateTimeStrings(normalized, c.min)
    if (cmp < 0) return `${label} must be on or after ${c.min}.`
  }
  if (c?.max) {
    const cmp =
      field.type === 'date'
        ? compareDateStrings(normalized, c.max)
        : field.type === 'time'
          ? compareTimeStrings(normalized, c.max)
          : compareDateTimeStrings(normalized, c.max)
    if (cmp > 0) return `${label} must be on or before ${c.max}.`
  }

  if (field.type !== 'time') {
    const datePart = field.type === 'date' ? normalized : normalized.slice(0, 10)
    const parts = parseDateParts(datePart)
    if (!parts) return `Enter a valid date for ${label.toLowerCase()}.`

    if (c?.weekdays?.length) {
      const wd = weekdayFromDateParts(parts.y, parts.mo, parts.d)
      if (!c.weekdays.includes(wd)) {
        const labels = FORM_WEEKDAY_LABELS.filter((w) => c.weekdays!.includes(w.value))
          .map((w) => w.label)
          .join(', ')
        return `${label} must fall on: ${labels}.`
      }
    }
    if (c?.daysOfMonth?.length && !c.daysOfMonth.includes(parts.d)) {
      return `${label} must be on day ${c.daysOfMonth.join(', ')} of the month.`
    }
  }

  return null
}
