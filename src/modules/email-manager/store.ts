/**
 * Email Manager persistence — templates + rules CRUD.
 */

import 'server-only'

import { and, asc, eq } from 'drizzle-orm'

import { appOrigin } from '@/core/content/metadata'
import { db } from '@/core/db'
import { sanitizeEmailHtml } from '@/modules/rich-editor/api.server'

import { normalizeEmailAudience } from './audience'
import { normalizeEmailConditionGroup } from './conditions'
import { sfEmailRules, sfEmailTemplates } from './schema'
import {
  isEmailModuleCategory,
  isEmailRuleMode,
  type EmailAudience,
  type EmailConditionGroup,
  type EmailModuleCategory,
  type EmailRuleMode,
  type EmailRuleRecord,
  type EmailTemplateRecord,
} from './types'

function mapTemplate(row: typeof sfEmailTemplates.$inferSelect): EmailTemplateRecord {
  return {
    id: row.id,
    label: row.label?.trim() || 'Untitled template',
    moduleCategory: isEmailModuleCategory(row.moduleCategory)
      ? row.moduleCategory
      : 'other',
    subject: row.subject ?? '',
    bodyText: row.bodyText ?? '',
    bodyHtml: row.bodyHtml?.trim() || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapRule(row: typeof sfEmailRules.$inferSelect): EmailRuleRecord {
  return {
    id: row.id,
    label: row.label?.trim() || 'Untitled rule',
    moduleCategory: isEmailModuleCategory(row.moduleCategory)
      ? row.moduleCategory
      : 'other',
    enabled: Boolean(row.enabled),
    triggerKey: row.triggerKey?.trim() || '',
    mode: isEmailRuleMode(row.mode) ? row.mode : 'automatic',
    conditions: normalizeEmailConditionGroup(row.conditions),
    audience: normalizeEmailAudience(row.audience),
    templateId: row.templateId,
    fromOverride: row.fromOverride?.trim() || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function tableMissingMessage(error: unknown, table: string): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes(table) || /does not exist|relation/i.test(msg)) {
    return `${table} missing — run npm run db:migrate (or db:core:push).`
  }
  return null
}

export async function listEmailTemplates(filter?: {
  moduleCategory?: string
}): Promise<EmailTemplateRecord[]> {
  try {
    const cat = filter?.moduleCategory?.trim()
    const rows =
      cat && cat !== 'all'
        ? await db
            .select()
            .from(sfEmailTemplates)
            .where(eq(sfEmailTemplates.moduleCategory, cat))
            .orderBy(asc(sfEmailTemplates.label), asc(sfEmailTemplates.id))
        : await db
            .select()
            .from(sfEmailTemplates)
            .orderBy(asc(sfEmailTemplates.label), asc(sfEmailTemplates.id))
    return rows.map(mapTemplate)
  } catch {
    return []
  }
}

export async function findEmailTemplateById(
  id: string,
): Promise<EmailTemplateRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEmailTemplates)
      .where(eq(sfEmailTemplates.id, trimmed))
      .limit(1)
    return row ? mapTemplate(row) : null
  } catch {
    return null
  }
}

export type UpsertEmailTemplateInput = {
  id?: string
  label: string
  moduleCategory?: string
  subject: string
  bodyText: string
  bodyHtml?: string
}

export async function createEmailTemplate(
  input: UpsertEmailTemplateInput,
): Promise<{ template: EmailTemplateRecord } | { error: string }> {
  const label = input.label.trim().slice(0, 200) || 'Untitled template'
  const moduleCategory: EmailModuleCategory = isEmailModuleCategory(input.moduleCategory)
    ? input.moduleCategory
    : 'other'
  const subject = input.subject.trim().slice(0, 500)
  const bodyText = input.bodyText
  const bodyHtml = sanitizeEmailHtml(input.bodyHtml, { baseUrl: appOrigin() })
  if (!subject) return { error: 'Subject is required.' }
  if (!bodyText.trim() && !bodyHtml) {
    return { error: 'Body text or HTML is required.' }
  }
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfEmailTemplates).values({
      id,
      label,
      moduleCategory,
      subject,
      bodyText,
      bodyHtml: bodyHtml || null,
    })
    const created = await findEmailTemplateById(id)
    if (!created) return { error: 'Template created but could not be reloaded.' }
    return { template: created }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_templates')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create template.',
    }
  }
}

