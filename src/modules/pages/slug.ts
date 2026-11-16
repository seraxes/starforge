/**
 * Shared page slug (v1). One slug for every locale.
 * `home` is the public site root (`/{locale}`), not `/{locale}/home`.
 */
export function normalizePageSlug(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return ''
  if (trimmed === 'home') return 'home'
  return trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** Tag slug from a display title. Empty when the title has no slug characters. */
export function normalizePageTagSlug(raw: string): string {
  return normalizePageSlug(raw === 'home' ? 'home-tag' : raw)
}
