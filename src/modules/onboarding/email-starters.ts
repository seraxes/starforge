/**
 * Onboarding Email Manager starters — templates + rules.
 * Idempotent ensure; seed refreshes copy. Never call getMailer() here.
 * Slice 8: seeding a missing starter creates the Email Manager template and stores that id.
 */

import 'server-only'

import type { OnboardingEmailEventType } from './email-binding-rules'
import { saveOnboardingModuleSettings, loadOnboardingModuleSettings } from './settings'
import { ensureSeededStatuses, listStatuses, updateStatus } from './store'

type StarterDef = {
  tplId: string
  ruleId: string
  tplLabel: string
  ruleLabel: string
  triggerKey: string
  subject: string
  bodyText: string
}

/** Stable Email Manager template ids used for bindings. */
export const ONBOARDING_STARTER_TEMPLATE_IDS = {
  accountInvite: 'tpl-onboarding-account-invite-default',
  application: 'tpl-onboarding-application-default',
  statusReminder: 'tpl-onboarding-status-reminder-default',
  ridealong: 'tpl-onboarding-event-ridealong-default',
  trialday: 'tpl-onboarding-event-trialday-default',
  testday: 'tpl-onboarding-event-testday-default',
} as const

const STARTERS: StarterDef[] = [
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.accountInvite,
    ruleId: 'rule-onboarding-account-invite-default',
    tplLabel: 'Onboarding — account invite',
    ruleLabel: 'Onboarding — account invite',
    triggerKey: 'product:onboarding/account_invite',
    subject: 'Welcome — set your password',
    bodyText:
      'Hi {{name}},\n\nYour account is ready. Set a password, then open the application form.\n\nSet password: {{resetLink}}\nApplication: {{formLink}}\n\n— Onboarding',
  },
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.application,
    ruleId: 'rule-onboarding-application-default',
    tplLabel: 'Onboarding — application',
    ruleLabel: 'Onboarding — application',
    triggerKey: 'product:onboarding/application',
    subject: 'Application form',
    bodyText:
      'Hi {{name}},\n\nPlease complete your application.\nForm: {{formLink}}\n\n— Onboarding',
  },
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.statusReminder,
    ruleId: 'rule-onboarding-status-reminder-default',
    tplLabel: 'Onboarding — status reminder',
    ruleLabel: 'Onboarding — status reminder',
    triggerKey: 'product:onboarding/status_reminder',
    subject: 'Reminder: {{status}}',
    bodyText:
      'Hi {{name}},\n\nA reminder about your onboarding step: {{status}}.\n\nOpen: {{link}}\nEmail: {{email}}\nPhone: {{phone}}\n\n— Onboarding',
  },
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.ridealong,
    ruleId: 'rule-onboarding-event-ridealong-default',
    tplLabel: 'Onboarding — ride-along confirm',
    ruleLabel: 'Onboarding — ride-along confirm',
    triggerKey: 'product:onboarding/event_ridealong',
    subject: 'Ride-along confirmation',
    bodyText:
      'Hi {{name}},\n\nYour ride-along is confirmed.\nDate: {{date}}\nTime: {{time}}\nDepot: {{depot}}\nAddress: {{address}}\nTrainer: {{trainerName}} {{trainerPhone}}\n\n— Onboarding',
  },
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.trialday,
    ruleId: 'rule-onboarding-event-trialday-default',
    tplLabel: 'Onboarding — trial day confirm',
    ruleLabel: 'Onboarding — trial day confirm',
    triggerKey: 'product:onboarding/event_trialday',
    subject: 'Trial day confirmation',
    bodyText:
      'Hi {{name}},\n\nYour trial day is confirmed.\nDate: {{date}}\nTime: {{time}}\nDepot: {{depot}}\nAddress: {{address}}\nTrainer: {{trainerName}} {{trainerPhone}}\n\n— Onboarding',
  },
  {
    tplId: ONBOARDING_STARTER_TEMPLATE_IDS.testday,
    ruleId: 'rule-onboarding-event-testday-default',
    tplLabel: 'Onboarding — test day confirm',
    ruleLabel: 'Onboarding — test day confirm',
    triggerKey: 'product:onboarding/event_testday',
    subject: 'Exam day confirmation',
    bodyText:
      'Hi {{name}},\n\nYour exam day is confirmed.\nDate: {{date}}\nTime: {{time}}\nDepot: {{depot}}\nAddress: {{address}}\nTrainer: {{trainerName}} {{trainerPhone}}\nExam: {{examUrl}}\n\n— Onboarding',
  },
]

const EVENT_STARTER_IDS: Record<OnboardingEmailEventType, string> = {
  ridealong: ONBOARDING_STARTER_TEMPLATE_IDS.ridealong,
  testday: ONBOARDING_STARTER_TEMPLATE_IDS.testday,
  trialday: ONBOARDING_STARTER_TEMPLATE_IDS.trialday,
}

const audience = { toFromPayload: ['email'] }

