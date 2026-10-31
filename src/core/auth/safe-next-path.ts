/** Only allow same-origin relative paths (blocks open redirects). */
export function safeNextPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback
  }
  return next
}
