/**
 * Onboarding builds Email Manager template-editor URLs for the Edit dialog.
 * Email Manager owns embed=1 and the save; Onboarding only opens the URL.
 */

export type OnboardingEmailTemplateEmbedUrlResult =
  | { ok: true; url: string; templateId: string }
  | { ok: false; error: string }

/**
 * Build `/admin/email/templates/[id]?embed=1` for a stored template id.
 * Empty id is refused and does not build a URL (dialog must not open).
 */
export function buildOnboardingEmailTemplateEmbedUrl(
  templateIdRaw: unknown,
): OnboardingEmailTemplateEmbedUrlResult {
  const templateId = String(templateIdRaw ?? '').trim()
  if (!templateId) {
    return { ok: false, error: 'Empty template id.' }
  }
  return {
    ok: true,
    templateId,
    url: `/admin/email/templates/${encodeURIComponent(templateId)}?embed=1`,
  }
}
