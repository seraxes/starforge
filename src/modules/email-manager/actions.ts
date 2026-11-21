'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import type { AclGrantLevel } from '@/core/acl/levels'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { normalizeEmailAudience } from './audience'
import { isEmailConditionOp, normalizeEmailConditionGroup } from './conditions'
import { sendEmailManagerTest } from './engine'
import {
  createEmailRule,
  createEmailTemplate,
  deleteEmailRule,
  deleteEmailTemplate,
  setEmailRuleEnabled,
  updateEmailRule,
  updateEmailTemplate,
} from './store'
import type { EmailAdminActionState, EmailCondition, EmailConditionOp } from './types'

export type { EmailAdminActionState }

async function requireEmailManagerAdmin(
  min: AclGrantLevel = 'edit',
): Promise<EmailAdminActionState | null> {
  const admin = await requireAdminArea('admin.email-manager', min)
  if (!admin) {
    return { error: 'Sign in with Email Manager access (Users → ACL) or as an app admin.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    return {
      error: 'Email Manager is disabled. Enable it under Settings → Modules.',
    }
  }
  return null
}

function revalidateEmailAdmin(templateId?: string) {
  revalidatePath('/admin/email')
  revalidatePath('/admin/email/templates')
  revalidatePath('/admin/email/sends')
  revalidatePath('/admin/email/broadcasts')
  revalidatePath('/admin/email/campaigns')
  const id = (templateId || '').trim()
  if (id) revalidatePath(`/admin/email/templates/${id}`)
}

function revalidateEmailCampaignAdmin(campaignId?: string) {
  revalidatePath('/admin/email/campaigns')
  const id = (campaignId || '').trim()
  if (id) revalidatePath(`/admin/email/campaigns/${id}`)
}

function revalidateEmailCampaignSend(campaignId?: string) {
  revalidateEmailCampaignAdmin(campaignId)
  revalidatePath('/admin/email/broadcasts')
}

function parseAfterIntent(formData: FormData): 'apply' | 'save' {
  const raw = String(formData.get('after') ?? 'save').trim().toLowerCase()
  return raw === 'apply' ? 'apply' : 'save'
}

function parseConditionsFromForm(formData: FormData) {
  const raw = String(formData.get('conditionsJson') ?? '').trim()
  if (!raw) return normalizeEmailConditionGroup({ all: [] })
  try {
    return normalizeEmailConditionGroup(JSON.parse(raw))
  } catch {
    // Fallback: single path/op/value fields from the simple editor.
    const path = String(formData.get('conditionPath') ?? '').trim()
    const opRaw = String(formData.get('conditionOp') ?? '').trim()
    const value = String(formData.get('conditionValue') ?? '')
    if (!path || !isEmailConditionOp(opRaw)) {
      return normalizeEmailConditionGroup({ all: [] })
    }
    const cond: EmailCondition = { path, op: opRaw as EmailConditionOp }
    if (opRaw === 'eq' || opRaw === 'neq' || opRaw === 'contains') {
      cond.value = value
    }
    return normalizeEmailConditionGroup({ all: [cond] })
  }
}

function parseAudienceFromForm(formData: FormData) {
  const toRaw = String(formData.get('audienceTo') ?? '')
  const toFromPayloadRaw = String(formData.get('audienceToFromPayload') ?? '')
  const replyTo = String(formData.get('audienceReplyTo') ?? '').trim()
  const replyToFromPayload = String(formData.get('audienceReplyToFromPayload') ?? '').trim()
  return normalizeEmailAudience({
    to: toRaw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    toFromPayload: toFromPayloadRaw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    replyTo: replyTo || undefined,
    replyToFromPayload: replyToFromPayload || undefined,
  })
}