export async function updateEmailTemplate(
  input: UpsertEmailTemplateInput & { id: string },
): Promise<{ template: EmailTemplateRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing template id.' }
  const current = await findEmailTemplateById(id)
  if (!current) return { error: 'Template not found.' }

  const label = input.label.trim().slice(0, 200) || current.label
  const moduleCategory: EmailModuleCategory = isEmailModuleCategory(input.moduleCategory)
    ? input.moduleCategory
    : current.moduleCategory
  const subject = input.subject.trim().slice(0, 500)
  const bodyText = input.bodyText
  const bodyHtml = sanitizeEmailHtml(input.bodyHtml, { baseUrl: appOrigin() })
  if (!subject) return { error: 'Subject is required.' }
  if (!bodyText.trim() && !bodyHtml) {
    return { error: 'Body text or HTML is required.' }
  }

  try {
    await db
      .update(sfEmailTemplates)
      .set({
        label,
        moduleCategory,
        subject,
        bodyText,
        bodyHtml: bodyHtml || null,
      })
      .where(eq(sfEmailTemplates.id, id))
    const updated = await findEmailTemplateById(id)
    if (!updated) return { error: 'Template updated but could not be reloaded.' }
    return { template: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update template.',
    }
  }
}

export async function deleteEmailTemplate(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing template id.' }
  try {
    const linked = await db
      .select({ id: sfEmailRules.id })
      .from(sfEmailRules)
      .where(eq(sfEmailRules.templateId, trimmed))
      .limit(1)
    if (linked[0]) {
      return { error: 'Template is used by one or more rules — reassign or delete those first.' }
    }
    await db.delete(sfEmailTemplates).where(eq(sfEmailTemplates.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete template.',
    }
  }
}

export async function listEmailRules(filter?: {
  moduleCategory?: string
  triggerKey?: string
  enabledOnly?: boolean
}): Promise<EmailRuleRecord[]> {
  try {
    const clauses = []
    const cat = filter?.moduleCategory?.trim()
    if (cat && cat !== 'all') {
      clauses.push(eq(sfEmailRules.moduleCategory, cat))
    }
    const trigger = filter?.triggerKey?.trim()
    if (trigger) {
      clauses.push(eq(sfEmailRules.triggerKey, trigger))
    }
    if (filter?.enabledOnly) {
      clauses.push(eq(sfEmailRules.enabled, true))
    }

    const rows =
      clauses.length > 0
        ? await db
            .select()
            .from(sfEmailRules)
            .where(and(...clauses))
            .orderBy(asc(sfEmailRules.label), asc(sfEmailRules.id))
        : await db
            .select()
            .from(sfEmailRules)
            .orderBy(asc(sfEmailRules.label), asc(sfEmailRules.id))
    return rows.map(mapRule)
  } catch {
    return []
  }
}

export async function findEmailRuleById(id: string): Promise<EmailRuleRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEmailRules)
      .where(eq(sfEmailRules.id, trimmed))
      .limit(1)
    return row ? mapRule(row) : null
  } catch {
    return null
  }
}

export type UpsertEmailRuleInput = {
  id?: string
  label: string
  moduleCategory?: string
  enabled?: boolean
  triggerKey: string
  mode?: string
  conditions?: EmailConditionGroup
  audience?: EmailAudience
  templateId: string
  fromOverride?: string
}

