/**
 * product:onboarding module settings — document in `sf_module_settings`.
 * Invite + event-type Email Manager template ids, plus event-type Forms / status lists.
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
  DEFAULT_EVENT_TYPE_SETTINGS,
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
  const out = { ...DEFAULT_ONBOARDING_MODULE_SETTINGS.eventTemplateIds }
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    out[key] = asTrimmed(obj[key])
  }
  return out
}

function emptyEventTypeSettings(): Record<
  OnboardingEmailEventType,
  OnboardingEventTypeSettings
> {
  return {
    ridealong: { ...DEFAULT_EVENT_TYPE_SETTINGS, dateFieldNames: [], activeStatusIds: [], completedStatusIds: [] },
    testday: { ...DEFAULT_EVENT_TYPE_SETTINGS, dateFieldNames: [], activeStatusIds: [], completedStatusIds: [] },
    trialday: { ...DEFAULT_EVENT_TYPE_SETTINGS, dateFieldNames: [], activeStatusIds: [], completedStatusIds: [] },
  }
}

export function normalizeOnboardingModuleSettings(raw: unknown): OnboardingModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    inviteTemplateId: asTrimmed(obj.inviteTemplateId),
    eventTemplateIds: parseEventTemplateIds(obj.eventTemplateIds),
    eventTypeSettings: normalizeAllEventTypeSettings(obj.eventTypeSettings),
  }
}

export async function loadOnboardingModuleSettings(): Promise<{
  settings: OnboardingModuleSettings
  source: 'database' | 'default'
  isFallback: boolean
}> {
  const loaded = await loadModuleSettingsDocument(MODULE_IDS.onboarding, () => ({
    ...DEFAULT_ONBOARDING_MODULE_SETTINGS,
    eventTemplateIds: { ...DEFAULT_ONBOARDING_MODULE_SETTINGS.eventTemplateIds },
    eventTypeSettings: emptyEventTypeSettings(),
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

function parseEventTypeSettingsInput(
  raw: Partial<Record<OnboardingEmailEventType, unknown>> | undefined,
  current: Record<OnboardingEmailEventType, OnboardingEventTypeSettings>,
): Record<OnboardingEmailEventType, OnboardingEventTypeSettings> {
  const out = emptyEventTypeSettings()
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    if (raw && raw[key] !== undefined) {
      out[key] = normalizeEventTypeSettings(raw[key])
    } else {
      out[key] = {
        formDefinitionId: current[key].formDefinitionId,
        dateFieldNames: [...current[key].dateFieldNames],
        activeStatusIds: [...current[key].activeStatusIds],
        completedStatusIds: [...current[key].completedStatusIds],
      }
    }
  }
  return out
}

/**
 * Save invite + event-type template bindings and event-type Forms / status settings.
 * Empty template clears. Unknown Email Manager template ids are refused.
 */
export async function saveOnboardingModuleSettings(
  input: Partial<{
    inviteTemplateId: unknown
    eventTemplateIds: Partial<Record<OnboardingEmailEventType, unknown>>
    eventTypeSettings: Partial<Record<OnboardingEmailEventType, unknown>>
  }>,
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

  const eventTemplateIds = { ...current.settings.eventTemplateIds }
  const eventInput = input.eventTemplateIds ?? {}
  for (const key of ONBOARDING_EMAIL_EVENT_TYPES) {
    const candidate = asTrimmed(
      eventInput[key] !== undefined ? eventInput[key] : current.settings.eventTemplateIds[key],
    )
    if (!candidate) {
      eventTemplateIds[key] = ''
      continue
    }
    const exists = await templateExists(candidate)
    const checked = validateEmailTemplateBinding(candidate, () => exists, `${key} template`)
    if (!checked.ok) return checked
    eventTemplateIds[key] = checked.value
  }

  const eventTypeSettings = parseEventTypeSettingsInput(
    input.eventTypeSettings,
    current.settings.eventTypeSettings,
  )

  const next: OnboardingModuleSettings = {
    inviteTemplateId: inviteChecked.value,
    eventTemplateIds,
    eventTypeSettings,
  }
  await saveModuleSettingsDocument(MODULE_IDS.onboarding, {
    ...next,
    eventTemplateIds: { ...next.eventTemplateIds },
    eventTypeSettings: {
      ridealong: { ...next.eventTypeSettings.ridealong },
      testday: { ...next.eventTypeSettings.testday },
      trialday: { ...next.eventTypeSettings.trialday },
    },
  })
  return { ok: true, settings: next }
}
