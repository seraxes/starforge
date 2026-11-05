/**
 * Email Manager send engine — match rules → render template → Mailer.send.
 * Soft-fails always; never throws for transport / missing tables.
 */

import 'server-only'

import { getMailer } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { resolveEmailAudience } from './audience'
import { matchEmailRulesForTrigger } from './rule-match'
import { findEmailTemplateById, listEmailRules } from './store'
import { renderEmailTemplate } from './template-render'
import type { EmailTriggerEmitInput, EmailTriggerEmitResult } from './types'

export const EMAIL_MANAGER_MODULE_ID = 'product:email-manager'

export async function isEmailManagerEnabled(): Promise<boolean> {
  try {
    const settings = await getSiteSettings()
    return isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)
  } catch {
    return false
  }
}

/**
 * Emit a named trigger. Skips when Email Manager module is off, Chrome email
 * is disabled (Mailer reports disabled), or no rules match.
 */
export async function emitEmailTrigger(
  input: EmailTriggerEmitInput,
): Promise<EmailTriggerEmitResult> {
  const triggerKey = (input.triggerKey || '').trim()
  const empty: EmailTriggerEmitResult = {
    attempted: false,
    skipped: true,
    triggerKey,
    matchedRuleIds: [],
    results: [],
  }

  if (!triggerKey) {
    return { ...empty, reason: 'Missing trigger key.' }
  }

  try {
    if (!(await isEmailManagerEnabled())) {
      return { ...empty, reason: 'Email Manager module is disabled.' }
    }

    const rules = await listEmailRules({
      triggerKey,
      enabledOnly: true,
    })
    const matched = matchEmailRulesForTrigger({
      rules,
      triggerKey,
      payload: input.payload || {},
    })

    if (!matched.length) {
      return {
        ...empty,
        reason: 'No matching enabled rules.',
      }
    }

    const mailer = await getMailer()
    const info = mailer.info()
    const results: EmailTriggerEmitResult['results'] = []
    const matchedRuleIds = matched.map((r) => r.id)

    if (!info.enabled) {
      for (const rule of matched) {
        results.push({
          ruleId: rule.id,
          ok: false,
          skipped: true,
          error: 'Outbound email is disabled in Chrome.',
          provider: 'disabled',
        })
      }
      return {
        attempted: true,
        skipped: true,
        reason: 'Chrome email disabled.',
        triggerKey,
        matchedRuleIds,
        results,
      }
    }

    for (const rule of matched) {
      try {
        const full = rules.find((r) => r.id === rule.id)
        if (!full) {
          results.push({
            ruleId: rule.id,
            ok: false,
            error: 'Rule missing after match.',
          })
          continue
        }

        const template = await findEmailTemplateById(full.templateId)
        if (!template) {
          results.push({
            ruleId: rule.id,
            ok: false,
            error: 'Template not found.',
          })
          continue
        }

        const { to, replyTo } = resolveEmailAudience(full.audience, input.payload || {})
        if (!to.length) {
          results.push({
            ruleId: rule.id,
            ok: false,
            skipped: true,
            error: 'No recipients resolved.',
          })
          continue
        }

        const rendered = renderEmailTemplate({
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: template.bodyHtml || undefined,
          payload: input.payload || {},
        })

        const from =
          (full.fromOverride || '').trim() || (input.from || '').trim() || undefined

        const sendResult = await mailer.send({
          to,
          from,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          replyTo,
        })

        results.push({
          ruleId: rule.id,
          ok: sendResult.ok,
          skipped: sendResult.skipped,
          error: sendResult.error,
          provider: sendResult.provider,
        })
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ok: false,
          error: error instanceof Error ? error.message : 'Send failed.',
        })
      }
    }

    return {
      attempted: true,
      triggerKey,
      matchedRuleIds,
      results,
    }
  } catch (error) {
    return {
      ...empty,
      reason: error instanceof Error ? error.message : 'Emit failed.',
    }
  }
}

/**
 * Direct test send via platform Mailer (admin UI). Does not require a rule.
 * Soft-fails when Chrome email is off or provider misconfigured.
 */
export async function sendEmailManagerTest(options: {
  to: string
  subject: string
  text: string
  html?: string
  from?: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; provider?: string }> {
  const to = options.to.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'Enter a valid To address.' }
  }
  const subject = options.subject.trim() || 'Starforge Email Manager test'
  const text = options.text.trim() || 'Test message from Email Manager.'

  try {
    if (!(await isEmailManagerEnabled())) {
      return { ok: false, skipped: true, error: 'Email Manager module is disabled.' }
    }
    const mailer = await getMailer()
    const info = mailer.info()
    if (!info.enabled) {
      return {
        ok: false,
        skipped: true,
        error: 'Outbound email is disabled in Chrome.',
        provider: 'disabled',
      }
    }
    const result = await mailer.send({
      to,
      from: options.from?.trim() || undefined,
      subject,
      text,
      html: options.html?.trim() || undefined,
    })
    return {
      ok: result.ok,
      skipped: result.skipped,
      error: result.error,
      provider: result.provider,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Test send failed.',
    }
  }
}
