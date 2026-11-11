/**
 * Forms success-mail starters — admin + respondent rules on product:forms/submitted.
 * Idempotent: creates missing templates/rules only; does not overwrite edits.
 */

import 'server-only'

import {
  createEmailRule,
  createEmailTemplate,
  findEmailRuleById,
  findEmailTemplateById,
} from './store'

export const FORMS_ADMIN_TEMPLATE_ID = 'tpl-forms-admin-default'
export const FORMS_RESPONDENT_TEMPLATE_ID = 'tpl-forms-respondent-default'
export const FORMS_ADMIN_RULE_ID = 'rule-forms-admin-default'
export const FORMS_RESPONDENT_RULE_ID = 'rule-forms-respondent-default'

const ADMIN_TEMPLATE = {
  id: FORMS_ADMIN_TEMPLATE_ID,
  label: 'Forms — admin notify',
  moduleCategory: 'forms' as const,
  subject: '[Starforge Form] {{formTitle}}',
  bodyText: 'Form: {{formTitle}}\n\n{{payloadText}}',
}

const RESPONDENT_TEMPLATE = {
  id: FORMS_RESPONDENT_TEMPLATE_ID,
  label: 'Forms — respondent confirm',
  moduleCategory: 'forms' as const,
  subject: 'We received your {{formTitle}} submission',
  bodyText:
    'Thanks — we received your submission.\n\nForm: {{formTitle}}\n\n{{payloadText}}',
}

const ADMIN_RULE = {
  id: FORMS_ADMIN_RULE_ID,
  label: 'Forms — notify admin',
  moduleCategory: 'forms' as const,
  enabled: true,
  triggerKey: 'product:forms/submitted',
  mode: 'conditional' as const,
  conditions: {
    all: [{ path: 'notifyAdmin', op: 'truthy' as const }],
  },
  audience: { toFromPayload: ['adminEmails'] },
  templateId: FORMS_ADMIN_TEMPLATE_ID,
}

const RESPONDENT_RULE = {
  id: FORMS_RESPONDENT_RULE_ID,
  label: 'Forms — notify respondent',
  moduleCategory: 'forms' as const,
  enabled: true,
  triggerKey: 'product:forms/submitted',
  mode: 'conditional' as const,
  conditions: {
    all: [{ path: 'notifyRespondent', op: 'truthy' as const }],
  },
  audience: { toFromPayload: ['respondentEmail'] },
  templateId: FORMS_RESPONDENT_TEMPLATE_ID,
}

/**
 * Ensure Forms starter templates + conditional rules exist.
 * Soft-fails; safe to call on every form submit / admin page load.
 */
export async function ensureFormsEmailStartersSeeded(): Promise<{
  ok: boolean
  created: string[]
}> {
  const created: string[] = []

  try {
    if (!(await findEmailTemplateById(FORMS_ADMIN_TEMPLATE_ID))) {
      const result = await createEmailTemplate(ADMIN_TEMPLATE)
      if (!('error' in result)) created.push(FORMS_ADMIN_TEMPLATE_ID)
    }

    if (!(await findEmailTemplateById(FORMS_RESPONDENT_TEMPLATE_ID))) {
      const result = await createEmailTemplate(RESPONDENT_TEMPLATE)
      if (!('error' in result)) created.push(FORMS_RESPONDENT_TEMPLATE_ID)
    }

    if (!(await findEmailRuleById(FORMS_ADMIN_RULE_ID))) {
      const result = await createEmailRule(ADMIN_RULE)
      if (!('error' in result)) created.push(FORMS_ADMIN_RULE_ID)
    }

    if (!(await findEmailRuleById(FORMS_RESPONDENT_RULE_ID))) {
      const result = await createEmailRule(RESPONDENT_RULE)
      if (!('error' in result)) created.push(FORMS_RESPONDENT_RULE_ID)
    }

    return { ok: true, created }
  } catch {
    return { ok: false, created }
  }
}

/** Force-create or refresh Forms starters (admin Seed button). */
export async function seedFormsEmailStarters(): Promise<{
  ok: boolean
  message: string
  error?: string
}> {
  const { updateEmailRule, updateEmailTemplate } = await import('./store')

  const adminTpl = await createEmailTemplate(ADMIN_TEMPLATE)
  if ('error' in adminTpl) {
    const updated = await updateEmailTemplate(ADMIN_TEMPLATE)
    if ('error' in updated && !updated.error.includes('not found')) {
      return { ok: false, message: '', error: updated.error }
    }
  }

  const respondentTpl = await createEmailTemplate(RESPONDENT_TEMPLATE)
  if ('error' in respondentTpl) {
    await updateEmailTemplate(RESPONDENT_TEMPLATE)
  }

  const adminRule = await createEmailRule(ADMIN_RULE)
  if ('error' in adminRule) {
    await updateEmailRule(ADMIN_RULE)
  }

  const respondentRule = await createEmailRule(RESPONDENT_RULE)
  if ('error' in respondentRule) {
    await updateEmailRule(RESPONDENT_RULE)
  }

  return {
    ok: true,
    message:
      'Seeded Forms starter templates + conditional rules (admin + respondent on product:forms/submitted).',
  }
}
