/**
 * product:email-manager — embed query for the template editor.
 * Consumers (e.g. Onboarding) open `/admin/email/templates/[id]?embed=1` in a dialog.
 * Email Manager owns the flag: embed=1 hides the admin shell and Email section nav.
 */

/** True when `embed=1` — hide admin shell chrome and Email section nav. */
export function isEmailTemplateEmbedMode(embedRaw: unknown): boolean {
  return String(embedRaw ?? '').trim() === '1'
}
