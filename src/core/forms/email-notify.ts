/**
 * Form email-on-submit — plan intents + dispatch via platform Mailer (SF-96).
 * When Email Manager is enabled and matching rules fire for
 * `product:forms/submitted`, prefer those rules and skip legacy intents
 * (avoids double-send after seeding Forms starters).
 * Server-only: call from submitFormAction after a successful save.
 */

import 'server-only'

import { getMailer } from '@/core/mail'
import type { MailSendResult } from '@/core/mail/types'

import { getFormsModuleSettings } from './settings-store'
import type {
  FormDefinitionDocument,
  FormEmailNotifyConfig,
  FormSubmissionPayload,
} from './types'

function formatPayloadValue(value: FormSubmissionPayload[string]): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

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
  /** True when Email Manager rules handled the send (legacy intents skipped). */
  viaEmailManager?: boolean
}

export type FormEmailNotifyDispatchContext = {
  document: FormDefinitionDocument
  payload: FormSubmissionPayload
  formKey: string
  definitionId: string | null
  submissionId?: string | null
}

function splitEmails(list: string[] | undefined): string[] {
  if (!list?.length) return []
  return list
    .flatMap((e) => e.split(/[,;\s]+/))
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function formatPayloadBody(
  payload: FormSubmissionPayload,
  title: string,
  fileFieldNames?: Set<string>,
): string {
  const lines = Object.entries(payload).map(([k, v]) => {
    const text = formatPayloadValue(v)
    if (fileFieldNames?.has(k) && text.trim()) {
      return `${k}: /api/media/${text.trim()} (media id ${text.trim()})`
    }
    return `${k}: ${text}`
  })
  return [`Form: ${title}`, '', ...lines].join('\n')
}

/**
 * Build notify intents from per-form config + module defaults.
 */
export async function planFormEmailNotify(options: {
  document: FormDefinitionDocument
  payload: FormSubmissionPayload
  formKey: string
  definitionId: string | null
}): Promise<FormEmailNotifyResult> {
  const settings = await getFormsModuleSettings()
  const cfg: FormEmailNotifyConfig = options.document.emailNotify ?? {}
  const intents: FormEmailNotifyIntent[] = []
  const title = options.document.title || options.definitionId || options.formKey
  const fileFieldNames = new Set(
    options.document.fields.filter((f) => f.type === 'file').map((f) => f.name),
  )
  const body = formatPayloadBody(options.payload, title, fileFieldNames)

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
    const respondent = formatPayloadValue(options.payload[field])
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

function buildEmailManagerPayload(
  context: FormEmailNotifyDispatchContext,
  settingsDefaultAdmin: string[],
): Record<string, unknown> {
  const cfg: FormEmailNotifyConfig = context.document.emailNotify ?? {}
  const title =
    context.document.title || context.definitionId || context.formKey
  const fileFieldNames = new Set(
    context.document.fields.filter((f) => f.type === 'file').map((f) => f.name),
  )
  const payloadText = formatPayloadBody(context.payload, title, fileFieldNames)
  const adminEmails = splitEmails(
    cfg.adminEmails?.length ? cfg.adminEmails : settingsDefaultAdmin,
  )
  const respondentField = cfg.respondentEmailField || 'email'
  const respondentEmail = formatPayloadValue(context.payload[respondentField])
    .trim()
    .toLowerCase()

  return {
    formKey: context.formKey,
    definitionId: context.definitionId,
    formTitle: title,
    preset: context.document.preset,
    payload: context.payload,
    payloadText,
    notifyAdmin: Boolean(cfg.notifyAdmin),
    notifyRespondent: Boolean(cfg.notifyRespondent),
    adminEmails,
    respondentEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail)
      ? respondentEmail
      : '',
    submissionId: context.submissionId ?? null,
    successMessage: context.document.successMessage || '',
  }
}

/**
 * Prefer Email Manager rules when the module is on and at least one rule matches.
 * Soft-fails — never throws.
 */
async function tryDispatchViaEmailManager(
  context: FormEmailNotifyDispatchContext,
): Promise<{
  handled: boolean
  result?: FormEmailNotifyResult
}> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    const { FORM_SUBMITTED_TRIGGER } = await import('@/modules/email-manager/api')
    if (!(await isEmailManagerEnabled())) {
      return { handled: false }
    }

    const settings = await getFormsModuleSettings()
    const payload = buildEmailManagerPayload(context, settings.defaultAdminEmails)
    const from = settings.fromAddress.trim() || undefined
    const emit = await emitEmailTrigger({
      triggerKey: FORM_SUBMITTED_TRIGGER,
      payload,
      from,
    })

    if (!emit.matchedRuleIds.length) {
      return { handled: false }
    }

    const mailer = await getMailer()
    const info = mailer.info()
    const results: MailSendResult[] = emit.results.map((r) => ({
      ok: r.ok,
      provider: (r.provider as MailSendResult['provider']) || info.provider,
      skipped: r.skipped,
      error: r.error,
    }))

    return {
      handled: true,
      result: {
        attempted: true,
        transport: info.enabled ? info.provider : 'disabled',
        intents: [],
        results,
        stubbed: !info.enabled || info.provider === 'console' || Boolean(emit.skipped),
        viaEmailManager: true,
      },
    }
  } catch {
    return { handled: false }
  }
}

/**
 * Dispatch planned intents through the platform Mailer.
 * Soft-fails per message — never throws for transport errors.
 * Pass `context` so Email Manager rules can take over when configured.
 */
export async function dispatchFormEmailNotify(
  plan: FormEmailNotifyResult,
  context?: FormEmailNotifyDispatchContext,
): Promise<FormEmailNotifyResult> {
  if (context) {
    const viaEm = await tryDispatchViaEmailManager(context)
    if (viaEm.handled && viaEm.result) {
      return viaEm.result
    }
  }

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
        error: 'Outbound email is disabled in Chrome.',
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
      meta: {
        emailType: 'transactional',
        title: intent.kind,
        source: 'forms',
        moduleCategory: 'forms',
      },
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
