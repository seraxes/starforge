/**
 * Onboarding builds Forms builder URLs for the Edit dialog.
 * Forms owns embed=1 and the save; Onboarding only opens the URL.
 */

export type OnboardingFormDefinitionEmbedUrlResult =
  | { ok: true; url: string; formId: string }
  | { ok: false; error: string }

/**
 * Build `/admin/forms/[formId]?embed=1` for a stored Forms definition id.
 * Empty id is refused and does not build a URL (dialog must not open).
 */
export function buildOnboardingFormDefinitionEmbedUrl(
  formIdRaw: unknown,
): OnboardingFormDefinitionEmbedUrlResult {
  const formId = String(formIdRaw ?? '').trim()
  if (!formId) {
    return { ok: false, error: 'Empty form id.' }
  }
  return {
    ok: true,
    formId,
    url: `/admin/forms/${encodeURIComponent(formId)}?embed=1`,
  }
}
