/** Shared public date formatting for event list / detail. */

export function formatEventWhen(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  timezone: string,
): string {
  const start = toDate(startsAt)
  if (!start) return ''
  const tz = timezone.trim() || 'UTC'
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: tz,
  }
  try {
    const startLabel = new Intl.DateTimeFormat(undefined, opts).format(start)
    const end = toDate(endsAt)
    if (!end) return startLabel
    const endLabel = new Intl.DateTimeFormat(undefined, opts).format(end)
    return `${startLabel} – ${endLabel}`
  } catch {
    return start.toISOString()
  }
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
