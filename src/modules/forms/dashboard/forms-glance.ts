/**
 * Pure formatters for the Forms submissions glance card.
 * Keep free of `server-only` so unit tests can import without the pg pool.
 */

/**
 * Compact “Latest” cell for the Forms glance card (no visual redesign).
 * Empty inbox → null (widget shows “—”).
 */
export function formatFormsLatestGlance(
  createdAt: Date | null | undefined,
  formKey?: string | null,
): string | null {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null
  const stamp = createdAt.toISOString().slice(0, 16).replace('T', ' ')
  const key = typeof formKey === 'string' ? formKey.trim() : ''
  if (key) return `${key} · ${stamp} UTC`
  return `${stamp} UTC`
}
