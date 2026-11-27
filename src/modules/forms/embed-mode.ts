/**
 * product:forms — embed query for the visual builder.
 * Consumers (e.g. Onboarding) open `/admin/forms/[formId]?embed=1` in a dialog.
 * Forms owns the flag: embed=1 hides the admin shell and Forms section nav.
 */

/** True when `embed=1` — hide admin shell chrome and Forms section nav. */
export function isFormBuilderEmbedMode(embedRaw: unknown): boolean {
  return String(embedRaw ?? '').trim() === '1'
}