export async function createEmailTemplateAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const result = await createEmailTemplate({
    label: String(formData.get('label') ?? ''),
    moduleCategory: String(formData.get('moduleCategory') ?? 'other'),
    subject: String(formData.get('subject') ?? ''),
    bodyText: String(formData.get('bodyText') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin(result.template.id)
  return {
    ok: true,
    message: `Template “${result.template.label}” created.`,
    id: result.template.id,
  }
}

export async function updateEmailTemplateAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const after = parseAfterIntent(formData)
  const result = await updateEmailTemplate({
    id,
    label: String(formData.get('label') ?? ''),
    moduleCategory: String(formData.get('moduleCategory') ?? 'other'),
    subject: String(formData.get('subject') ?? ''),
    bodyText: String(formData.get('bodyText') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin(result.template.id)
  return {
    ok: true,
    message: `Template “${result.template.label}” saved.`,
    id: result.template.id,
    after,
  }
}

export async function deleteEmailTemplateAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteEmailTemplate(id)
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return { ok: true, message: 'Template deleted.', id }
}

export async function createEmailRuleAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const result = await createEmailRule({
    label: String(formData.get('label') ?? ''),
    moduleCategory: String(formData.get('moduleCategory') ?? 'other'),
    enabled: String(formData.get('enabled') ?? '1') !== '0',
    triggerKey: String(formData.get('triggerKey') ?? ''),
    mode: String(formData.get('mode') ?? 'automatic'),
    conditions: parseConditionsFromForm(formData),
    audience: parseAudienceFromForm(formData),
    templateId: String(formData.get('templateId') ?? ''),
    fromOverride: String(formData.get('fromOverride') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return {
    ok: true,
    message: `Rule “${result.rule.label}” created.`,
    id: result.rule.id,
  }
}

export async function updateEmailRuleAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const result = await updateEmailRule({
    id,
    label: String(formData.get('label') ?? ''),
    moduleCategory: String(formData.get('moduleCategory') ?? 'other'),
    enabled: String(formData.get('enabled') ?? '1') !== '0',
    triggerKey: String(formData.get('triggerKey') ?? ''),
    mode: String(formData.get('mode') ?? 'automatic'),
    conditions: parseConditionsFromForm(formData),
    audience: parseAudienceFromForm(formData),
    templateId: String(formData.get('templateId') ?? ''),
    fromOverride: String(formData.get('fromOverride') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return {
    ok: true,
    message: `Rule “${result.rule.label}” saved.`,
    id: result.rule.id,
  }
}

export async function toggleEmailRuleAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const enabled = String(formData.get('enabled') ?? '1') !== '0'
  const result = await setEmailRuleEnabled(id, enabled)
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return {
    ok: true,
    message: enabled ? 'Rule enabled.' : 'Rule disabled.',
    id: result.rule.id,
  }
}

export async function deleteEmailRuleAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteEmailRule(id)
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return { ok: true, message: 'Rule deleted.', id }
}

export async function testEmailSendAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const result = await sendEmailManagerTest({
    to: String(formData.get('to') ?? ''),
    subject: String(formData.get('subject') ?? 'Starforge Email Manager test'),
    text: String(formData.get('text') ?? 'Test message from Email Manager.'),
    html: String(formData.get('html') ?? ''),
    from: String(formData.get('from') ?? ''),
  })

  if (!result.ok) {
    return {
      error:
        result.error ||
        (result.skipped
          ? 'Send skipped (Chrome email off or module disabled).'
          : 'Test send failed.'),
    }
  }

  const provider = result.provider || 'mailer'
  return {
    ok: true,
    message:
      provider === 'console'
        ? 'Test logged via console Mailer (check server logs).'
        : `Test accepted by ${provider}.`,
  }
}

/** Seed / refresh Forms starter templates + rules (fixed ids; overwrites content). */
export async function seedFormsEmailStartersAction(
  _prev: EmailAdminActionState,
  _formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const { seedFormsEmailStarters } = await import('./forms-starters')
  const result = await seedFormsEmailStarters()
  if (!result.ok) {
    return { error: result.error || 'Could not seed Forms starters.' }
  }

  revalidateEmailAdmin()
  return {
    ok: true,
    message: result.message,
  }
}

/** Save paced-broadcast batch / gap settings. */
export async function saveEmailManagerSettingsAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied

  const { saveEmailManagerModuleSettings } = await import('./settings')
  try {
    const saved = await saveEmailManagerModuleSettings({
      broadcastBatchSize: Number(formData.get('broadcastBatchSize')),
      broadcastGapMinutes: Number(formData.get('broadcastGapMinutes')),
    })
    revalidateEmailAdmin()
    return {
      ok: true,
      message: `Pace rules saved (${saved.broadcastBatchSize} every ${saved.broadcastGapMinutes} minutes).`,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save pace rules.',
    }
  }
}

export async function pauseEmailBroadcastAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const { pauseEmailBroadcast } = await import('./broadcast-engine')
  const result = await pauseEmailBroadcast(id)
  if (!result.ok) return { error: result.error || 'Pause failed.', id }
  revalidateEmailAdmin()
  return { ok: true, message: 'Broadcast paused.', id }
}

export async function resumeEmailBroadcastAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const { resumeEmailBroadcast } = await import('./broadcast-engine')
  const result = await resumeEmailBroadcast(id)
  if (!result.ok) return { error: result.error || 'Resume failed.', id }
  revalidateEmailAdmin()
  return { ok: true, message: 'Broadcast resumed.', id }
}

export async function cancelEmailBroadcastAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const { cancelEmailBroadcast } = await import('./broadcast-engine')
  const result = await cancelEmailBroadcast(id)
  if (!result.ok) return { error: result.error || 'Cancel failed.', id }
  revalidateEmailAdmin()
  return { ok: true, message: 'Broadcast cancelled.', id }
}

