/**
 * Marketplace inquiry / offer email starters — Email Manager templates + rules.
 * Idempotent ensure; seed refreshes copy. Never call getMailer() here.
 */

import 'server-only'

import {
  MARKETPLACE_INQUIRY_CREATED_TRIGGER,
  MARKETPLACE_OFFER_ACCEPTED_TRIGGER,
  MARKETPLACE_OFFER_RECEIVED_TRIGGER,
} from './triggers'

type StarterDef = {
  tplId: string
  ruleId: string
  tplLabel: string
  ruleLabel: string
  triggerKey: string
  subject: string
  bodyText: string
  audienceKey: 'sellerEmail' | 'buyerEmail'
}

const STARTERS: StarterDef[] = [
  {
    tplId: 'tpl-marketplace-inquiry-created-default',
    ruleId: 'rule-marketplace-inquiry-created-default',
    tplLabel: 'Marketplace — inquiry created',
    ruleLabel: 'Marketplace — notify seller of inquiry',
    triggerKey: MARKETPLACE_INQUIRY_CREATED_TRIGGER,
    subject: 'New inquiry: {{listingTitle}}',
    bodyText:
      'Hi,\n\nSomeone asked about your listing “{{listingTitle}}”.\n\nOpen: {{listingUrl}}\n\n— Starforge Marketplace',
    audienceKey: 'sellerEmail',
  },
  {
    tplId: 'tpl-marketplace-offer-received-default',
    ruleId: 'rule-marketplace-offer-received-default',
    tplLabel: 'Marketplace — offer received',
    ruleLabel: 'Marketplace — notify seller of offer',
    triggerKey: MARKETPLACE_OFFER_RECEIVED_TRIGGER,
    subject: 'Offer on {{listingTitle}}',
    bodyText:
      'Hi,\n\nYou received an offer ({{amountMinor}} minor units) on “{{listingTitle}}”.\n\nOpen: {{listingUrl}}\n\n— Starforge Marketplace',
    audienceKey: 'sellerEmail',
  },
  {
    tplId: 'tpl-marketplace-offer-accepted-default',
    ruleId: 'rule-marketplace-offer-accepted-default',
    tplLabel: 'Marketplace — offer accepted',
    ruleLabel: 'Marketplace — notify buyer offer accepted',
    triggerKey: MARKETPLACE_OFFER_ACCEPTED_TRIGGER,
    subject: 'Offer accepted: {{listingTitle}}',
    bodyText:
      'Hi,\n\nYour offer on “{{listingTitle}}” was accepted.\n\nOpen: {{listingUrl}}\n\n— Starforge Marketplace',
    audienceKey: 'buyerEmail',
  },
]

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
    moduleCategory: 'marketplace' as const,
    subject: starter.subject,
    bodyText: starter.bodyText,
  }
  const rulePayload = {
    id: starter.ruleId,
    label: starter.ruleLabel,
    moduleCategory: 'marketplace' as const,
    enabled: true,
    triggerKey: starter.triggerKey,
    mode: 'automatic' as const,
    conditions: { all: [] as [] },
    audience: { toFromPayload: [starter.audienceKey] },
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

/** Soft-fail; safe on Settings load. */
export async function ensureMarketplaceEmailStartersSeeded(): Promise<{
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
export async function seedMarketplaceEmailStarters(): Promise<{
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
        'Seeded Marketplace email starters (inquiry.created, offer.received, offer.accepted). Edit copy under Email Manager.',
    }
  } catch (error) {
    return {
      ok: false,
      message: '',
      error:
        error instanceof Error
          ? error.message
          : 'Could not seed Marketplace email starters.',
    }
  }
}
