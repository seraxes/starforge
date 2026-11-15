/**
 * Subscriptions lifecycle email starters — Email Manager templates + rules.
 * Idempotent ensure; seed refreshes copy. Never call getMailer() here.
 */

import 'server-only'

type StarterDef = {
  tplId: string
  ruleId: string
  tplLabel: string
  ruleLabel: string
  triggerKey: string
  subject: string
  bodyText: string
}

const STARTERS: StarterDef[] = [
  {
    tplId: 'tpl-subscriptions-activated-default',
    ruleId: 'rule-subscriptions-activated-default',
    tplLabel: 'Subscriptions — activated',
    ruleLabel: 'Subscriptions — activated',
    triggerKey: 'product:subscriptions/activated',
    subject: 'Subscription active: {{subject}}',
    bodyText:
      'Hi,\n\nYour subscription is active.\nPlan: {{planId}}\nEnds: {{endsAt}}\n\nManage: /account/subscriptions\n\n— Starforge',
  },
  {
    tplId: 'tpl-subscriptions-renewed-default',
    ruleId: 'rule-subscriptions-renewed-default',
    tplLabel: 'Subscriptions — renewed',
    ruleLabel: 'Subscriptions — renewed',
    triggerKey: 'product:subscriptions/renewed',
    subject: 'Subscription renewed: {{subject}}',
    bodyText:
      'Hi,\n\nYour subscription was renewed.\nPlan: {{planId}}\nNew end: {{endsAt}}\n\nManage: /account/subscriptions\n\n— Starforge',
  },
  {
    tplId: 'tpl-subscriptions-upgraded-default',
    ruleId: 'rule-subscriptions-upgraded-default',
    tplLabel: 'Subscriptions — upgraded',
    ruleLabel: 'Subscriptions — upgraded',
    triggerKey: 'product:subscriptions/upgraded',
    subject: 'Subscription upgraded: {{subject}}',
    bodyText:
      'Hi,\n\nYour subscription was upgraded.\nPlan: {{planId}}\nEnds: {{endsAt}}\n\nManage: /account/subscriptions\n\n— Starforge',
  },
  {
    tplId: 'tpl-subscriptions-expiring-soon-default',
    ruleId: 'rule-subscriptions-expiring-soon-default',
    tplLabel: 'Subscriptions — expiring soon',
    ruleLabel: 'Subscriptions — expiring soon',
    triggerKey: 'product:subscriptions/expiring_soon',
    subject: 'Subscription ending soon: {{subject}}',
    bodyText:
      'Hi,\n\nYour subscription ends on {{endsAt}} (within {{withinDays}} days).\nPlan: {{planId}}\n\nRenew: /account/subscriptions\n\n— Starforge',
  },
  {
    tplId: 'tpl-subscriptions-trial-ending-default',
    ruleId: 'rule-subscriptions-trial-ending-default',
    tplLabel: 'Subscriptions — trial ending',
    ruleLabel: 'Subscriptions — trial ending',
    triggerKey: 'product:subscriptions/trial_ending',
    subject: 'Trial ending soon: {{subject}}',
    bodyText:
      'Hi,\n\nYour trial ends on {{endsAt}} (within {{withinDays}} days).\nPlan: {{planId}}\n\nSubscribe: /account/subscriptions\n\n— Starforge',
  },
  {
    tplId: 'tpl-subscriptions-expired-default',
    ruleId: 'rule-subscriptions-expired-default',
    tplLabel: 'Subscriptions — expired',
    ruleLabel: 'Subscriptions — expired',
    triggerKey: 'product:subscriptions/expired',
    subject: 'Subscription ended: {{subject}}',
    bodyText:
      'Hi,\n\nYour subscription has ended.\nPlan: {{planId}}\nStatus: {{status}}\n\nRenew: /account/subscriptions\n\n— Starforge',
  },
]

const audience = { toFromPayload: ['buyerEmail'] }

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
    moduleCategory: 'subscriptions' as const,
    subject: starter.subject,
    bodyText: starter.bodyText,
  }
  const rulePayload = {
    id: starter.ruleId,
    label: starter.ruleLabel,
    moduleCategory: 'subscriptions' as const,
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

/** Soft-fail; safe on Settings load / expiry arm. */
export async function ensureSubscriptionsEmailStartersSeeded(): Promise<{
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

/** Admin Seed button — create or refresh starters. */
export async function seedSubscriptionsEmailStarters(): Promise<{
  ok: boolean
  message: string
  error?: string
}> {
  try {
    for (const starter of STARTERS) {
      await upsertStarter(starter, 'seed')
    }
    return {
      ok: true,
      message:
        'Seeded Subscriptions email starters (activated, renewed, upgraded, expiring_soon, trial_ending, expired). Edit copy under Email Manager.',
    }
  } catch (error) {
    return {
      ok: false,
      message: '',
      error: error instanceof Error ? error.message : 'Could not seed Subscriptions email starters.',
    }
  }
}
