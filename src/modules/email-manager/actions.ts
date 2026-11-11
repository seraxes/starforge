'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
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

async function requireEmailManagerAdmin(): Promise<EmailAdminActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage Email Manager.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    return {
      error: 'Email Manager is disabled. Enable it under Settings → Modules.',
    }
  }
  return null
}

function revalidateEmailAdmin() {
  revalidatePath('/admin/email')
  revalidatePath('/admin/email/templates')
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
  revalidateEmailAdmin()
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
  const result = await updateEmailTemplate({
    id,
    label: String(formData.get('label') ?? ''),
    moduleCategory: String(formData.get('moduleCategory') ?? 'other'),
    subject: String(formData.get('subject') ?? ''),
    bodyText: String(formData.get('bodyText') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEmailAdmin()
  return {
    ok: true,
    message: `Template “${result.template.label}” saved.`,
    id: result.template.id,
  }
}

export async function deleteEmailTemplateAction(
  _prev: EmailAdminActionState,
  formData: FormData,
): Promise<EmailAdminActionState> {
  const denied = await requireEmailManagerAdmin()
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
  const denied = await requireEmailManagerAdmin()
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