async function upsertStarter(
  starter: StarterDef,
  mode: 'ensure' | 'seed',
): Promise<string[]> {
  const { findEmailRuleById, findEmailTemplateById, seedEmailStarter } = await import(
    '@/modules/email-manager/api.server'
  )

  const tplPayload = {
    id: starter.tplId,
    label: starter.tplLabel,
    moduleCategory: 'other' as const,
    subject: starter.subject,
    bodyText: starter.bodyText,
  }
  const rulePayload = {
    id: starter.ruleId,
    label: starter.ruleLabel,
    moduleCategory: 'other' as const,
    enabled: true,
    triggerKey: starter.triggerKey,
    mode: 'automatic' as const,
    conditions: { all: [] as [] },
    audience,
    templateId: starter.tplId,
  }

  if (mode === 'seed') {
    await seedEmailStarter({ template: tplPayload, rule: rulePayload, mode: 'seed' })
    return []
  }

  const hadTemplate = Boolean(await findEmailTemplateById(starter.tplId))
  const hadRule = Boolean(await findEmailRuleById(starter.ruleId))
  await seedEmailStarter({ template: tplPayload, rule: rulePayload, mode: 'ensure' })
  const created: string[] = []
  if (!hadTemplate && (await findEmailTemplateById(starter.tplId))) created.push(starter.tplId)
  if (!hadRule && (await findEmailRuleById(starter.ruleId))) created.push(starter.ruleId)
  return created
}

/** Soft-fail; safe on admin page load. */
export async function ensureOnboardingEmailStartersSeeded(): Promise<{
  ok: boolean
  created: string[]
}> {
  const created: string[] = []
  try {
    for (const starter of STARTERS) {
      const ids = await upsertStarter(starter, 'ensure')
      created.push(...ids)
    }
    return { ok: true, created }
  } catch {
    return { ok: false, created }
  }
}

/**
 * After starters exist in Email Manager, fill empty Onboarding bindings with those ids.
 * Does not overwrite a binding that already has a template id.
 */
export async function bindOnboardingEmailStarterDefaults(): Promise<{
  ok: boolean
  bound: string[]
  error?: string
}> {
  const bound: string[] = []
  try {
    await ensureOnboardingEmailStartersSeeded()

    const loaded = await loadOnboardingModuleSettings()
    let inviteTemplateId = loaded.settings.inviteTemplateId

    if (!inviteTemplateId.trim()) {
      inviteTemplateId = ONBOARDING_STARTER_TEMPLATE_IDS.accountInvite
      const saved = await saveOnboardingModuleSettings({ inviteTemplateId })
      if (!saved.ok) return { ok: false, bound, error: saved.error }
      bound.push('invite')
    }

    const { ensureSeededEventTypes, updateEventType } = await import('./event-type-store')
    const types = await ensureSeededEventTypes()
    for (const key of Object.keys(EVENT_STARTER_IDS) as OnboardingEmailEventType[]) {
      const row = types.find((type) => type.key === key)
      if (!row || row.templateId.trim()) continue
      const updated = await updateEventType(row.id, {
        templateId: EVENT_STARTER_IDS[key],
      })
      if (!updated.ok) return { ok: false, bound, error: updated.error }
      bound.push(`event:${key}`)
    }

    await ensureSeededStatuses()
    const statuses = await listStatuses()
    for (const status of statuses) {
      if (status.phase !== 'recruiting') continue
      if (status.reminderTemplateId.trim()) continue
      const updated = await updateStatus(status.id, {
        reminderTemplateId: ONBOARDING_STARTER_TEMPLATE_IDS.statusReminder,
      })
      if (!updated.ok) return { ok: false, bound, error: updated.error }
      bound.push(`reminder:${status.key}`)
    }

    return { ok: true, bound }
  } catch (error) {
    return {
      ok: false,
      bound,
      error:
        error instanceof Error
          ? error.message
          : 'Could not bind Onboarding email starter templates.',
    }
  }
}

/** Admin Seed button — create or refresh starters, then bind empty Onboarding ids. */
export async function seedOnboardingEmailStarters(): Promise<{
  ok: boolean
  message: string
  error?: string
}> {
  try {
    for (const starter of STARTERS) {
      await upsertStarter(starter, 'seed')
    }
    const bound = await bindOnboardingEmailStarterDefaults()
    if (!bound.ok) {
      return {
        ok: false,
        message: '',
        error: bound.error ?? 'Starters seeded but binding failed.',
      }
    }
    const bindNote =
      bound.bound.length > 0
        ? ` Bound empty Onboarding settings: ${bound.bound.join(', ')}.`
        : ' Bindings already set.'
    return {
      ok: true,
      message:
        'Seeded Onboarding email starters (account invite, application, status reminder, ride-along, trial day, test day). Edit copy under Email Manager.' +
        bindNote,
    }
  } catch (error) {
    return {
      ok: false,
      message: '',
      error:
        error instanceof Error ? error.message : 'Could not seed Onboarding email starters.',
    }
  }
}
