/**
 * Template + rule seed/ensure used by `seedEmailStarter`.
 * Same control flow as Events admin seed and Subscriptions email starters.
 * Store `{ error }` results are not failures. A thrown store error still propagates.
 */

import type { UpsertEmailRuleInput, UpsertEmailTemplateInput } from './store'

export type SeedEmailStarterInput = {
  template: UpsertEmailTemplateInput & { id: string }
  rule: UpsertEmailRuleInput & { id: string }
  /**
   * `seed` creates the pair, or updates it when the id already exists.
   * `ensure` creates only when that id is missing.
   */
  mode?: 'seed' | 'ensure'
}

export type EmailStarterWriteResult = { error: string } | Record<string, unknown>

export type EmailStarterSeedDeps = {
  findEmailTemplateById: (id: string) => Promise<unknown>
  findEmailRuleById: (id: string) => Promise<unknown>
  createEmailTemplate: (
    input: UpsertEmailTemplateInput,
  ) => Promise<EmailStarterWriteResult>
  updateEmailTemplate: (
    input: UpsertEmailTemplateInput & { id: string },
  ) => Promise<EmailStarterWriteResult>
  createEmailRule: (input: UpsertEmailRuleInput) => Promise<EmailStarterWriteResult>
  updateEmailRule: (
    input: UpsertEmailRuleInput & { id: string },
  ) => Promise<EmailStarterWriteResult>
}

function isWriteError(result: EmailStarterWriteResult): result is { error: string } {
  return 'error' in result
}

/**
 * Idempotent template + rule pair.
 * `seed` creates, then updates when create returns `{ error }`, and ignores that update result.
 * `ensure` creates only a missing id and ignores a create `{ error }`.
 * Template and rule are attempted independently.
 */
export async function runSeedEmailStarter(
  input: SeedEmailStarterInput,
  deps: EmailStarterSeedDeps,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mode = input.mode ?? 'seed'
  const templateId = input.template.id.trim()
  const ruleId = input.rule.id.trim()
  if (!templateId) return { ok: false, error: 'Template id is required.' }
  if (!ruleId) return { ok: false, error: 'Rule id is required.' }

  const template = { ...input.template, id: templateId }
  const rule = { ...input.rule, id: ruleId }

  if (mode === 'ensure') {
    if (!(await deps.findEmailTemplateById(templateId))) {
      await deps.createEmailTemplate(template)
    }
    if (!(await deps.findEmailRuleById(ruleId))) {
      await deps.createEmailRule(rule)
    }
    return { ok: true }
  }

  const createdTemplate = await deps.createEmailTemplate(template)
  if (isWriteError(createdTemplate)) {
    await deps.updateEmailTemplate(template)
  }

  const createdRule = await deps.createEmailRule(rule)
  if (isWriteError(createdRule)) {
    await deps.updateEmailRule(rule)
  }

  return { ok: true }
}