export async function createEmailCampaignAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const { createEmailCampaign } = await import('./campaign-store')
  const result = await createEmailCampaign({
    label: String(formData.get('label') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailCampaignAdmin(result.campaign.id)
  return {
    ok: true,
    message: `Campaign “${result.campaign.label}” created.`,
    id: result.campaign.id,
  }
}

export async function updateEmailCampaignAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const { updateEmailCampaignDraft } = await import('./campaign-store')
  const { EMAIL_BROADCAST_RECIPIENT_CAP } = await import('./types')
  const result = await updateEmailCampaignDraft({
    id,
    label: String(formData.get('label') ?? ''),
    templateId: String(formData.get('templateId') ?? ''),
    recipientsPaste: String(formData.get('recipients') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailCampaignAdmin(result.campaign.id)

  const capNote = result.truncated
    ? ` First ${EMAIL_BROADCAST_RECIPIENT_CAP} addresses kept; the rest were left off.`
    : ''
  return {
    ok: true,
    message: `Campaign “${result.campaign.label}” saved (${result.recipientCount} recipient${result.recipientCount === 1 ? '' : 's'}).${capNote}`,
    id: result.campaign.id,
  }
}

export async function deleteEmailCampaignAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const { deleteEmailCampaign } = await import('./campaign-store')
  const result = await deleteEmailCampaign(id)
  if ('error' in result) return { error: result.error }
  revalidateEmailCampaignAdmin()
  return { ok: true, message: 'Campaign deleted.', id }
}

/**
 * Save draft fields (same as update), then enqueue one paced broadcast.
 * Does not call getMailer — enqueueEmailBroadcast owns transport.
 */
export async function sendEmailCampaignAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin('manage')
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Campaign id is required.' }

  const {
    findEmailCampaignById,
    linkEmailCampaignBroadcast,
    listEmailCampaignRecipientEmails,
    updateEmailCampaignDraft,
  } = await import('./campaign-store')

  const existing = await findEmailCampaignById(id)
  if (!existing) return { error: 'Campaign not found.', id }

  if (existing.broadcastId || existing.status !== 'draft') {
    return {
      error: existing.broadcastId
        ? 'This campaign already has a broadcast and cannot be queued again.'
        : `Only draft campaigns can be sent (status is “${existing.status}”).`,
      id,
    }
  }

  const saved = await updateEmailCampaignDraft({
    id,
    label: String(formData.get('label') ?? ''),
    templateId: String(formData.get('templateId') ?? ''),
    recipientsPaste: String(formData.get('recipients') ?? ''),
  })
  if ('error' in saved) return { error: saved.error, id }

  const campaign = saved.campaign
  if (!campaign.templateId) {
    return { error: 'Template is required before send.', id }
  }
  if (saved.recipientCount <= 0) {
    return { error: 'Add at least one recipient before send.', id }
  }

  const emails = await listEmailCampaignRecipientEmails(campaign.id)
  if (emails.length === 0) {
    return { error: 'Add at least one recipient before send.', id }
  }

  const { enqueueEmailBroadcast } = await import('./broadcast-engine')
  const enqueued = await enqueueEmailBroadcast({
    label: campaign.label,
    templateId: campaign.templateId,
    moduleCategory: campaign.moduleCategory,
    sourceKey: `email-campaign:${campaign.id}`,
    recipients: emails.map((email) => ({ email, payload: {} })),
  })

  if (!enqueued.ok) {
    revalidateEmailCampaignSend(campaign.id)
    return {
      error: enqueued.error || 'Could not queue the campaign broadcast.',
      id: campaign.id,
    }
  }

  const broadcastId = (enqueued.broadcastId || '').trim()
  if (!broadcastId) {
    revalidateEmailCampaignSend(campaign.id)
    return {
      error: 'Broadcast queued but no broadcast id was returned.',
      id: campaign.id,
    }
  }

  // Success or alreadyRunning with a broadcastId — attach and mark sending.
  const linked = await linkEmailCampaignBroadcast({
    id: campaign.id,
    broadcastId,
  })
  if ('error' in linked) {
    revalidateEmailCampaignSend(campaign.id)
    return { error: linked.error, id: campaign.id }
  }

  revalidateEmailCampaignSend(linked.campaign.id)
  const total = enqueued.totalCount ?? emails.length
  const already = enqueued.alreadyRunning
    ? ' An in-flight broadcast for this campaign was reused.'
    : ''
  return {
    ok: true,
    message: `Campaign “${linked.campaign.label}” queued to ${total} recipient${total === 1 ? '' : 's'}.${already}`,
    id: linked.campaign.id,
  }
}
