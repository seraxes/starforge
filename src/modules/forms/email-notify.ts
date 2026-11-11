/**
 * Form email-on-submit — Email Manager only (`product:forms/submitted`).
 * Soft-skips when Email Manager is off or no rule matches. Never calls getMailer().
 * Server-only: call from submitFormAction after a successful save.
 */

import 'server-only'

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

export type FormEmailNotifySendResult = {
  ok: boolean
  provider?: string
  skipped?: boolean
  error?: string
  ruleId?: string
}

export type FormEmailNotifyResult = {
  attempted: boolean
  /** `email-manager` when rules ran; `skipped` / `none` otherwise. */
  transport: string
  intents: FormEmailNotifyIntent[]
  results?: FormEmailNotifySendResult[]
  /** True when nothing was handed to the network (disabled, no match, or Chrome mail off). */
  stubbed?: boolean
  /** True when Email Manager rules handled the emit. */
  viaEmailManager?: boolean
  /** Why send was skipped (module off, no rules, etc.). */
  skippedReason?: string
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
 * Build notify intents from per-form config + module defaults (diagnostics / resend UX).
 * Does not send mail.
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

  return {
    attempted: intents.length > 0,
    transport: 'none',
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
 * Dispatch via Email Manager only. Soft-fails — never throws; never falls back to Mailer.
 */
export async function dispatchFormEmailNotify(
  plan: FormEmailNotifyResult,
  context?: FormEmailNotifyDispatchContext,
): Promise<FormEmailNotifyResult> {
  if (!context) {
    return {
      ...plan,
      attempted: false,
      transport: 'skipped',
      stubbed: true,
      skippedReason: 'Missing dispatch context.',
    }
  }

  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    const { FORM_SUBMITTED_TRIGGER } = await import('@/modules/email-manager/api')
    const { ensureFormsEmailStartersSeeded } = await import(
      '@/modules/email-manager/forms-starters'
    )

    if (!(await isEmailManagerEnabled())) {
      return {
        ...plan,
        attempted: false,
        transport: 'skipped',
        stubbed: true,
        viaEmailManager: false,
        skippedReason: 'Email Manager module is disabled.',
      }
    }

    await ensureFormsEmailStartersSeeded()

    const settings = await getFormsModuleSettings()
    const payload = buildEmailManagerPayload(context, settings.defaultAdminEmails)
    const from = settings.fromAddress.trim() || undefined
    const emit = await emitEmailTrigger({
      triggerKey: FORM_SUBMITTED_TRIGGER,
      payload,
      from,
    })

    if (!emit.matchedRuleIds.length) {
      return {
        ...plan,
        attempted: false,
        transport: 'skipped',
        stubbed: true,
        viaEmailManager: false,
        skippedReason: emit.reason || 'No matching enabled rules.',
      }
    }

    const results: FormEmailNotifySendResult[] = emit.results.map((r) => ({
      ok: r.ok,
      provider: r.provider,
      skipped: r.skipped,
      error: r.error,
      ruleId: r.ruleId,
    }))

    return {
      ...plan,
      attempted: true,
      transport: 'email-manager',
      results,
      stubbed: Boolean(emit.skipped),
      viaEmailManager: true,
    }
  } catch {
    return {
      ...plan,
      attempted: false,
      transport: 'skipped',
      stubbed: true,
      viaEmailManager: false,
      skippedReason: 'Email Manager unavailable.',
    }
  }
}
