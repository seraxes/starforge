/**
 * Finite event-series expand (create-time copies).
 * Not a live RRULE engine — expand once, store seriesId links.
 */

export const EVENT_SERIES_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type EventSeriesFrequency = (typeof EVENT_SERIES_FREQUENCIES)[number]

export const EVENT_SERIES_END_MODES = ['count', 'until'] as const
export type EventSeriesEndMode = (typeof EVENT_SERIES_END_MODES)[number]

/** Hard cap so one create cannot flood the list. */
export const MAX_SERIES_OCCURRENCES = 52

export type EventSeriesPattern = {
  frequency: EventSeriesFrequency
  /** Every N days / weeks / months. Min 1. */
  interval: number
  /**
   * Weekly only: 0=Sun … 6=Sat.
   * Empty → use the first start’s weekday.
   */
  weekdays: number[]
  endMode: EventSeriesEndMode
  /** When endMode is count — total occurrences including the first. */
  count: number | null
  /** When endMode is until — inclusive local calendar date (YYYY-MM-DD). */
  until: string | null
}

export function isEventSeriesFrequency(value: unknown): value is EventSeriesFrequency {
  return (
    typeof value === 'string' &&
    (EVENT_SERIES_FREQUENCIES as readonly string[]).includes(value)
  )
}

export function isEventSeriesEndMode(value: unknown): value is EventSeriesEndMode {
  return (
    typeof value === 'string' &&
    (EVENT_SERIES_END_MODES as readonly string[]).includes(value)
  )
}

export function parseEventSeriesPattern(raw: unknown): EventSeriesPattern | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!isEventSeriesFrequency(obj.frequency)) return null
  const intervalRaw = Number(obj.interval)
  const interval =
    Number.isFinite(intervalRaw) && intervalRaw >= 1 ? Math.min(52, Math.floor(intervalRaw)) : 1
  const weekdays = Array.isArray(obj.weekdays)
    ? [
        ...new Set(
          obj.weekdays
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
      ].sort((a, b) => a - b)
    : []
  const endMode: EventSeriesEndMode = isEventSeriesEndMode(obj.endMode)
    ? obj.endMode
    : 'count'
  let count: number | null = null
  if (endMode === 'count') {
    const n = Number(obj.count)
    count =
      Number.isFinite(n) && n >= 1
        ? Math.min(MAX_SERIES_OCCURRENCES, Math.floor(n))
        : 2
  }
  let until: string | null = null
  if (endMode === 'until') {
    const s = String(obj.until ?? '').trim()
    until = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
    if (!until) return null
  }
  return {
    frequency: obj.frequency,
    interval,
    weekdays,
    endMode,
    count,
    until,
  }
}

/** Read create-form recurrence fields. Null when disabled or invalid. */
export function parseSeriesPatternFromForm(formData: FormData): EventSeriesPattern | null {
  if (String(formData.get('recurringEnabled') ?? '') !== '1') return null
  const frequencyRaw = String(formData.get('recurringFrequency') ?? 'weekly').trim()
  if (!isEventSeriesFrequency(frequencyRaw)) return null
  const interval = Number(String(formData.get('recurringInterval') ?? '1').trim())
  const weekdays = formData
    .getAll('recurringWeekday')
    .map((v) => Number(String(v)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  const endModeRaw = String(formData.get('recurringEndMode') ?? 'count').trim()
  const endMode: EventSeriesEndMode = isEventSeriesEndMode(endModeRaw)
    ? endModeRaw
    : 'count'
  return parseEventSeriesPattern({
    frequency: frequencyRaw,
    interval,
    weekdays,
    endMode,
    count: String(formData.get('recurringCount') ?? '4').trim(),
    until: String(formData.get('recurringUntil') ?? '').trim(),
  })
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfLocalDayFromYmd(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map((p) => Number(p))
  return new Date(y, m - 1, day, 23, 59, 59, 999)
}

function combineLocalDateWithTime(day: Date, timeSource: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  )
}

function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function addLocalMonthsClamped(d: Date, months: number, dayOfMonth: number): Date {
  const next = new Date(d)
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, dim))
  next.setHours(
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  )
  return next
}

function weekIndexSunday(d: Date): number {
  const start = startOfLocalDay(d)
  const sunday = addLocalDays(start, -start.getDay())
  return Math.floor(sunday.getTime() / 86_400_000)
}

/**
 * Expand a finite list of occurrence starts from the first start + pattern.
 * First start is always included when valid.
 */
export function expandSeriesStarts(
  firstStart: Date,
  pattern: EventSeriesPattern,
): Date[] {
  if (Number.isNaN(firstStart.getTime())) return []

  const maxCount =
    pattern.endMode === 'count' && pattern.count
      ? Math.min(MAX_SERIES_OCCURRENCES, Math.max(1, pattern.count))
      : MAX_SERIES_OCCURRENCES
  const until = pattern.endMode === 'until' && pattern.until
    ? endOfLocalDayFromYmd(pattern.until)
    : null
  const interval = Math.max(1, pattern.interval)

  if (pattern.frequency === 'daily') {
    const out: Date[] = []
    let occ = new Date(firstStart)
    while (out.length < maxCount) {
      if (until && occ.getTime() > until.getTime()) break
      out.push(new Date(occ))
      occ = addLocalDays(occ, interval)
    }
    return out
  }

  if (pattern.frequency === 'monthly') {
    const out: Date[] = []
    const dayOfMonth = firstStart.getDate()
    let occ = new Date(firstStart)
    while (out.length < maxCount) {
      if (until && occ.getTime() > until.getTime()) break
      out.push(new Date(occ))
      occ = addLocalMonthsClamped(occ, interval, dayOfMonth)
    }
    return out
  }

  // weekly
  const weekdays = (
    pattern.weekdays.length > 0 ? pattern.weekdays : [firstStart.getDay()]
  ).slice()
  const out: Date[] = []
  const firstWeek = weekIndexSunday(firstStart)
  let cursor = startOfLocalDay(firstStart)
  let guard = 0
  const guardMax = MAX_SERIES_OCCURRENCES * 7 * interval + 14

  while (out.length < maxCount && guard < guardMax) {
    guard += 1
    if (until && cursor.getTime() > until.getTime()) break
    const day = cursor.getDay()
    if (weekdays.includes(day)) {
      const weeksSince = weekIndexSunday(cursor) - firstWeek
      if (weeksSince >= 0 && weeksSince % interval === 0) {
        const occ = combineLocalDateWithTime(cursor, firstStart)
        if (occ.getTime() + 60_000 >= firstStart.getTime()) {
          if (!until || occ.getTime() <= until.getTime()) {
            out.push(occ)
          }
        }
      }
    }
    cursor = addLocalDays(cursor, 1)
  }
  return out
}

/** YYYY-MM-DD suffix for occurrence slugs. */
export function occurrenceDateSuffix(startsAt: Date): string {
  return localYmd(startsAt)
}
