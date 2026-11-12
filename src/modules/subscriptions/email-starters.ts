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
  const {
    createEmailTemplate,
    updateEmailTemplate,
    createEmailRule,
    updateEmailRule,
    findEmailTemplateById,
    findEmailRuleById,
  } = await import('@/modules/email-manager/store')

  const created: string[] = []
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

  if (mode === 'ensure') {
    if (!(await findEmailTemplateById(starter.tplId))) {
      const result = await createEmailTemplate(tplPayload)
      if (!('error' in result)) created.push(starter.tplId)
    }
    if (!(await findEmailRuleById(starter.ruleId))) {
      const result = await createEmailRule(rulePayload)
      if (!('error' in result)) created.push(starter.ruleId)
    }
    return created
  }

  const createdTpl = await createEmailTemplate(tplPayload)
  if ('error' in createdTpl) {
    await updateEmailTemplate(tplPayload)
  }
  const createdRule = await createEmailRule(rulePayload)
  if ('error' in createdRule) {
    await updateEmailRule(rulePayload)
  }
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
