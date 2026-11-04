/**
 * Client-safe helpers for generic module settings documents (M2).
 * No DB — used by unit tests and packs that normalize before save.
 */

/** Coerce unknown JSON into a plain object (else empty). */
export function asModuleSettingsDocument(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, unknown>) }
}

/** Merge defaults under a stored/partial document (shallow). */
export function mergeModuleSettingsDocument(
  defaults: Record<string, unknown>,
  raw: unknown,
): Record<string, unknown> {
  return { ...defaults, ...asModuleSettingsDocument(raw) }
}
