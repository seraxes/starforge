/**
 * Form email-on-submit — plan intents + dispatch via platform Mailer (SF-96).
 * Server-only: call from submitFormAction after a successful save.
 */

import 'server-only'

import { getMailer } from '@/core/mail'
import type { MailSendResult } from '@/core/mail/types'

import { getFormsModuleSettings } from './settings-store'
import type { FormDefinitionDocument, FormEmailNotifyConfig } from './types'

export type FormEmailNotifyIntent = {
  to: string[]
  subject: string
  kind: 'admin' | 'respondent'
  body: string
}

export type FormEmailNotifyResult = {
  attempted: boolean
  /** Active Mailer provider (or disabled / none when no intents). */
  transport: string
  intents: FormEmailNotifyIntent[]
  /** Per-intent send outcomes when dispatch ran. */
  results?: MailSendResult[]
  /** True when nothing was handed to the network (disabled, empty, or console-only log). */
  stubbed?: boolean
}

function splitEmails(list: string[] | undefined): string[] {
  if (!list?.length) return []
  return list
    .flatMap((e) => e.split(/[,;\s]+/))
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function formatPayloadBody(payload: Record<string, string>, title: string): string {
  const lines = Object.entries(payload).map(([k, v]) => `${k}: ${v}`)
  return [`Form: ${title}`, '', ...lines].join('\n')
}

/**
 * Build notify intents from per-form config + module defaults.
 */
export async function planFormEmailNotify(options: {
  document: FormDefinitionDocument
  payload: Record<string, string>
  formKey: string
  definitionId: string | null
}): Promise<FormEmailNotifyResult> {
  const settings = await getFormsModuleSettings()
  const cfg: FormEmailNotifyConfig = options.document.emailNotify ?? {}
  const intents: FormEmailNotifyIntent[] = []
  const title = options.document.title || options.definitionId || options.formKey
  const body = formatPayloadBody(options.payload, title)

  if (cfg.notifyAdmin) {
    const to = splitEmails(cfg.adminEmails?.length ? cfg.adminEmails : settings.defaultAdminEmails)
    if (to.length) {
      intents.push({
        to,
        subject: cfg.adminSubject || `[Starforge Form] ${title}`,
        kind: 'admin',
        body,
      })
    }
  }

  if (cfg.notifyRespondent) {
    const field = cfg.respondentEmailField || 'email'
    const respondent = String(options.payload[field] ?? '')
      .trim()
      .toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondent)) {
      intents.push({
        to: [respondent],
        subject: cfg.respondentSubject || `We received your ${title} submission`,
        kind: 'respondent',
        body:
          options.document.successMessage ||
          'Thanks — we received your submission.\n\n' + body,
      })
    }
  }

  const mailer = await getMailer()
  const info = mailer.info()

  return {
    attempted: intents.length > 0,
    transport: info.provider,
    intents,
  }
}

/**
 * Dispatch planned intents through the platform Mailer.
 * Soft-fails per message — never throws for transport errors.
 */
export async function dispatchFormEmailNotify(
  plan: FormEmailNotifyResult,
): Promise<FormEmailNotifyResult> {
  if (!plan.intents.length) {
    return plan
  }

  const mailer = await getMailer()
  const info = mailer.info()
  const settings = await getFormsModuleSettings()
  const from = settings.fromAddress.trim() || undefined

  if (!info.enabled) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[forms:email-skip]',
        JSON.stringify({
          reason: 'email disabled',
          count: plan.intents.length,
          to: plan.intents.map((i) => ({ kind: i.kind, to: i.to, subject: i.subject })),
        }),
      )
    }
    return {
      ...plan,
      transport: 'disabled',
      stubbed: true,
      results: plan.intents.map(() => ({
        ok: false,
        provider: 'disabled' as const,
        skipped: true,
        error: 'Outbound email is disabled in Site Chrome.',
      })),
    }
  }

  const results: MailSendResult[] = []
  for (const intent of plan.intents) {
    const result = await mailer.send({
      to: intent.to,
      from,
      subject: intent.subject,
      text: intent.body,
    })
    results.push(result)
    if (!result.ok && process.env.NODE_ENV !== 'production') {
      console.warn('[forms:email-send]', result.error || 'send failed', {
        kind: intent.kind,
        to: intent.to,
      })
    }
  }

  return {
    ...plan,
    transport: info.provider,
    results,
    stubbed: info.provider === 'console',
  }
}