export async function createEmailRule(
  input: UpsertEmailRuleInput,
): Promise<{ rule: EmailRuleRecord } | { error: string }> {
  const label = input.label.trim().slice(0, 200) || 'Untitled rule'
  const moduleCategory: EmailModuleCategory = isEmailModuleCategory(input.moduleCategory)
    ? input.moduleCategory
    : 'other'
  const triggerKey = input.triggerKey.trim().slice(0, 200)
  if (!triggerKey) return { error: 'Trigger is required.' }
  const templateId = input.templateId.trim()
  if (!templateId) return { error: 'Template is required.' }
  const template = await findEmailTemplateById(templateId)
  if (!template) return { error: 'Template not found.' }

  const mode: EmailRuleMode = isEmailRuleMode(input.mode) ? input.mode : 'automatic'
  const conditions = normalizeEmailConditionGroup(input.conditions)
  const audience = normalizeEmailAudience(input.audience)
  if (!(audience.to?.length || audience.toFromPayload?.length)) {
    return { error: 'Audience needs at least one To address or payload path.' }
  }
  const fromOverride = (input.fromOverride || '').trim().slice(0, 320)
  const enabled = input.enabled !== false
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfEmailRules).values({
      id,
      label,
      moduleCategory,
      enabled,
      triggerKey,
      mode,
      conditions,
      audience,
      templateId,
      fromOverride: fromOverride || null,
    })
    const created = await findEmailRuleById(id)
    if (!created) return { error: 'Rule created but could not be reloaded.' }
    return { rule: created }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_rules')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create rule.',
    }
  }
}

export async function updateEmailRule(
  input: UpsertEmailRuleInput & { id: string },
): Promise<{ rule: EmailRuleRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing rule id.' }
  const current = await findEmailRuleById(id)
  if (!current) return { error: 'Rule not found.' }

  const label = input.label.trim().slice(0, 200) || current.label
  const moduleCategory: EmailModuleCategory = isEmailModuleCategory(input.moduleCategory)
    ? input.moduleCategory
    : current.moduleCategory
  const triggerKey = input.triggerKey.trim().slice(0, 200) || current.triggerKey
  if (!triggerKey) return { error: 'Trigger is required.' }
  const templateId = input.templateId.trim() || current.templateId
  const template = await findEmailTemplateById(templateId)
  if (!template) return { error: 'Template not found.' }

  const mode: EmailRuleMode = isEmailRuleMode(input.mode) ? input.mode : current.mode
  const conditions =
    input.conditions !== undefined
      ? normalizeEmailConditionGroup(input.conditions)
      : current.conditions
  const audience =
    input.audience !== undefined
      ? normalizeEmailAudience(input.audience)
      : current.audience
  if (!(audience.to?.length || audience.toFromPayload?.length)) {
    return { error: 'Audience needs at least one To address or payload path.' }
  }
  const fromOverride =
    input.fromOverride !== undefined
      ? input.fromOverride.trim().slice(0, 320)
      : current.fromOverride
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : current.enabled

  try {
    await db
      .update(sfEmailRules)
      .set({
        label,
        moduleCategory,
        enabled,
        triggerKey,
        mode,
        conditions,
        audience,
        templateId,
        fromOverride: fromOverride || null,
      })
      .where(eq(sfEmailRules.id, id))
    const updated = await findEmailRuleById(id)
    if (!updated) return { error: 'Rule updated but could not be reloaded.' }
    return { rule: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update rule.',
    }
  }
}

export async function deleteEmailRule(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing rule id.' }
  try {
    await db.delete(sfEmailRules).where(eq(sfEmailRules.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete rule.',
    }
  }
}

export async function setEmailRuleEnabled(
  id: string,
  enabled: boolean,
): Promise<{ rule: EmailRuleRecord } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing rule id.' }
  try {
    await db
      .update(sfEmailRules)
      .set({ enabled: Boolean(enabled) })
      .where(eq(sfEmailRules.id, trimmed))
    const updated = await findEmailRuleById(trimmed)
    if (!updated) return { error: 'Rule not found.' }
    return { rule: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update rule.',
    }
  }
}
