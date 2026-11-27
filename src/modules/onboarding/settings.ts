/**
 * product:onboarding module settings — document in `sf_module_settings`.
 * Invite Email Manager template id only.
 * Event-type template ids and Forms / status lists live on `sf_onboarding_event_types`.
 */

import 'server-only'

import {
  loadModuleSettingsDocument,
  saveModuleSettingsDocument,
} from '@/core/modules/module-settings-store'
import { MODULE_IDS } from '@/core/settings'

import {
  ONBOARDING_EMAIL_EVENT_TYPES,
  validateEmailTemplateBinding,
  type OnboardingEmailEventType,
} from './email-binding-rules'
import {
  normalizeAllEventTypeSettings,
  normalizeEventTypeSettings,
  type OnboardingEventTypeSettings,
} from './event-type-settings-rules'
import {
  DEFAULT_ONBOARDING_MODULE_SETTINGS,
  type OnboardingModuleSettings,
} from './types'

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function parseEventTemplateIds(raw: unknown): Record<OnboardingEmailEventType, string> {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = { ridealong: '', testday: '', trialday: '' }
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    out[key] = asTrimmed(obj[key])
  }
  return out
}

export type LegacyEventTypeSeed = OnboardingEventTypeSettings & { templateId: string }

/**
 * Read event-type values saved before the catalog table.
 * Used once, when a seed row is inserted. Missing keys are empty.
 */
export function readLegacyEventTypeSeed(
  rawDocument: unknown,
): Partial<Record<string, LegacyEventTypeSeed>> {
  const obj =
    rawDocument && typeof rawDocument === 'object' && !Array.isArray(rawDocument)
      ? (rawDocument as Record<string, unknown>)
      : {}
  const templates = parseEventTemplateIds(obj.eventTemplateIds)
  const settings = normalizeAllEventTypeSettings(obj.eventTypeSettings)
  const out: Partial<Record<string, LegacyEventTypeSeed>> = {}
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    const row = normalizeEventTypeSettings(settings[key])
    out[key] = { ...row, templateId: templates[key] }
  }
  return out
}

export function normalizeOnboardingModuleSettings(raw: unknown): OnboardingModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    inviteTemplateId: asTrimmed(obj.inviteTemplateId),
  }
}

export async function loadOnboardingModuleSettings(): Promise<{
  settings: OnboardingModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.onboarding, () => ({
    ...DEFAULT_ONBOARDING_MODULE_SETTINGS,
  }))
  return {
    settings: normalizeOnboardingModuleSettings(loaded.document),
    source: loaded.source,
    isFallback: loaded.isFallback,
  }
}

export type OnboardingSettingsMutationResult =
  | { ok: true; settings: OnboardingModuleSettings }
  | { ok: false; error: string }

async function templateExists(templateId: string): Promise<boolean> {
  const id = templateId.trim()
  if (!id) return false
  try {
    const { findEmailTemplateById } = await import('@/modules/email-manager/api.server')
    return Boolean(await findEmailTemplateById(id))
  } catch {
    return false
  }
}

/**
 * Save the invite template id. Empty clears. Unknown Email Manager template ids are refused.
 * Copies legacy event-type settings onto the catalog before replacing the document,
 * so a save does not drop values that have not been seeded yet.
 */
export async function saveOnboardingModuleSettings(
  input: Partial<{ inviteTemplateId: unknown }>,
): Promise<OnboardingSettingsMutationResult> {
  const current = await loadOnboardingModuleSettings()

  const inviteCandidate = asTrimmed(
    input.inviteTemplateId !== undefined
      ? input.inviteTemplateId
      : current.settings.inviteTemplateId,
  )
  const inviteExists = inviteCandidate ? await templateExists(inviteCandidate) : false
  const inviteChecked = validateEmailTemplateBinding(
    inviteCandidate,
    () => inviteExists,
    'Invite template',
  )
  if (!inviteChecked.ok) return inviteChecked

  let seeded = false
  try {
    const { ensureSeededEventTypes } = await import('./event-type-store')
    await ensureSeededEventTypes()
    seeded = true
  } catch {
    seeded = false
  }

  const loaded = await loadModuleSettingsDocument(MODULE_IDS.onboarding, () => ({}))
  const next: OnboardingModuleSettings = { inviteTemplateId: inviteChecked.value }
  const document = seeded ? next : { ...loaded.document, ...next }
  await saveModuleSettingsDocument(MODULE_IDS.onboarding, document)
  return { ok: true, settings: next }
}
