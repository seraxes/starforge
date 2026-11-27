/**
 * Pure email-template binding rules for Onboarding.
 * Onboarding stores Email Manager template ids only — subject/body stay in Email Manager.
 */

import type { OnboardingStatusPhase } from './status-rules'

/** Event kinds that carry a confirmation template binding in settings. */
export const ONBOARDING_EMAIL_EVENT_TYPES = ['ridealong', 'testday', 'trialday'] as const

export type OnboardingEmailEventType = (typeof ONBOARDING_EMAIL_EVENT_TYPES)[number]

export type TemplateExistsFn = (templateId: string) => boolean

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

/**
 * Reminder template on a status.
 * Empty clears. Non-recruiting + non-empty is refused. Unknown id is refused.
 */
export function validateReminderTemplateBinding(
  phase: OnboardingStatusPhase,
  templateIdRaw: unknown,
  templateExists: TemplateExistsFn,
): { ok: true; value: string } | { ok: false; error: string } {
  const templateId = asTrimmed(templateIdRaw)
  if (!templateId) return { ok: true, value: '' }

  if (phase !== 'recruiting') {
    return {
      ok: false,
      error:
        'Reminder templates can only bind to recruiting statuses. Clear the reminder or keep the phase as recruiting.',
    }
  }

  if (!templateExists(templateId)) {
    return { ok: false, error: 'Unknown email template id.' }
  }

  return { ok: true, value: templateId }
}

/**
 * Invite or event-type template binding in Onboarding settings.
 * Empty clears. Unknown id is refused.
 */
export function validateEmailTemplateBinding(
  templateIdRaw: unknown,
  templateExists: TemplateExistsFn,
  label = 'Email template',
): { ok: true; value: string } | { ok: false; error: string } {
  const templateId = asTrimmed(templateIdRaw)
  if (!templateId) return { ok: true, value: '' }

  if (!templateExists(templateId)) {
    return { ok: false, error: `Unknown ${label.toLowerCase()} id.` }
  }

  return { ok: true, value: templateId }
}

export function isOnboardingEmailEventType(raw: unknown): raw is OnboardingEmailEventType {
  return (ONBOARDING_EMAIL_EVENT_TYPES as readonly string[]).includes(asTrimmed(raw))
}
